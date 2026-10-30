------------------------------ MODULE VoteQuota ------------------------------
(***************************************************************************)
(* Plypick's vote promises under concurrent transactions.                 *)
(*                                                                         *)
(* One playlist, one member who votes (the voter) and the host. Every     *)
(* process is one RPC call, which PostgREST runs as one transaction at    *)
(* READ COMMITTED (the Supabase default). Every step is one SQL statement *)
(* of the function, and the comment on each step names its line:          *)
(*                                                                         *)
(*   cast_playlist_vote             supabase-migration-v12.sql            *)
(*   register_playlist_member       supabase-migration-v10.sql (in cast)  *)
(*   save_playlist_voting_settings  supabase-migration-v11.sql (UI path)  *)
(*   configure_playlist_voting      supabase-migration-v10.sql            *)
(*   set_member_vote_limit          supabase-migration-v10.sql            *)
(*   apply_vote_limit_to_all        supabase-migration-v10.sql            *)
(*                                                                         *)
(* READ COMMITTED: a statement sees the committed rows plus its own       *)
(* transaction's writes. UPDATE, SELECT ... FOR UPDATE and                *)
(* INSERT ... ON CONFLICT DO UPDATE take the row lock and wait while      *)
(* another transaction holds it, then act on the latest committed row.    *)
(* Locks are released at COMMIT or at the rollback a RAISE causes.        *)
(*                                                                         *)
(* Left out: reads with no effect on these rows (creator checks, the      *)
(* final count that cast returns, display_name reads), new members (the   *)
(* member row exists), other members' votes, and resetPlaylistVotes,      *)
(* which only deletes votes. Insertion order stands in for                *)
(* ORDER BY created_at DESC, id DESC; which same-song row is "latest"     *)
(* does not change any count.                                             *)
(***************************************************************************)
EXTENDS Integers, FiniteSets

CONSTANTS
  Voters,         \* concurrent cast_playlist_vote calls by the one member
  HostOps,        \* host functions that run at the same time, a subset of HostFns
  Songs,          \* candidate songs (songs rows of the playlist)
  LimitValues,    \* vote limits the host can set (code allows 0..99)
  DefaultValues,  \* default limits the host can set (code allows 1..99)
  NONE

HostFns == {"save", "configure", "setLimit", "applyAll"}
ASSUME HostOps \subseteq HostFns /\ Voters \cap HostFns = {}

Procs == Voters \cup HostOps
Modes == {"free", "allocated"}
Types == {1, -1}

VARIABLES
  mode,          \* committed playlists.voting_mode
  limit,         \* committed playlist_members.vote_limit of the member
  votes,         \* committed votes rows of the member, [id, song, type, cast]
                 \*   cast: the voting_mode the writing transaction acted on
                 \*   (not a column; it records which rules wrote the row)
  nextId,        \* id of the next votes row
  memberLock,    \* transaction holding the member's playlist_members row lock, or NONE
  playlistLock,  \* transaction holding the playlists row lock, or NONE
  pc,            \* next statement of each transaction
  seenMode,      \* voting_mode the transaction read
  seenLimit,     \* vote_limit the voter read FOR UPDATE
  seenVote,      \* latest vote of the member on the voter's song, or NONE
  ins, del,      \* the transaction's uncommitted votes inserts and deleted ids
  wMode, wLimit, \* the transaction's uncommitted voting_mode and vote_limit, or NONE
  arg            \* each transaction's arguments, fixed when it starts

vars == <<mode, limit, votes, nextId, memberLock, playlistLock, pc,
          seenMode, seenLimit, seenVote, ins, del, wMode, wLimit, arg>>

VoterArgs == [song : Songs, type : Types]
ArgsOf(p) ==
  CASE p \in Voters        -> VoterArgs
    [] p = "save"          -> [mode : Modes, dflt : DefaultValues, member : LimitValues \cup {NONE}]
    [] p = "configure"     -> [mode : Modes, dflt : DefaultValues]
    [] p \in {"setLimit", "applyAll"} -> [limit : LimitValues]
AllArgs == UNION {ArgsOf(p) : p \in Procs}

Vote == [id : Nat, song : Songs, type : Types, cast : Modes]

(* Rows a statement of transaction p sees. *)
Visible(p) == {v \in votes : v.id \notin del[p]} \cup ins[p]
Used(p) == Cardinality(Visible(p))
Latest(S, s) ==
  LET mine == {v \in S : v.song = s}
  IN IF mine = {} THEN NONE ELSE CHOOSE v \in mine : \A w \in mine : w.id <= v.id

Go(p, l) == pc' = [pc EXCEPT ![p] = l]
TakeMemberLock(p) == memberLock \in {NONE, p} /\ memberLock' = p
TakePlaylistLock(p) == playlistLock \in {NONE, p} /\ playlistLock' = p

Locals == <<seenMode, seenLimit, seenVote, ins, del, wMode, wLimit>>

----------------------------------------------------------------------------
(* cast_playlist_vote, supabase-migration-v12.sql *)

(* l.41: SELECT s.playlist_id, p.voting_mode ... JOIN playlists p (no lock) *)
VReadMode(p) ==
  /\ pc[p] = "start"
  /\ seenMode' = [seenMode EXCEPT ![p] = mode]
  /\ Go(p, "register")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock,
                 seenLimit, seenVote, ins, del, wMode, wLimit, arg>>

(* l.51: PERFORM register_playlist_member -> v10 l.183-186
   INSERT ... ON CONFLICT (playlist_id, user_id) DO UPDATE locks the member row *)
VRegister(p) ==
  /\ pc[p] = "register"
  /\ TakeMemberLock(p)
  /\ Go(p, "lockMember")
  /\ UNCHANGED <<mode, limit, votes, nextId, playlistLock, Locals, arg>>

(* l.54-58: SELECT pm.vote_limit ... FOR UPDATE (p already holds the lock) *)
VReadLimit(p) ==
  /\ pc[p] = "lockMember"
  /\ seenLimit' = [seenLimit EXCEPT ![p] = limit]
  /\ Go(p, "readVote")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock,
                 seenMode, seenVote, ins, del, wMode, wLimit, arg>>

(* l.60-65: SELECT v.id, v.vote_type ... ORDER BY created_at DESC, id DESC LIMIT 1,
   then the branch on v_mode at l.67 / l.88 / l.97 *)
VReadVote(p) ==
  /\ pc[p] = "readVote"
  /\ LET e == Latest(Visible(p), arg[p].song)
         t == arg[p].type
     IN /\ seenVote' = [seenVote EXCEPT ![p] = e]
        /\ Go(p, IF seenMode[p] = "allocated"
                 THEN IF e # NONE /\ e.type # t THEN "delete" ELSE "countUsed"
                 ELSE IF e = NONE THEN "insert"
                      ELSE IF e.type = t THEN "delete" ELSE "update")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock,
                 seenMode, seenLimit, ins, del, wMode, wLimit, arg>>

(* l.73-81: SELECT count( * ) ...; IF v_used >= v_limit THEN RAISE *)
VCountUsed(p) ==
  /\ pc[p] = "countUsed"
  /\ Go(p, IF Used(p) >= seenLimit[p] THEN "rollback" ELSE "insert")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock, Locals, arg>>

(* l.84 / l.98: INSERT INTO votes *)
VInsert(p) ==
  /\ pc[p] = "insert"
  /\ ins' = [ins EXCEPT ![p] = @ \cup {[id |-> nextId, song |-> arg[p].song,
                                        type |-> arg[p].type, cast |-> seenMode[p]]}]
  /\ nextId' = nextId + 1
  /\ Go(p, "commit")
  /\ UNCHANGED <<mode, limit, votes, memberLock, playlistLock,
                 seenMode, seenLimit, seenVote, del, wMode, wLimit, arg>>

