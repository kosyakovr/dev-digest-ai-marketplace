---
name: workflow-retro
description: >-
  Retro of a finished multi-agent run (/sdd-engineering:sdd-run or any subagent
  flow): "workflow retro", "retrospective of the run", "what did the run cost". Reads
  local Claude Code transcripts and measures tokens, cache, time and cost per agent.
  Finds re-reads, re-asks, writes outside an agent's scope and skipped steps. Gives at
  most 5 action items and appends one ledger row. Recommends only.
---

# Workflow retro

A run of the SDD flow (`/sdd-engineering:sdd-run`: test-writer T1 → implementer →
test-writer T2 → plan-verifier ∥ architecture-reviewer → triage → at most two fix
rounds → final plan-verifier → engineering-insights → commit on the user's word)
leaves a full record in Claude Code's transcripts. This skill turns that record
into numbers, problems and **at most five** concrete changes. It keeps one ledger
row per run, so you can see the trend between runs.

**What it writes:** one row in the ledger (`retro_ledger`, default
`docs/retros/ledger.md`) and a JSON report at the path you pass. Nothing else.
Fixing what it finds is a separate step that the user starts.

## What runs on your machine

`retro.mjs` (in this skill's `scripts/` folder) is plain Node with no dependencies. It reads the transcripts of
this project under `~/.claude/projects/<project>/` (the main session and its
`subagents/` folder) on your machine. It sends nothing anywhere and makes no network
or model calls. It writes only the `--json` path you pass and, with `--ledger`, one
appended row. When the ledger file does not exist, it creates the file (and its
parent folder) with the header. Transcripts can contain anything the session saw,
so keep the JSON report in the scratchpad, not in the repository.

## Inputs

Pass the same values that `/sdd-engineering:sdd-run` used. It records them on the
plan's `## Run log`, so read them there first. Otherwise use the project's `## SDD`
section in `CLAUDE.md` or `AGENTS.md`, and then the defaults.

| Flag | sdd-run input | Default |
|---|---|---|
| `--ledger [path]` | `retro_ledger` | `docs/retros/ledger.md` (a bare `--ledger` uses it; without the flag nothing is appended) |
| `--spec-dir <dir>` | `spec_dir` | `docs/specs` |
| `--plan-dir <dir>` | the folder of `plan_path` | `docs/plans` |
| `--protected <regex>` | `protected_paths` (write the list as one alternation, e.g. `^infra/\|^db/schema\.sql$`) | Added to the built-in defaults: lock files, `migrations/` directories, `.git/`, `.claude/`, `CLAUDE.md`, and `INSIGHTS.md` (for agents) |
| `--tests <regex>` | what the plan's Test plan treats as test files | `*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/` (the flag replaces this default) |
| `--session`, `--since`, `--until` | — | this session, from the previous retro (or the session start) to this one |
| `--project <dir>` | — | the current directory |

Regexes match project-relative paths with forward slashes (`api/src/x.ts`).

## Hard rules

1. **Recommend, never apply.** Do not edit agents, skills, settings, the project's
   instruction files (`CLAUDE.md`, `AGENTS.md`), any `INSIGHTS.md`, specs or docs.
   An action item names the file and the change. The user decides.
2. **Never read a transcript into the context.** They are megabytes. All numbers
   come from `retro.mjs`. Any drill-down is a `jq` on its JSON, or a targeted
   `grep` that prints a few lines. Never `Read` a `.jsonl` or a `tasks/*.output`
   file.
3. **Every action item is backed by a finding you checked** (Step 3). A finding is
   a lead, not a verdict.
4. **The ledger is append-only.** Add rows only through the script (`--ledger`).
   Never edit or delete a row by hand. The script refuses a second row for the
   same run.
5. **Say what is estimated.** Subagent output tokens are partly estimated (see
   § Transcript format). When the script prints `≈` or `not calibrated`, the chat
   summary says so too.

## Step 1 — Run the script

```bash
node "${CLAUDE_SKILL_DIR}/scripts/retro.mjs" \
  --spec-dir <spec_dir> --plan-dir <plan dir> [--protected '<regex>'] [--tests '<regex>'] \
  --json <scratchpad>/retro-<session8>.json
```

- **Which session.** By default the script reads this session
  (`$CLAUDE_CODE_SESSION_ID`). If it reports `0 agents`, the run happened in an
  earlier session. Run it again with `--session prev` (the newest other session
  that has subagents) or `--session <id>`, and tell the user which session you read
  (id, branch, date).
- **Which part of the session.** The window ends at this retro's invocation. It
  starts at the previous retro in the same session, or at the session start. If
  one session holds several features, narrow the window with `--since` / `--until`
  (ISO timestamps). Take them from the human prompts:
  `jq -r 'select(.origin.kind=="human") | "\(.timestamp) \(.message.content|tostring|.[0:80])"' <session>.jsonl`.
- The script runs in well under a second. It prints the inputs it used, the table,
  the parallelism line, a cost reconciliation and the findings `F1…Fn` (`crit` →
  `warn` → `info`). Each finding has evidence and a suggested target.

## Step 2 — Read the numbers

| Column | Meaning |
|---|---|
| Turns | API calls (one `message.id` each) |
| Tokens | input + cache write + cache read + output, summed over the turns |
| Cache hit | cache read ÷ (input + cache write + cache read) |
| 1st-turn cache | cache read on the agent's first call. `0` means the spawn paid full price for its prompt. Caching across spawns rarely hits, so `0` is common and is not a finding on its own. This is why sdd-run continues agents with `SendMessage` instead of spawning them again |
| Active | the agent's span minus the idle gaps before each `SendMessage` continuation. `×N` means N rounds |
| Tools (err) | tool calls, and how many of them were errors (failed commands and permission denials) |
| Cost | from the `PRICES` table in `retro.mjs`. `+?` means some calls were on a model with no known price. Those count as unknown, never as $0 |

Parallelism: **peak** is the most agents running at once. **avg** is agent time ÷
the time at least one agent ran (1.0 = strictly serial). The wall time includes the
human's thinking time between prompts, so compare avg, not wall, between runs.

The `Harness cost-state` line compares the window's computed cost with the
harness's own session total. For a whole-session window they should agree to
within about 1%. A large gap means one of two things. Either the window cuts the
session, or the price table is stale. In that case, refresh `PRICES` in
`retro.mjs` from current Anthropic pricing (the `claude-api` skill, or the pricing
page). The table already covers claude-fable-5-1, claude-opus-5-5,
claude-sonnet-5-5 and claude-haiku-5-5. For Haiku 5.5, a call with a prompt over
100K tokens is priced at its long-prompt rate. A model the table does not know is
counted as unknown.

## Step 3 — Verify the findings

Before you turn a finding into an action item, open its evidence in the narrowest
way. Drop the finding if it does not hold. The usual checks:

| Finding | Check | Drop it when |
|---|---|---|
| `re-read` | `jq '.reRead[:10]' <json>`: who read it, how often | the readers needed different parts (e.g. reviewers reading hunks of a file the implementer wrote) |
| `re-ask` | the agent's hand-back: `jq -r 'select(.type=="assistant") \| .message.content[] \| select(.name=="SubagentHandback") \| .input.message' <subagents/agent-ID.jsonl> \| head -40` | the question was the user's to answer (a gate), not missing input |
| `scope` (denied) | the denial text in the evidence | never drop it. A denial the agent recovered from is a prompt fix: tell the agent the allowed way |
| `scope` (wrote outside) | `git log --stat` / `git diff --stat` for that path; the `Inputs:` line of the output | the file was reverted before the commit (still report it, at lower priority); or `--spec-dir` / `--tests` / `--protected` did not match the run's inputs (run again with the right ones) |
| `scope` (committed or pushed) | the command in the evidence | never drop it. Only the user commits |
| `scope` (through the shell) | the agent's command for one listed file: `jq -r '… select(.name=="Bash") \| .input.command' <agent>.jsonl \| grep -m1 -B2 -A8 '<file>'` | the path is data in the command, not a write target. That is a parser miss, so say so |
| `scope` (unplanned files) | the implementer report's deviations from the plan | the deviation is listed there with a reason |
| `skipped` INSIGHTS read | `jq -r 'select(.type=="assistant") \| .message.content[]? \| select(.type=="tool_use") \| .input.file_path // .input.command // empty' <agent>.jsonl \| grep -n INSIGHTS` | the agent read it by a path form the script does not parse (say so). The check uses the INSIGHTS files on disk now, so also drop it if the file was created later in the run |
| `skipped` docs / spec | `git log --stat <range> -- '*.md'`; the plan's "Docs to update" list | the docs landed in a later commit of the same run, or the plan lists no docs |
| `skipped` implementer passes | the plan's `## Run log` | the extra passes were a BLOCKED re-ask, not fix rounds |
| `parallel` reviewers serial | the spawn times in `jq '.agents[] \| {type, spawnedAt}' <json>` | a reviewer needed the other's result (stated in the delegation prompt) |
| `cost` main > agents | `jq '.main \| {turns, peakCtx, cost}' <json>` | the main session was debugging with the user (expected), not grinding |

The scope profiles are a static table in `retro.mjs`, keyed by agent name with
the plugin prefix stripped:

| Agent | Profile: what it may write |
|---|---|
| `implementation-planner`, `plan-verifier`, `architecture-reviewer`, `researcher` | nothing (read-only) |
| `spec-creator` | only files under `--spec-dir` |
| `test-writer` | only test files (`--tests`), plus its red-proof worktree (a temp dir whose name contains `sdd-redproof-`) |
| `implementer` | anything except tests, specs, plans and protected paths |

Protected paths are out of scope for every profile. Agents are also never allowed
to commit or push. `general-purpose` and other unknown agents have no profile.
For them, only reads, denials and cost are checked.

## Step 4 — Choose at most 5 action items

Rank `crit` first. Then rank by the cost the problem caused: repeat-read tokens,
extra rounds, a fresh spawn instead of a continuation. Then rank by how many runs
it recurs in (the ledger). Merge findings that have one cause into one item. If
fewer than five deserve a change, give fewer. "No changes" is a valid result.

Each item has exactly this shape:

```
N. <file or component> § <section or Step> → <what to change, concretely>
   because: F<ids> — <one-line evidence with a number>
```

Before you write an item, check that the section you cite exists. For a project
file, `grep -n` it. For a plugin component, read that section. Quote the current
rule when the change contradicts or sharpens it. A plugin target (for example
`sdd-engineering:implementer § Hard rules`) means a change to that plugin's
source, which goes to its maintainers or a fork. Project-side targets the user can
change directly: the `## SDD` section of `CLAUDE.md` or `AGENTS.md`, the plan, and
the delegation prompt.

Typical targets:

| Problem | Usually fixed in |
|---|---|
| plan / report re-read by many agents | the delegation prompt, per `sdd-engineering:sdd-run` § Orchestrator rules (pass paths, not contents). If the plan itself is too long: `sdd-engineering:implementation-planner` § Output format |
| a skill file re-read by several agents | `sdd-engineering:implementation-planner` § Output format (put the binding skill § numbers in the plan, so agents load sections, not whole skills) |
| a source file re-read by reviewers | `sdd-engineering:sdd-run` § Orchestrator rules (re-review on the delta) and the reviewer's scope (`change_scope`) |
| NEEDS CLARIFICATION / BLOCKED | the agent's `## Inputs` table and `## Step 0`, and what the delegation prompt left out. A missing default belongs in the project's `## SDD` section |
| extra rounds via SendMessage | `sdd-engineering:sdd-run` § Orchestrator rules (re-review on the delta, at most two fix rounds), or the agent's `## Output format` if the round was spent asking for a missing field |
| a denial the agent recovered from | the agent's `## Hard rules` (state the allowed way up front, e.g. the red-proof worktree) |
| project files written through the shell | the agent's `## Hard rules` (Edit/Write for project files). Permission rules on Edit/Write paths do not see shell writes |
| a write outside scope, a commit or a push by an agent | the agent's `## Hard rules`, and `disallowedTools` where a tool can express the rule. There are no hook guards in this suite, so this is always `crit` |
| nearest INSIGHTS.md not read before an edit | the agent's `## Step 0`, or the main session per `sdd-engineering:engineering-insights` § 1 |
| Insight candidates never captured | `sdd-engineering:sdd-run` (collect every report's Insight candidates into a file and run `sdd-engineering:engineering-insights` with its path) |
| repeated whole-suite test runs | the plan's Test plan (`check_commands`: the narrowest command per step), `sdd-engineering:test-writer`, `sdd-engineering:implementer` |
| reviewers run one after another | `sdd-engineering:sdd-run`: launch plan-verifier and architecture-reviewer in one message |
| main session cost more than the agents | `sdd-engineering:sdd-run` § Orchestrator rules (pass paths, reports to files, continue agents with SendMessage) |

## Step 5 — Report in the chat

Keep the report compact. The full detail stays in the JSON.

1. One line: session id (8 chars), branch, window, number of agents.
2. The table from the script. With more than 12 agents, keep the named agents and
   fold the `general-purpose` rows into one line (count, turns, tokens, cost).
3. The parallelism and cost lines. Say `≈` when outputs were estimated.
4. Problems: counts by kind (`re-read · re-ask · scope · skipped`), and the top
   few in one line each. Include only the ones you verified.
5. The action items (≤ 5).
6. The ledger row you appended (Step 6), and the JSON path.

## Step 6 — Append the ledger row

```bash
node "${CLAUDE_SKILL_DIR}/scripts/retro.mjs" <same --session/--since/--until and inputs> \
  --ledger <retro_ledger> --run "<feature or plan name>" --note "<item 1, ≤ 80 chars>"
```

The row records the date, `session@window-start`, branch, run name, agents, wall
time, parallelism peak/avg, tokens, cache hit, cost and the finding counts by kind,
plus the top action. If the ledger does not exist, the script creates it with its
header. If the script says a row for that run already exists, report that and
stop. When the trend says something (cost per agent, cache hit, re-asks going down
or up), compare the new row with the previous ones in the chat.

## Transcript format (what the script relies on)

This is Claude Code's own transcript format, which is not a published contract.
When a version changes the format, the self-test still passes but real runs show
zeros. If that happens, re-check these points:

- Main transcript: `~/.claude/projects/<project path, non-alphanumerics → '-'>/<session>.jsonl`.
  Subagents: `<session>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json`
  (`agentType`, `description`, `toolUseId` = the main session's `Agent` call).
  Plugin agents may appear as `<plugin>:<agent>`. The script strips the prefix
  before looking up a profile.
- One API call is written as several `assistant` lines (one per content block)
  that share `message.id` and repeat `usage`. Count each id once.
- **Subagent output tokens are incomplete.** The main session writes a final line
  (`stop_reason` set) for every call. A subagent often keeps only a mid-stream
  snapshot (`output_tokens` ≈ 16, before thinking and the answer). Input and cache
  fields are complete either way. The script estimates such a call's output as the
  mean of final calls in the same agent (or on the same model). When the session's
  `cost-state` record is fresh, it then scales the estimates per model so that the
  session's output matches the harness's own total. The per-model totals then match
  `cost-state`, but the split between agents on one model stays an estimate.
- Prices: output already includes thinking. A cache write costs 1.25× input
  (5-minute TTL) or 2× input (1-hour TTL), split per call in
  `usage.cache_creation`.
- A human prompt is a `user` line with `origin.kind == "human"`. Task
  notifications have `origin.kind == "task-notification"`.
- A subagent's report is the `message` input of its `SubagentHandback` tool call.
  Each round ends with one. A continuation arrives in the subagent transcript as a
  user string starting `The coordinator sent a message`.
- A denial is an error tool result: `Permission to use <Tool> has been denied…`,
  or `PreToolUse:<Tool> hook error: <hook> (<profile>): <reason>` from a hook the
  project added. The plugins ship no hooks.
- **Writes through Bash** are found by `shell.mjs`. It recognises
  `>`/`>>` redirects, `tee`, `sed -i`, `cp`/`mv` destinations, `touch`, and python
  heredocs whose path reaches `open(…,'w')` (directly, via a variable, or as the
  first argument of a `def sub(p, …)` helper). Heredoc bodies are data: a
  `pnpm test` or a `>` inside one is neither a run nor a redirect. Paths with
  `$VAR`, globs or concatenation are skipped, not guessed, for reads and writes
  alike. A file that the same agent later `rm`s is dropped. Agents often edit this
  way rather than through Edit/Write, so these writes feed every write-based check:
  scope, INSIGHTS reads, unplanned files.
- Agent scope is **not** read from the agent files. Plugin agents ignore
  frontmatter hooks, so the profiles are the static `ROLES` table in `retro.mjs`
  (§ Step 3).

## Change together

- `ROLES` and the scope rules in `retro.mjs` (`isTest`, `isSpec`, `isPlan`,
  `DEFAULT_PROTECTED`) ↔ each agent's `## Hard rules` and `## Inputs` in
  `sdd-engineering`, and the `protected_paths` default in `sdd-engineering:sdd-run`.
- The rule names cited in findings and in Step 4 ↔ `sdd-engineering:sdd-run`
  § Orchestrator rules.
- The ledger columns ↔ `LEDGER_HEADER` and the `row` in `retro.mjs`. An existing
  ledger keeps its header, so append a note to it when you change the columns.

## Self-test

```bash
node --test "${CLAUDE_SKILL_DIR}/scripts/retro.test.mjs"
```

The self-test runs offline. It builds a synthetic session in a throwaway `HOME`
with planted problems:

- a read-only agent writing through the shell
- a spec-creator writing outside the spec dir
- an implementer writing a test and a migration
- an implementer commit
- unread nearest INSIGHTS files (`api/INSIGHTS.md`, and the root one for `web/`)
- serial reviewers and a fresh verifier re-spawn
- a `cd api && cat` re-read
- production files written by a python heredoc and by `cat > f <<EOF`

It also plants non-problems: a heredoc that mentions `pnpm test`, a scratch file
written and then removed, a write in the test-writer's red-proof worktree, a
general-purpose agent touching a lock file, and the main session's commit. It
asserts both kinds, checks that `--spec-dir`, `--protected` and `--tests` change
the verdicts, and checks that the ledger is created once and then refuses a second
row. It also unit-tests `shell.mjs` on command shapes that produced false positives
on real runs. Expected result: `pass 5`, `fail 0`.
