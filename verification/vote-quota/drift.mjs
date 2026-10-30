// Tells whether the code that VoteQuota.tla describes has changed since the last sync,
// and whether anything else now writes the rows the model guards.
//
//   node verification/vote-quota/drift.mjs           report, exit 1 on drift
//   node verification/vote-quota/drift.mjs --write   record the current SQL as synced
//   node verification/vote-quota/drift.mjs --sql     print the covered functions (replay.sh loads them)
//
// Only run --write after the model describes the current code again
// (.claude/skills/verify-vote-quota/SKILL.md).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const coveredPath = join(here, "covered.json");

// The SQL functions the model has one action per statement for.
const COVERED = [
  "cast_playlist_vote",
  "register_playlist_member",
  "save_playlist_voting_settings",
  "configure_playlist_voting",
  "set_member_vote_limit",
  "apply_vote_limit_to_all",
];

// Statements that change what the properties talk about: vote rows, a member's
// vote_limit, a playlist's voting_mode.
const SQL_WRITES = [
  /\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+(?:public\.)?votes\b/i,
  /\bUPDATE\s+(?:public\.)?playlist_members\s+SET[^;]*\bvote_limit\b/i,
  /\bUPDATE\s+(?:public\.)?playlists\s+SET[^;]*\bvoting_mode\b/i,
];

// Server code that writes the same rows without going through those functions.
// resetPlaylistVotes (votes delete) and the member-row inserts are known and left
// out of the model on purpose; see the skill's "Not covered".
const TS_WRITES = [
  { table: "votes", ops: /\.(insert|update|upsert)\(/ },
  { table: "playlist_members", ops: /\.(update|upsert)\(/ },
  { table: "playlists", ops: /\.(update|upsert)\([^)]*voting_mode/s },
];

const version = (f) => Number(f.match(/v(\d+)/)[1]);
const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((f) => /^v\d+\.sql$/.test(f))
  .sort((a, b) => version(a) - version(b))
  .map((f) => `supabase/migrations/${f}`);

// The definition that wins is the last CREATE FUNCTION in run order (supabase/README.md).
const latest = new Map();
for (const file of migrations) {
  const sql = readFileSync(join(root, file), "utf8");
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\([\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi;
  for (const m of sql.matchAll(re)) latest.set(m[1].toLowerCase(), { file, body: m[0] });
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

if (process.argv.includes("--sql")) {
  for (const name of COVERED) console.log(`${latest.get(name).body}\n`);
  process.exit(0);
}

if (process.argv.includes("--write")) {
  const out = {};
  for (const name of COVERED) {
    const def = latest.get(name);
    if (!def) throw new Error(`${name}: no CREATE FUNCTION found`);
    out[name] = { file: def.file, sha256: sha(def.body) };
  }
  writeFileSync(coveredPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`recorded ${COVERED.length} functions in ${relative(root, coveredPath)}`);
  process.exit(0);
}

const recorded = JSON.parse(readFileSync(coveredPath, "utf8"));
const problems = [];

for (const name of COVERED) {
  const def = latest.get(name);
  const rec = recorded[name];
  if (!def) problems.push(`${name}: definition not found any more`);
  else if (!rec) problems.push(`${name}: not recorded in covered.json`);
  else if (def.file !== rec.file || sha(def.body) !== rec.sha256) {
    problems.push(`${name}: changed (synced ${rec.file}, now ${def.file})`);
  }
}

for (const [name, def] of latest) {
  if (COVERED.includes(name)) continue;
  if (SQL_WRITES.some((re) => re.test(def.body))) {
    problems.push(`${name} (${def.file}): writes votes, vote_limit or voting_mode but is not in the model`);
  }
}

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== "__tests__" && entry !== "node_modules") yield* sourceFiles(p);
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) yield p;
  }
}
for (const file of sourceFiles(join(root, "src"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { table, ops } of TS_WRITES) {
      if (!line.includes(`.from("${table}")`)) continue;
      const chain = lines.slice(i, i + 8).join("\n");
      if (ops.test(chain)) {
        problems.push(`${relative(root, file)}:${i + 1}: writes ${table} outside the modeled SQL functions`);
      }
    }
  });
}

if (problems.length === 0) {
  console.log(`drift: none (${COVERED.length} functions match covered.json)`);
} else {
  console.log("drift:");
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
