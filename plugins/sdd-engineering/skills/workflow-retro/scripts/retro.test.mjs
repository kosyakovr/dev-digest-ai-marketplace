// Self-test for retro.mjs: a synthetic session with planted problems, each detector
// asserted both ways (a planted hit must appear, a planted non-hit must not).
//   node --test "${CLAUDE_SKILL_DIR}/scripts/retro.test.mjs"
// (pass the file, not the directory: a bare directory argument fails on recent Node)
// Offline. Runs in a throwaway HOME; touches nothing in the repo or ~/.claude.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripHeredocs, shellWrites, shellRemovals, bashReads, isFullSuiteRun, isPushOrPr, isCommit } from './shell.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'retro.mjs');
const T0 = Date.parse('2026-10-01T10:00:00Z');
const at = (min) => new Date(T0 + min * 60_000).toISOString();

const usage = { input_tokens: 2, output_tokens: 100, cache_read_input_tokens: 9000, cache_creation_input_tokens: 1000, cache_creation: { ephemeral_5m_input_tokens: 1000, ephemeral_1h_input_tokens: 0 } };
let n = 0;
const asst = (min, content, model = 'claude-sonnet-5-5', final = true) => ({ type: 'assistant', timestamp: at(min), message: { id: `msg_${++n}`, model, stop_reason: final ? 'tool_use' : null, usage: final ? usage : { ...usage, output_tokens: 16 }, content } });
const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
const res = (min, id, text, err = false) => ({ type: 'user', timestamp: at(min), message: { content: [{ type: 'tool_result', tool_use_id: id, content: text, is_error: err }] } });
const human = (min, text) => ({ type: 'user', origin: { kind: 'human' }, timestamp: at(min), message: { content: text } });
const handback = (min, id, msg) => asst(min, [use(id, 'SubagentHandback', { message: msg })]);

