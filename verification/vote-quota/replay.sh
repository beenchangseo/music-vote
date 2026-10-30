#!/usr/bin/env bash
# Replays TLC counterexamples against the real SQL functions (loaded from the
# migrations by drift.mjs --sql) in a throwaway Postgres 17 container.
# Evidence for the findings in .claude/skills/verify-vote-quota/SKILL.md; check.sh does not need it.
#
#   verification/vote-quota/replay.sh     needs Docker
#
# Each scenario holds a transaction open with pg_sleep so that the other session's
# statements land between two statements of the first RPC, in the order TLC found.
# The real window is the time one RPC takes; the steps are the same.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
image="${REPLAY_IMAGE:-postgres:17-alpine}"
name="plypick-vote-replay-$$"

docker run -d --rm --name "$name" -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
# The image starts a temporary server for initdb first; wait for the second "ready".
until [ "$(docker logs "$name" 2>&1 | grep -c 'ready to accept connections')" -ge 2 ]; do sleep 0.3; done

sql() { docker exec -i "$name" psql -U postgres -X -q -At -v ON_ERROR_STOP=1 "$@"; }

H=00000000-0000-0000-0000-00000000000a   # host (creator)
M=00000000-0000-0000-0000-00000000000b   # member who votes
P=00000000-0000-0000-0000-0000000000f1   # playlist
S1=00000000-0000-0000-0000-0000000000c1
S2=00000000-0000-0000-0000-0000000000c2

# Only the columns these functions read or write. auth.uid() reads the same
# setting Supabase's does.
sql <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
CREATE TABLE playlists (
  id UUID PRIMARY KEY, creator_user_id UUID, voting_mode TEXT NOT NULL,
  default_vote_limit SMALLINT NOT NULL, votes_anonymous BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE songs (id UUID PRIMARY KEY, playlist_id UUID REFERENCES playlists(id));
CREATE TABLE playlist_members (
  playlist_id UUID REFERENCES playlists(id), user_id UUID, display_name TEXT,
  vote_limit SMALLINT NOT NULL, joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (playlist_id, user_id));
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID, nickname TEXT, vote_type SMALLINT NOT NULL, created_at TIMESTAMPTZ DEFAULT now());
SQL
node "$here/drift.mjs" --sql | sql

seed() { # $1 voting_mode, $2 the member's vote_limit
  sql <<SQL
TRUNCATE votes, playlist_members, songs, playlists, auth.users;
INSERT INTO auth.users (id, email) VALUES ('$H', 'host@example.com'), ('$M', 'member@example.com');
INSERT INTO playlists (id, creator_user_id, voting_mode, default_vote_limit) VALUES ('$P', '$H', '$1', 3);
INSERT INTO songs VALUES ('$S1', '$P'), ('$S2', '$P');
INSERT INTO playlist_members (playlist_id, user_id, display_name, vote_limit) VALUES ('$P', '$M', 'member', $2);
SQL
}
as_member() { sql -c "SET request.jwt.claim.sub = '$M'" -c "$1" >/dev/null; }
as_host() { sql -c "SET request.jwt.claim.sub = '$H'" -c "$1" >/dev/null; }
# A vote whose transaction stays open (holding the member row lock) for $2 seconds.
slow_vote() { as_member "BEGIN; SELECT result FROM cast_playlist_vote('$1', 1::SMALLINT, 'member'); SELECT pg_sleep($2); COMMIT;"; }
vote() { as_member "SELECT result FROM cast_playlist_vote('$1', 1::SMALLINT, 'member')"; }
state() {
  sql -c "SELECT p.voting_mode, pm.vote_limit, (SELECT count(*) FROM votes)
          FROM playlists p JOIN playlist_members pm ON pm.playlist_id = p.id" | tr '|' ' '
}
verdict() { # $1 scenario, $2 state we expect if the bug happens
  local got; got="$(state)"
  if [ "$got" = "$2" ]; then echo "REPRODUCED  $1: mode limit votes = $got"
  else echo "not reproduced  $1: mode limit votes = $got (bug would give $2)"; fi
}

# save/QuotaHolds: save_playlist_voting_settings counts the member's votes before it
# takes the member row lock, so a vote that commits in between is not counted.
seed allocated 1
slow_vote "$S1" 2 &
sleep 0.8
sql -c "SELECT save_playlist_voting_settings('$P', false, 'allocated', 3::SMALLINT,
        '[{\"user_id\": \"$M\", \"vote_limit\": 0}]'::JSONB)" >/dev/null
wait
verdict "save lowers the limit while a vote is in flight" "allocated 0 1"

# setLimit/QuotaHolds: the same order through set_member_vote_limit.
seed allocated 1
slow_vote "$S1" 2 &
sleep 0.8
as_host "SELECT set_member_vote_limit('$P', '$M', 0::SMALLINT)"
wait
verdict "set_member_vote_limit lowers the limit while a vote is in flight" "allocated 0 1"

# save/VotesMatchMode: cast_playlist_vote reads voting_mode without a lock. A vote
# that read 'free' before the switch to allocated (limit 1) still takes the free
# branch, which skips the quota count.
seed free 3
slow_vote "$S1" 3 &          # holds the member row lock
sleep 0.8
vote "$S2" &                  # reads 'free', then waits for the lock
sleep 0.8
sql -c "SELECT save_playlist_voting_settings('$P', false, 'allocated', 1::SMALLINT, '[]'::JSONB)" >/dev/null
wait
verdict "save switches free -> allocated while votes are in flight" "allocated 1 2"
