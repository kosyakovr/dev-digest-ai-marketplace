---
name: engineering-insights
description: >-
  Reads and appends to INSIGHTS.md, the non-obvious engineering knowledge carried
  between sessions. Use before the first edit, to read the nearest INSIGHTS.md above
  the files you will touch. Use again on a surprise, a wrong assumption, a workaround,
  a non-obvious decision or a tool quirk, and at the end of a run (sdd-run passes its
  Insight candidates file). Also: "wrap up", "capture learnings", "what did we learn".
---

# Engineering Insights

An `INSIGHTS.md` holds things a future session cannot guess from the code. This
skill has two jobs: **read the file before work, and write to it after.** A third
job matters just as much: **write nothing when there is nothing worth writing.**

## Inputs

| Input | Required | Default |
|---|---|---|
| `insights_files` | no | The nearest `INSIGHTS.md` above the touched files, else the one at the repository root (§ 1). Explicit paths from the caller win. |
| Insight candidates file | no | None. `/sdd-engineering:sdd-run` collects the "Insight candidates" section of every agent report into one file and passes its path. Each candidate still has to pass the gate (§ 3). |
| Touched files | no | The files the task changes. When nobody passes them, use `git diff --name-only HEAD` plus untracked files. |

## 1. Read first — before the first edit

Find the file for each touched path. Start in the path's directory and walk up
toward the repository root (`git rev-parse --show-toplevel`). The first
`INSIGHTS.md` you meet is the one for that path.

| Files touched | File |
|---|---|
| files under one top-level directory | the nearest `INSIGHTS.md` above them. If none exists below the root, use the root one |
| files under two or more top-level directories, or repo-wide tooling, CI or root scripts | `INSIGHTS.md` at the repository root |
| explicit `insights_files` from the caller | those files |

Several directories in scope means reading every file that applies. Treat what you
read as high-confidence guidance unless the user says otherwise. An entry that
contradicts what you observe is a finding: say so, rather than silently picking a
side.

If no file exists yet, there is nothing to read. Do not create one until something
clears the gate (§ 5).

## 2. Capture as you go

Do not wait for the end of the task. The moment something clears the gate below,
write it down. By the end of a long session, the detail is gone.

At the end of an sdd-run, read the Insight candidates file the orchestrator
passes. Put each candidate through the gate like any other finding. A candidate is
an agent's claim, not an entry.

## 3. The gate — five questions, all must pass

1. **Would a future session behave differently knowing this?** No → don't write.
2. **Could anyone reading the code have worked it out?** Yes → don't write.
3. **Is it already in the project's instruction files (CLAUDE.md, AGENTS.md), docs
   or specs?** Yes → don't write.
4. **Is it already in this INSIGHTS.md?** If it is there and still accurate, write
   nothing. If it is there but you learned more, add a new dated line directly
   beneath it, and leave the original line byte-for-byte untouched. Never merge
   your finding into the wording of an existing entry. This is why step 1 is not
   optional.
5. **Can you name the concrete thing: file, flag, table, command, version?**
   No → don't write it yet. Vagueness is worse than silence.

A session where nothing passes the gate is a normal session. Say "nothing worth
capturing" and stop. Volume is not the goal; signal is.

### Specific enough to act on cold

| ❌ Noise | ✅ Insight |
|---|---|
| "Promises can be tricky" | "`Promise.all()` on the ingest pipeline times out past 30 items → use `Promise.allSettled()` in batches of 10." |
| "be careful with async" | "Checkout state always goes through Zustand (`cartStore.ts`) — three components share the cart, local state silently desyncs." |
| "tests are flaky" | "Vitest picks up `*.it.test.ts`, which needs a database → run unit tests with `--exclude '**/*.it.test.ts'`." |

The test: **if it would be obvious to anyone reading the code, don't write it.**

## 4. Where the entry goes

Four rubrics, routed into the file's seven sections:

| Rubric | Section | What it is |
|---|---|---|
| **Pattern** | `## What Works` | An approach that proved out here |
| **Mistake** | `## What Doesn't Work` | A dead end or antipattern. *This is the highest-value section; do not skip it* |
| **Mistake**, seen twice | `## Recurring Errors & Fixes` | The same error hit more than once, plus the fix |
| **Decision** | `## Codebase Patterns` | A convention or design choice **whose reason is not obvious**. If the reason is obvious, or the decision needs a paragraph, it belongs in the project's docs instead |
| **Context** | `## Tool & Library Notes` | A quirk of a dependency, tool or environment |
| — | `## Open Questions` | Something left unresolved, phrased as a question |
| — | `## Session Notes` | See the hard cap below |

**Entry format**, newest first inside its section:

```
- YYYY-MM-DD — <what surprised us> → <what to do instead>. (ref: file:line / PR)
```

One insight per bullet. Atomic beats thorough: long paragraphs get skimmed and
then ignored.

**`## Session Notes` takes one line per session, and only for a session that
produced at least one entry above it.** This section bloats the file first, and
the file may be loaded into every session that works there (for example through an
`@import` in `CLAUDE.md`). Once it passes 5 lines, do not delete anything. Append
as usual, and tell the user the section is due for consolidation (§ 6).

## 5. Write rules — an INSIGHTS.md is append-only

An entry is somebody's hard-won finding, often from another session or another
person. Losing one is worse than never writing yours. These rules are not
stylistic:

- **MUST use `Edit` to insert. MUST NOT use `Write` on an INSIGHTS.md that
  already exists.** Regenerating the file from memory silently drops every entry
  you did not happen to reproduce. `Write` is allowed only to create the file when
  it genuinely does not exist. Create it from the template
  `"${CLAUDE_SKILL_DIR}/templates/INSIGHTS.md"`. Put it at the nearest level that
  covers the touched files: the root for repo-wide findings, or the top-level
  directory the finding belongs to. Fill in the scope line of the header, and keep
  the seven `##` headings as they are.
- **MUST re-read the file immediately before every insertion**, even if you read
  it earlier in the same session. Another session may have appended to it since.
- **MUST NOT modify, reword, reorder, reflow or delete any existing line.** This
  includes your own lines from earlier in the session, the header block and the
  seven `##` headings. Corrections go in as a new dated line beneath the entry
  they correct.
- One `Edit` per entry, inserting at the top of its section. Never rebuild a
  section to "tidy" it.
- **One insight, one file.** Never copy the same entry into two INSIGHTS files. If
  it is genuinely shared, it belongs in the root `INSIGHTS.md`.
- Never write insights into this skill's own files, including the template.

### Verify the write was purely additive

After writing, run `git diff -- <file>` and read it. **Every changed line MUST be a
`+` line.** A single `-` line means something was clobbered. The diff shows its
exact text, so put it back with a targeted `Edit` and redo your insertion more
narrowly. Do not `git checkout` the file: that would also discard uncommitted work
that was never yours.

A newly created file is untracked, so `git diff` shows nothing. Check it against
the template instead: the header and the seven headings unchanged, plus your
entries.

If the file has uncommitted changes from someone else's work, say so and let the
user decide, rather than writing over an unclear state.

Then state in one line what was added and where, so the user can spot-check it.
These files are a draft under review, not truth.

## 6. When a file passes 100 lines — propose, do not act

Consolidation is the only operation that removes text, so the skill never does it
on its own initiative. Keep appending, and give the user a proposal:

1. Duplicate and near-duplicate entries that could merge.
2. Settled knowledge that could move to the project's docs.
3. Entries that look stale or contradict another entry.

Present it as a list the user can read without opening the file. Quote each entry
you would touch and say what would happen to it. **Rewrite the file only after the
user approves in that same turn, and only the entries they approved.** Approval to
consolidate one file is not approval for the others.

Marking an entry in place with `[REVIEW NEEDED]` is an edit to an existing line,
so it needs the same approval.

## Scope

This skill captures engineering knowledge. It does not review code, write
documentation or specs, run tests, or edit the project's instruction files
(`CLAUDE.md`, `AGENTS.md`). Migrations and lock files are off-limits.

Triggering is probabilistic. The skill fires on its description, so sometimes it
will not fire at all. Invoke it by hand at the end of a session:
`/sdd-engineering:engineering-insights`.