(* l.70 / l.91: DELETE FROM votes WHERE id = v_existing_id *)
VDelete(p) ==
  /\ pc[p] = "delete"
  /\ del' = [del EXCEPT ![p] = @ \cup {seenVote[p].id}]
  /\ Go(p, "commit")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock,
                 seenMode, seenLimit, seenVote, ins, wMode, wLimit, arg>>

(* l.94: UPDATE votes SET vote_type = p_vote_type WHERE id = v_existing_id *)
VUpdate(p) ==
  /\ pc[p] = "update"
  /\ del' = [del EXCEPT ![p] = @ \cup {seenVote[p].id}]
  /\ ins' = [ins EXCEPT ![p] = @ \cup {[seenVote[p] EXCEPT !.type = arg[p].type,
                                                         !.cast = seenMode[p]]}]
  /\ Go(p, "commit")
  /\ UNCHANGED <<mode, limit, votes, nextId, memberLock, playlistLock,
                 seenMode, seenLimit, seenVote, wMode, wLimit, arg>>

Voter(p) ==
  VReadMode(p) \/ VRegister(p) \/ VReadLimit(p) \/ VReadVote(p) \/ VCountUsed(p)
    \/ VInsert(p) \/ VDelete(p) \/ VUpdate(p)

----------------------------------------------------------------------------
(* save_playlist_voting_settings, supabase-migration-v11.sql (the settings
   sheet calls it through saveVotingSettings in src/actions/member.ts).
   arg.member is the member's entry in p_member_limits, NONE when absent. *)

HostStatic == <<votes, nextId, seenLimit, seenVote, ins, del, arg>>

(* l.38-42: SELECT voting_mode ... FROM playlists ... FOR UPDATE *)
SaveLock ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "start"
  /\ TakePlaylistLock(h)
  /\ seenMode' = [seenMode EXCEPT ![h] = mode]
  /\ Go(h, IF mode # arg[h].mode THEN "countAll" ELSE "checkMember")
  /\ UNCHANGED <<mode, limit, memberLock, wMode, wLimit, HostStatic>>

(* l.48-57: SELECT count( * ) FROM votes ...; IF v_vote_count > 0 THEN RAISE *)
SaveCountAll ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "countAll"
  /\ Go(h, IF Used(h) > 0 THEN "rollback" ELSE "checkMember")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wMode, wLimit, HostStatic>>

(* l.85-94 (loop): SELECT count( * ) INTO v_used ...; IF v_used > v_vote_limit THEN RAISE *)
SaveCheckMember ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "checkMember"
  /\ Go(h, IF arg[h].member # NONE /\ Used(h) > arg[h].member
           THEN "rollback" ELSE "updatePlaylist")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wMode, wLimit, HostStatic>>

(* l.97-101: UPDATE playlists SET ..., voting_mode = p_mode, ... *)
SaveUpdatePlaylist ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "updatePlaylist"
  /\ wMode' = [wMode EXCEPT ![h] = arg[h].mode]
  /\ Go(h, IF seenMode[h] # arg[h].mode /\ arg[h].mode = "allocated" THEN "updateDefault"
           ELSE IF arg[h].member # NONE THEN "updateMember" ELSE "commit")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wLimit, HostStatic>>

(* l.103-107: UPDATE playlist_members SET vote_limit = p_default_limit *)
SaveUpdateDefault ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "updateDefault"
  /\ TakeMemberLock(h)
  /\ wLimit' = [wLimit EXCEPT ![h] = arg[h].dflt]
  /\ Go(h, IF arg[h].member # NONE THEN "updateMember" ELSE "commit")
  /\ UNCHANGED <<mode, limit, playlistLock, seenMode, wMode, HostStatic>>

(* l.109-115 (loop): UPDATE playlist_members SET vote_limit = (...) *)
SaveUpdateMember ==
  LET h == "save" IN
  /\ h \in HostOps /\ pc[h] = "updateMember"
  /\ TakeMemberLock(h)
  /\ wLimit' = [wLimit EXCEPT ![h] = arg[h].member]
  /\ Go(h, "commit")
  /\ UNCHANGED <<mode, limit, playlistLock, seenMode, wMode, HostStatic>>

Save ==
  SaveLock \/ SaveCountAll \/ SaveCheckMember \/ SaveUpdatePlaylist
    \/ SaveUpdateDefault \/ SaveUpdateMember

----------------------------------------------------------------------------
(* configure_playlist_voting, supabase-migration-v10.sql *)

(* l.316-321: SELECT creator_user_id, voting_mode ... FROM playlists ... FOR UPDATE *)
ConfLock ==
  LET h == "configure" IN
  /\ h \in HostOps /\ pc[h] = "start"
  /\ TakePlaylistLock(h)
  /\ seenMode' = [seenMode EXCEPT ![h] = mode]
  /\ Go(h, IF mode # arg[h].mode THEN "countAll" ELSE "updatePlaylist")
  /\ UNCHANGED <<mode, limit, memberLock, wMode, wLimit, HostStatic>>

(* l.327-336: SELECT count( * ) FROM votes ...; IF v_vote_count > 0 THEN RAISE *)
ConfCountAll ==
  LET h == "configure" IN
  /\ h \in HostOps /\ pc[h] = "countAll"
  /\ Go(h, IF Used(h) > 0 THEN "rollback" ELSE "updatePlaylist")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wMode, wLimit, HostStatic>>

(* l.339-342: UPDATE playlists SET voting_mode = p_mode, ... *)
ConfUpdatePlaylist ==
  LET h == "configure" IN
  /\ h \in HostOps /\ pc[h] = "updatePlaylist"
  /\ wMode' = [wMode EXCEPT ![h] = arg[h].mode]
  /\ Go(h, IF seenMode[h] # arg[h].mode /\ arg[h].mode = "allocated"
           THEN "updateDefault" ELSE "commit")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wLimit, HostStatic>>

(* l.344-347: UPDATE playlist_members SET vote_limit = p_default_limit *)
ConfUpdateDefault ==
  LET h == "configure" IN
  /\ h \in HostOps /\ pc[h] = "updateDefault"
  /\ TakeMemberLock(h)
  /\ wLimit' = [wLimit EXCEPT ![h] = arg[h].dflt]
  /\ Go(h, "commit")
  /\ UNCHANGED <<mode, limit, playlistLock, seenMode, wMode, HostStatic>>

Configure == ConfLock \/ ConfCountAll \/ ConfUpdatePlaylist \/ ConfUpdateDefault

----------------------------------------------------------------------------
(* set_member_vote_limit and apply_vote_limit_to_all, supabase-migration-v10.sql.
   For one member both are "count without a lock, then UPDATE". *)

(* set_member_vote_limit l.378-385: SELECT count( * ) INTO v_used ...;
   IF v_used > p_vote_limit THEN RAISE
   apply_vote_limit_to_all l.423-436: SELECT ... HAVING count(v.id) > p_vote_limit;
   IF v_blocked_name IS NOT NULL THEN RAISE *)
LimitCheck(h) ==
  /\ h \in HostOps /\ pc[h] = "start"
  /\ Go(h, IF Used(h) > arg[h].limit THEN "rollback" ELSE "updateMember")
  /\ UNCHANGED <<mode, limit, memberLock, playlistLock, seenMode, wMode, wLimit, HostStatic>>

(* set_member_vote_limit l.387-389 / apply_vote_limit_to_all l.438-440:
   UPDATE playlist_members SET vote_limit = p_vote_limit *)
LimitUpdate(h) ==
  /\ h \in HostOps /\ pc[h] = "updateMember"
  /\ TakeMemberLock(h)
  /\ wLimit' = [wLimit EXCEPT ![h] = arg[h].limit]
  /\ Go(h, "commit")
  /\ UNCHANGED <<mode, limit, playlistLock, seenMode, wMode, HostStatic>>

SetLimit == LimitCheck("setLimit") \/ LimitUpdate("setLimit")
ApplyAll == LimitCheck("applyAll") \/ LimitUpdate("applyAll")

----------------------------------------------------------------------------
(* End of a transaction *)

Release(p) ==
  /\ memberLock' = IF memberLock = p THEN NONE ELSE memberLock
  /\ playlistLock' = IF playlistLock = p THEN NONE ELSE playlistLock

Forget(p) ==
  /\ seenMode' = [seenMode EXCEPT ![p] = NONE]
  /\ seenLimit' = [seenLimit EXCEPT ![p] = NONE]
  /\ seenVote' = [seenVote EXCEPT ![p] = NONE]
  /\ ins' = [ins EXCEPT ![p] = {}]
  /\ del' = [del EXCEPT ![p] = {}]
  /\ wMode' = [wMode EXCEPT ![p] = NONE]
  /\ wLimit' = [wLimit EXCEPT ![p] = NONE]

(* COMMIT at the end of the RPC *)
Commit(p) ==
  /\ pc[p] = "commit"
  /\ votes' = {v \in votes : v.id \notin del[p]} \cup ins[p]
  /\ mode' = IF wMode[p] = NONE THEN mode ELSE wMode[p]
  /\ limit' = IF wLimit[p] = NONE THEN limit ELSE wLimit[p]
  /\ Release(p) /\ Forget(p)
  /\ Go(p, "done")
  /\ UNCHANGED <<nextId, arg>>

(* RAISE EXCEPTION: the whole RPC rolls back *)
Rollback(p) ==
  /\ pc[p] = "rollback"
  /\ Release(p) /\ Forget(p)
  /\ Go(p, "done")
  /\ UNCHANGED <<mode, limit, votes, nextId, arg>>

(* Every RPC has finished. *)
Done == \A p \in Procs : pc[p] = "done"
Finished == Done /\ UNCHANGED vars

----------------------------------------------------------------------------
(* The promises *)

(* In allocated mode a member never holds more votes than their vote limit. *)
QuotaHolds == mode = "allocated" => Cardinality(votes) <= limit

(* In free mode a member holds at most one vote per song. *)
FreeOneVotePerSong ==
  mode = "free" => \A s \in Songs : Cardinality({v \in votes : v.song = s}) <= 1

(* Once voting has started the mode does not change, so every vote row
   was written by the rules of the current mode. *)
VotesMatchMode == \A v \in votes : v.cast = mode

TypeOK ==
  /\ mode \in Modes
  /\ limit \in LimitValues \cup DefaultValues
  /\ votes \subseteq Vote
  /\ memberLock \in Procs \cup {NONE}
  /\ playlistLock \in Procs \cup {NONE}

----------------------------------------------------------------------------

Init ==
  /\ mode \in Modes
  /\ limit \in LimitValues
  /\ votes \in {{}} \cup {{[id |-> 0, song |-> s, type |-> t, cast |-> mode]} : s \in Songs, t \in Types}
  /\ QuotaHolds /\ FreeOneVotePerSong
  /\ nextId = 1
  /\ memberLock = NONE /\ playlistLock = NONE
  /\ pc = [p \in Procs |-> "start"]
  /\ seenMode = [p \in Procs |-> NONE]
  /\ seenLimit = [p \in Procs |-> NONE]
  /\ seenVote = [p \in Procs |-> NONE]
  /\ ins = [p \in Procs |-> {}]
  /\ del = [p \in Procs |-> {}]
  /\ wMode = [p \in Procs |-> NONE]
  /\ wLimit = [p \in Procs |-> NONE]
  /\ arg \in {a \in [Procs -> AllArgs] : \A p \in Procs : a[p] \in ArgsOf(p)}

Next ==
  \/ \E p \in Voters : Voter(p)
  \/ Save \/ Configure \/ SetLimit \/ ApplyAll
  \/ \E p \in Procs : Commit(p) \/ Rollback(p)
  \/ Finished

Spec == Init /\ [][Next]_vars

=============================================================================