function fixture() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-retro-test-'));
  const proj = path.join(home, 'proj');
  const P = (r) => path.join(proj, r);
  // The nearest INSIGHTS.md: api/ has its own, web/ falls back to the root one.
  fs.mkdirSync(P('api'), { recursive: true });
  fs.writeFileSync(P('INSIGHTS.md'), '# Insights\n');
  fs.writeFileSync(P('api/INSIGHTS.md'), '# Insights — api\n');
  // No ledger file: the script creates it with its header on first use.

  const sid = 'aaaaaaaa-0000-0000-0000-000000000001';
  const tdir = path.join(home, '.claude', 'projects', proj.replace(/[^A-Za-z0-9]/g, '-'));
  fs.mkdirSync(path.join(tdir, sid, 'subagents'), { recursive: true });
  const write = (f, entries) => fs.writeFileSync(f, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const spawn = (min, id, type, prompt = 'go') => asst(min, [use(id, 'Agent', { subagent_type: type, description: type, prompt, run_in_background: true })], 'claude-opus-5-5');

  write(path.join(tdir, `${sid}.jsonl`), [
    human(0, 'build feature X'),
    spawn(0.2, 'sp0', 'sdd-engineering:spec-creator'),
    spawn(1, 'sp1', 'sdd-engineering:implementation-planner', 'x'.repeat(9000)), // planted: >8k delegation prompt
    spawn(12, 'sp2', 'sdd-engineering:implementer'),                             // planted: no human turn after the plan
    spawn(30, 'sp3', 'sdd-engineering:test-writer'),
    spawn(45, 'sp4', 'sdd-engineering:plan-verifier'),
    spawn(52, 'sp5', 'architecture-review:architecture-reviewer'),             // planted: reviewers run one after another
    spawn(60, 'sp6', 'sdd-engineering:plan-verifier'),                           // planted: verifier spawned fresh twice
    spawn(65, 'sp7', 'general-purpose'),
    asst(70, [use('m1', 'Read', { file_path: `/tmp/claude-501/x/${sid}/tasks/abc.output` })], 'claude-opus-5-5'), // planted: report read into main
    res(70, 'm1', 'report text'),
    // non-hit: a scratch source file, removed in the same command (no INSIGHTS finding for main)
    asst(71, [use('m2', 'Bash', { command: 'printf "x" > web/src/tmp.ts && rm web/src/tmp.ts' })], 'claude-opus-5-5'),
    res(71, 'm2', ''),
    // non-hit: the main session commits on the user's word
    asst(72, [use('m3', 'Bash', { command: 'git commit -m "feature X"' })], 'claude-opus-5-5'),
    res(72, 'm3', ''),
  ]);
  const sub = (id, type, toolUseId, entries) => {
    write(path.join(tdir, sid, 'subagents', `agent-${id}.jsonl`), [{ type: 'user', timestamp: entries[0].timestamp, message: { content: 'task' } }, ...entries]);
    fs.writeFileSync(path.join(tdir, sid, 'subagents', `agent-${id}.meta.json`), JSON.stringify({ agentType: type, toolUseId }));
  };
  sub('aspec0000001', 'sdd-engineering:spec-creator', 'sp0', [
    asst(0.3, [use('s1', 'Write', { file_path: P('docs/specs/feature-x.md') })], 'claude-opus-5-5'), res(0.3, 's1', 'ok'), // non-hit: its own spec, and not "docs changed"
    asst(0.4, [use('s2', 'Edit', { file_path: P('web/src/app/page.tsx') })], 'claude-opus-5-5'), res(0.4, 's2', 'ok'),       // planted: outside the spec dir
    handback(0.8, 's3', '# Spec Report: X\nStatus: ready to plan'),
  ]);
  sub('aplanner0001', 'sdd-engineering:implementation-planner', 'sp1', [
    asst(2, [use('p1', 'Read', { file_path: P('api/INSIGHTS.md') })], 'claude-opus-5-5'), res(2, 'p1', 'insights'),
    asst(3, [use('p2', 'Read', { file_path: P('api/src/modules/a/service.ts') })], 'claude-opus-5-5'), res(3, 'p2', 'S'.repeat(4000)),
    handback(10, 'p3', '# Plan\nWP1: `api/src/modules/a/service.ts`'),
  ]);
  sub('aimplem00001', 'sdd-engineering:implementer', 'sp2', [
    asst(13, [use('i1', 'Bash', { command: 'cd api && cat src/modules/a/service.ts' })]), res(13, 'i1', 'S'.repeat(4000)), // same file via cd
    asst(14, [use('i2', 'Edit', { file_path: P('api/src/modules/a/service.ts') })]), res(14, 'i2', 'ok'), // planted: api/INSIGHTS.md not read
    asst(15, [use('i3', 'Edit', { file_path: P('api/migrations/0003_add.sql') })], 'claude-sonnet-5-5', false), res(15, 'i3', 'ok'), // planted: protected, unplanned; partial usage line
    asst(16, [use('i4', 'Write', { file_path: P('api/test/a.test.ts') })]), res(16, 'i4', 'ok'), // planted: implementer wrote a test
    // planted: two production files written through the shell; the heredoc bodies mention
    // `pnpm test` and a `>` that are data, not a test run or a redirect
    asst(17, [use('i6', 'Bash', { command: "cd api && python3 - <<'EOF'\np='src/modules/b/x.ts'\ns=open(p).read()\nopen(p,'w').write(s)\nprint('pnpm test')\nEOF" })]), res(17, 'i6', ''),
    asst(18, [use('i7', 'Bash', { command: "cat > web/src/lib/y.ts <<'EOF'\nexport const a = 1 > 0;\nEOF" })]), res(18, 'i7', ''), // planted: web/ edit, root INSIGHTS.md never read
    asst(19, [use('i8', 'Bash', { command: 'git add -A && git commit -m wip' })]), res(19, 'i8', ''), // planted: an agent committed
    handback(20, 'i5', '# Report\n## Insight candidates\n- the cache key ignores tenant\n## Done'),
  ]);
  sub('atestwr00001', 'sdd-engineering:test-writer', 'sp3', [
    asst(31, [use('t1', 'Bash', { command: 'cd api && head -40 INSIGHTS.md' })]), res(31, 't1', 'insights'), // the nearest INSIGHTS.md, read through cd
    asst(32, [use('t2', 'Read', { file_path: P('api/src/modules/a/service.ts') })]), res(32, 't2', 'S'.repeat(4000)),
    asst(33, [use('t3', 'Bash', { command: 'echo x > /tmp/f' })]), res(33, 't3', 'Permission to use Bash has been denied.', true), // planted: denial
    asst(34, [use('t4', 'Write', { file_path: P('api/test/a.test.ts') })]), res(34, 't4', 'ok'), // non-hit: test-writer writing a test
    asst(35, [use('t6', 'Write', { file_path: '/tmp/sdd-redproof-1a2b/api/src/modules/a/service.ts' })]), res(35, 't6', 'ok'), // non-hit: red-proof worktree
    handback(40, 't5', '# Test Report'),
  ]);
  sub('averif000001', 'sdd-engineering:plan-verifier', 'sp4', [
    asst(46, [use('v1', 'Bash', { command: 'git diff > /tmp/d.txt' })], 'claude-opus-5-5'), res(46, 'v1', ''), // planted: read-only agent wrote through Bash
    handback(50, 'v2', 'NEEDS CLARIFICATION\n1. which plan?'),                                                 // planted: re-ask
  ]);
  sub('aarch0000001', 'architecture-review:architecture-reviewer', 'sp5', [
    asst(53, [use('r1', 'Bash', { command: 'git diff --stat 2>/dev/null' })], 'claude-opus-5-5'), res(53, 'r1', 'stat'), // non-hit: no write
    handback(58, 'r2', '# Architecture Review\nclean'),
  ]);
  sub('averif000002', 'sdd-engineering:plan-verifier', 'sp6', [handback(62, 'w1', '# Plan Verification\nPASS')]);
  sub('ageneral0001', 'general-purpose', 'sp7', [
    asst(66, [use('g1', 'Edit', { file_path: P('api/src/z.ts') })], 'claude-opus-5-5'), res(66, 'g1', 'ok'), // non-hit: no profile → no scope or INSIGHTS check
    asst(66.5, [use('g3', 'Edit', { file_path: P('pnpm-lock.yaml') })], 'claude-opus-5-5'), res(66.5, 'g3', 'ok'), // non-hit: not even a protected path
    handback(67, 'g2', 'done'),
  ]);
  return { home, proj, sid };
}

function run(fx, extra = []) {
  const out = execFileSync(process.execPath, [SCRIPT, '--session', fx.sid, '--project', fx.proj, '--json', path.join(fx.home, 'r.json'), ...extra],
    { env: { ...process.env, HOME: fx.home, CLAUDE_CODE_SESSION_ID: '' }, encoding: 'utf8' });
  const json = JSON.parse(fs.readFileSync(path.join(fx.home, 'r.json'), 'utf8'));
  const titles = json.findings.map((f) => `[${f.severity}] ${f.kind}: ${f.title}`);
  const has = (re) => assert.ok(titles.some((t) => re.test(t)), `missing ${re}\n${titles.join('\n')}`);
  const hasNot = (re) => assert.ok(!titles.some((t) => re.test(t)), `unexpected ${re}\n${titles.join('\n')}`);
  const evidence = (re) => json.findings.find((f) => re.test(f.title))?.evidence ?? '';
  return { out, json, has, hasNot, evidence };
}

test('planted problems are found, planted non-problems are not', () => {
  const fx = fixture();
  const { has, hasNot, evidence } = run(fx);

  has(/\[crit\] scope: implementer#\w+ wrote outside its scope \(implementer\)/);
  assert.match(evidence(/implementer#\w+ wrote outside/), /api\/migrations\/0003_add\.sql \(protected path\)/);
  assert.match(evidence(/implementer#\w+ wrote outside/), /api\/test\/a\.test\.ts \(implementer wrote a test\)/);
  has(/\[crit\] scope: implementer#\w+ committed or pushed/);
  has(/\[crit\] scope: plan-verifier#averi wrote outside its scope \(read-only\)/);
  has(/\[crit\] scope: spec-creator#\w+ wrote outside its scope \(spec-creator\)/);
  assert.match(evidence(/spec-creator#\w+ wrote outside/), /web\/src\/app\/page\.tsx \(spec-creator wrote outside docs\/specs\/\)/);
  assert.doesNotMatch(evidence(/spec-creator#\w+ wrote outside/), /feature-x\.md/);
  has(/\[warn\] scope: test-writer#\w+: 1 denied call/);
  has(/\[info\] scope: implementer#\w+ edited 4 file\(s\) the plan does not name/); // migration, a.test.ts + the two shell writes
  has(/\[warn\] scope: implementer#\w+ wrote 2 project file\(s\) through the shell \(3 via Edit\/Write\)/);
  // exactly these two — a `>` inside a heredoc body must not count as a write to "0;"
  assert.match(evidence(/through the shell/), /^api\/src\/modules\/b\/x\.ts, web\/src\/lib\/y\.ts — /);
  has(/\[warn\] skipped: implementer#\w+ edited api\/ without reading api\/INSIGHTS\.md first/);
  has(/\[warn\] skipped: implementer#\w+ edited files under the root without reading INSIGHTS\.md first/); // web/ has none → root; seen only through the shell write
  has(/\[warn\] skipped: INSIGHTS\.md not updated although agents reported Insight candidates/);
  has(/\[info\] skipped: code changed but no docs changed/);
  has(/\[warn\] skipped: implementer launched with no user turn after the plan/);
  has(/\[warn\] skipped: plan-verifier spawned fresh 2×/);
  has(/\[warn\] parallel: plan-verifier, architecture-reviewer ran one after another/);
  has(/\[warn\] re-ask: plan-verifier#averi: 1 hand-back\(s\), 0 continuation\(s\), NEEDS CLARIFICATION/);
  has(/\[info\] skipped: implementation-planner#\w+ got a 9k-char delegation prompt/);
  has(/\[info\] skipped: main session read an agent transcript\/report directly/);
  has(/\[info\] re-read: api\/src\/modules\/a\/service\.ts read 3× by 3 thread/); // the `cd api && cat src/...` read resolves to the same file

  hasNot(/scope: test-writer#\w+ wrote outside/);       // its test file and its red-proof worktree
  hasNot(/test-writer#\w+ edited .* without reading/);  // read api/INSIGHTS.md through `cd api && head`
  hasNot(/architecture-reviewer#\w+/);
  hasNot(/general-purpose#\w+/);                        // no profile: reads, denials and cost only
  hasNot(/main (edited|committed)/);                    // scratch file removed; main commits on the user's word
  hasNot(/implementer spawned fresh/);
  hasNot(/whole-suite/);                                // `pnpm test` appears only inside a heredoc
  hasNot(/no spec under/);                              // the spec-creator wrote docs/specs/feature-x.md
  hasNot(/web\/src\/tmp\.ts/);                          // written and removed → not a change
});

test('inputs: --spec-dir, --protected and --tests change the scope', () => {
  const fx = fixture();
  const { has, evidence } = run(fx, ['--spec-dir', 'specs/', '--protected', '^api/src/modules/b/', '--tests', '\\.check\\.ts$']);
  // docs/specs is no longer the spec dir → the spec-creator's own spec is outside it, and no spec was seen
  assert.match(evidence(/spec-creator#\w+ wrote outside/), /docs\/specs\/feature-x\.md \(spec-creator wrote outside specs\/\)/);
  has(/\[info\] skipped: code changed but no spec under specs\/ was read or written/);
  // the extra protected path adds to the defaults
  assert.match(evidence(/implementer#\w+ wrote outside/), /api\/src\/modules\/b\/x\.ts \(protected path, via shell\)/);
  assert.match(evidence(/implementer#\w+ wrote outside/), /api\/migrations\/0003_add\.sql \(protected path\)/);
  // a.test.ts is no longer a test → the implementer may write it, the test-writer may not
  assert.doesNotMatch(evidence(/implementer#\w+ wrote outside/), /a\.test\.ts/);
  assert.match(evidence(/test-writer#\w+ wrote outside/), /api\/test\/a\.test\.ts \(test-writer wrote a non-test file\)/);
});

test('shell.mjs: heredoc bodies are data; writes, suite runs and commits are recognised', () => {
  const R = '/repo';
  assert.equal(stripHeredocs("cat > a.ts <<'EOF'\nx > y\nEOF\necho done").bare, 'cat > a.ts __HEREDOC_0__\necho done');
  const w = (cmd) => shellWrites(cmd, R);
  assert.deepEqual(w("cat > a/b.ts <<'EOF'\nconst x = 1 > 0;\nEOF"), ['/repo/a/b.ts']);
  assert.deepEqual(w("cd api && python3 - <<'EOF'\np='src/x.ts'\nopen(p,'w').write('')\nEOF"), ['/repo/api/src/x.ts']);
  assert.deepEqual(w("python3 - <<'EOF'\nprint(open('src/x.ts').read())\nEOF"), []); // read only
  assert.deepEqual(w("pnpm test 2>&1 | tail -5; echo hi > /dev/null"), []);
  assert.deepEqual(w("sed -i '' 's/a/b/' docs/x.md"), ['/repo/docs/x.md']);
  assert.deepEqual(w("sed -i 's/a/b/' app/models.py"), ['/repo/app/models.py']);
  assert.deepEqual(w('git diff > /tmp/d.txt'), ['/tmp/d.txt']);
  assert.deepEqual(w('grep -n "a > b" f.ts'), []); // quoted `>` is a pattern
  assert.deepEqual(w('cp /tmp/sdd-redproof-1/x.ts api/src/x.ts'), ['/repo/api/src/x.ts']);
  // python: only paths that reach open(…,'w') are writes
  assert.deepEqual(w("python3 - <<'EOF'\nspec=[{'file':'src/lib/hooks/blast.ts'}]\nopen('/tmp/sdd-redproof-1/spec.json','w').write(str(spec))\nEOF"), ['/tmp/sdd-redproof-1/spec.json']);
  assert.deepEqual(w("python3 - <<'EOF'\np='a.ts'\nadd=\"import x from '../platform/prompt-log.js'\"\nopen(p,'w').write(add)\nEOF"), ['/repo/a.ts']);
  assert.deepEqual(w("python3 - <<'EOF'\ndef sub(p, a, b):\n    s=open(p).read()\n    open(p,'w').write(s.replace(a,b))\nsub('src/x.ts','a','b')\nsub(\"src/y.ts\",'a','b')\nEOF"), ['/repo/src/x.ts', '/repo/src/y.ts']);
  assert.deepEqual(w("python3 - <<'EOF'\ndef sub(p,a,b):\n    open(p,'w').write(open(p).read().replace(a,b))\nD='app/_components/'\nsub('app/_components/' + 'Card.tsx','a','b')\nsub(D+'List.tsx','a','b')\nEOF"), []); // concatenated prefixes are skipped
  assert.deepEqual(w('cp a.ts $W/api/src/a.ts'), []); // unresolvable → skipped, not guessed
  assert.deepEqual(w('cp /tmp/x/Card.tsx "web/src/[id]/_components"'), ['/repo/web/src/[id]/_components/Card.tsx']); // into a directory
  assert.deepEqual(shellRemovals('mkdir -p d && printf "x" > d/f.ts && rm -r d', R), ['/repo/d']);
  assert.deepEqual(bashReads("python3 - <<'EOF'\ncat x.ts\nEOF", R), []);
  assert.deepEqual(bashReads('cd web && sed -n 1,20p src/a.tsx', R), ['/repo/web/src/a.tsx']);
  assert.deepEqual(bashReads('cd api && head -40 INSIGHTS.md', R), ['/repo/api/INSIGHTS.md']);
  assert.deepEqual(bashReads('cat "$D/guide.md" $D/x.md docs/*.md', R), []); // unresolvable → skipped, not guessed
  assert.equal(isFullSuiteRun('cd web && pnpm typecheck 2>&1 | tail -15'), true);
  assert.equal(isFullSuiteRun('cd api && npm run test'), true);
  assert.equal(isFullSuiteRun('yarn lint'), true);
  assert.equal(isFullSuiteRun('pnpm exec vitest run test/a.test.ts'), false);
  assert.equal(isFullSuiteRun("python3 - <<'EOF'\n# pnpm test\nEOF"), false);
  assert.equal(isFullSuiteRun('echo "pnpm test"'), false);
  // a push or commit is the command word, never text that mentions one
  assert.equal(isPushOrPr('git push -u origin feature'), true);
  assert.equal(isPushOrPr('git -C /repo push'), true);
  assert.equal(isPushOrPr('git commit -m x && git push'), true);
  assert.equal(isPushOrPr('gh pr create --fill'), true);
  assert.equal(isPushOrPr(`grep -n 'echo "git push"' docs/release.md`), false);
  assert.equal(isPushOrPr("cat > a.md <<'EOF'\nthen git push\nEOF"), false);
  assert.equal(isPushOrPr('git log --oneline -3'), false);
  assert.equal(isCommit('git add -A && git commit -m wip'), true);
  assert.equal(isCommit('git -C /repo commit --amend --no-edit'), true);
  assert.equal(isCommit('grep -rn "git commit" docs'), false);
  assert.equal(isCommit('git log --format=%H -1'), false);
});

test('metrics: partial usage lines are estimated, cost and parallelism are computed', () => {
  const fx = fixture();
  const { json } = run(fx);
  const impl = json.agents.find((a) => a.role === 'implementer');
  assert.equal(impl.type, 'sdd-engineering:implementer');
  assert.equal(impl.profile, 'implementer');
  assert.equal(json.agents.find((a) => a.type === 'general-purpose').profile, 'none');
  assert.equal(impl.turns, 8);               // 7 tool calls + the hand-back
  assert.equal(impl.estimatedCalls, 1);      // the call with a mid-stream usage line only
  assert.equal(impl.usage.out, 800);         // 7 final × 100 + 1 estimated at their mean
  // sonnet-5-5: 8×2×$2 + 800×$10 + 8×9000×$0.20 + 8×1000×$2.50 (5-minute write = 1.25×), per 1M tokens
  assert.ok(Math.abs(impl.cost - (32 + 8000 + 14400 + 20000) / 1e6) < 1e-9, String(impl.cost));
  assert.equal(json.parallel.peak, 1);       // the fixture runs every agent alone
});

test('ledger: created with its header on first use, one row per run, never twice', () => {
  const fx = fixture();
  const ledger = path.join(fx.proj, 'docs/retros/ledger.md');
  assert.equal(fs.existsSync(ledger), false);
  const first = run(fx, ['--ledger', '--run', 'feature X', '--note', 'implementer § Hard rules → x']); // bare --ledger = the default path
  assert.match(first.out, /ledger: appended to docs\/retros\/ledger\.md \(created with its header\)/);
  const src = fs.readFileSync(ledger, 'utf8');
  assert.match(src, /^# Workflow retro ledger\n/);
  assert.match(src, /\| Date \| Run key \| Branch \| Run \| Agents \|/);
  const second = run(fx, ['--ledger', 'docs/retros/ledger.md']);
  assert.match(second.out, /already exists/);
  const rows = fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => l.includes('`aaaaaaaa@'));
  assert.equal(rows.length, 1);
  assert.match(rows[0], /\| feature X \| 8 \|/); // 8 spawns, spec-creator and general-purpose included
  assert.match(rows[0], /implementer § Hard rules → x \|$/);
  // a custom path works too, and nothing else is written
  run(fx, ['--ledger', 'retro/runs.md', '--run', 'feature X']);
  assert.ok(fs.existsSync(path.join(fx.proj, 'retro/runs.md')));
});
