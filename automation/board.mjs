#!/usr/bin/env node
// board - TeaYeah shared task board + result sync between tester A and tester B.
//
// Tasks live as GitHub Issues in this repo (private), one issue per task, labelled with the run.
// Agents publish tasks after GATE 1 and claim them with `board next`; a claim is decided by the
// earliest CLAIM comment, so A and B cannot both take the same task.
// Results (bug evidence packs + record CSVs) are pushed to a separate branch results/<run>
// through a private git worktree in .tb/results, so the working tree is never touched.
//
//   board init                          create labels for this run (once, either tester)
//   board add '<json>'                  publish a task: {"title","type","risk","suggest":"A|B","prio":1-3,"detail"}
//   board list [--all] [--mine]         tasks of this run (default: not done)
//   board next                          claim the best open task (own suggestions first, then the other side's)
//   board claim <#>  |  board done <#> "<summary>"  |  board block <#> "<reason>"  |  board release <#>
//   board sync                          push run/<T> records + bug packs to branch results/<run>
//   board collect                       pull the other tester's records + packs into run/<other>/ (A before /report)
//
// Needs: gh logged in with access to this repo (gh auth status), and run/config.json (tb init).

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = (process.env.TB_TESTER || 'A').toUpperCase();
const OTHER = T === 'A' ? 'B' : 'A';
const RUN = path.join(ROOT, 'run');
const die = (m) => { console.error('ERROR: ' + m); process.exit(1); };
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const myt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(',', '');

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT, ...opts }).trim();
const gh = (args, input) => sh('gh', args, input ? { input } : {});
const ghJson = (args) => JSON.parse(gh(args) || 'null');

const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(RUN, 'config.json'), 'utf8')); } catch { return null; } })();
// The run id must be identical on both machines: date (MYT) + SUT host
const RUN_ID = process.env.TB_RUN || (cfg ? `${myt().slice(0, 10).replace(/-/g, '')}-${new URL(cfg.sutUrl).host.replace(/[^a-z0-9]+/gi, '-')}` : null);
const REPO = process.env.TB_BOARD_REPO || (() => { try { const u = sh('git', ['remote', 'get-url', 'origin']); const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(u); return m && m[1]; } catch { return null; } })();
const LBL = { run: `run:${RUN_ID}`, task: 'tb-task', open: 'status:open', claimed: 'status:claimed', done: 'status:done', blocked: 'status:blocked' };

const [cmd, a1, a2] = process.argv.slice(2);
const flags = new Set(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x) => x.slice(2)));
if (!cmd || cmd === 'help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 21).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
if (!RUN_ID) die('run/config.json missing - run ./tb init <SUT_URL> first (both testers, same URL)');
if (!REPO) die('cannot find the GitHub repo from git remote origin (or set TB_BOARD_REPO=owner/name)');

const R = ['-R', REPO];
const labelsOf = (i) => i.labels.map((l) => l.name);
const label = (i, prefix) => (labelsOf(i).find((l) => l.startsWith(prefix)) || '').slice(prefix.length);
function tasks(state = 'open') {
  return ghJson(['issue', 'list', ...R, '--label', LBL.task, '--label', LBL.run, '--state', state, '--limit', '200', '--json', 'number,title,labels,body,state,updatedAt']) || [];
}
const fmt = (i) => `#${i.number} [${label(i, 'status:') || '?'}${label(i, 'owner:') ? ' ' + label(i, 'owner:') : ''}] P${label(i, 'prio:') || '?'} ${label(i, 'type:')} ${label(i, 'risk:') ? label(i, 'risk:') + ' ' : ''}(suggest ${label(i, 'suggest:') || '-'}) ${i.title}`;
function setLabels(n, add, remove) {
  const args = ['issue', 'edit', String(n), ...R];
  for (const a of add) args.push('--add-label', a);
  for (const r of remove) args.push('--remove-label', r);
  gh(args);
}
const comment = (n, body) => gh(['issue', 'comment', String(n), ...R, '--body', body]);
function comments(n) { return (ghJson(['issue', 'view', String(n), ...R, '--json', 'comments']) || { comments: [] }).comments; }

function claim(n) {
  const i = ghJson(['issue', 'view', String(n), ...R, '--json', 'number,title,labels,body,state']);
  if (!i || i.state !== 'OPEN' || !labelsOf(i).includes(LBL.open)) return { ok: false, why: `#${n} is not open (${label(i || { labels: [] }, 'status:')})` };
  const token = `CLAIM ${T} ${Date.now()}`;
  comment(n, token);
  sleep(2500); // let a simultaneous claim from the other tester land
  const cs = comments(n);
  const lastRelease = cs.map((c, k) => (/^RELEASE /.test(c.body) ? k : -1)).reduce((a, b) => Math.max(a, b), -1);
  const first = cs.slice(lastRelease + 1).find((c) => /^CLAIM [AB] \d+/.test(c.body));
  if (!first || first.body !== token) { comment(n, `YIELD ${T}: ${first ? first.body.split(' ')[1] : '?'} claimed first`); return { ok: false, why: `#${n} lost the claim race to ${first ? first.body.split(' ')[1] : 'someone'}` }; }
  setLabels(n, [LBL.claimed, `owner:${T}`], [LBL.open, LBL.blocked]);
  return { ok: true, issue: i };
}
const printTask = (i) => { console.log(`CLAIMED by ${T}: ${fmt({ ...i, labels: [{ name: LBL.claimed }, { name: 'owner:' + T }, ...i.labels.filter((l) => !l.name.startsWith('status:') && !l.name.startsWith('owner:'))] })}`); console.log(i.body); };

switch (cmd) {
  case 'init': {
    const mk = [[LBL.task, '5319e7', 'TeaYeah task'], [LBL.run, '0e8a16', 'competition run'], [LBL.open, 'c2e0c6', ''], [LBL.claimed, 'fbca04', ''], [LBL.done, '0e8a16', ''], [LBL.blocked, 'b60205', ''],
      ['owner:A', '1d76db', ''], ['owner:B', '5319e7', ''], ['suggest:A', 'bfdadc', ''], ['suggest:B', 'bfdadc', ''], ['prio:1', 'b60205', ''], ['prio:2', 'fbca04', ''], ['prio:3', 'c5def5', ''],
      ...['design', 'execute', 'explore', 'nfr', 'roles', 'retest', 'other'].map((t) => [`type:${t}`, 'ededed', ''])];
    for (const [n, c, d] of mk) gh(['label', 'create', n, ...R, '--color', c, '--description', d, '--force']);
    console.log(`board ready: repo ${REPO}, run ${RUN_ID} (labels created)`);
    break;
  }
  case 'add': {
    let t; try { t = JSON.parse(a1 || ''); } catch { die(`usage: board add '{"title":"Test R-01 cart totals","type":"execute","risk":"R-01","suggest":"A","prio":1,"detail":"cases TC-A01..A06; start /cart"}'`); }
    if (!t.title) die('task needs a title');
    const type = ['design', 'execute', 'explore', 'nfr', 'roles', 'retest'].includes(t.type) ? t.type : 'other';
    const labels = [LBL.task, LBL.run, LBL.open, `type:${type}`, `prio:${[1, 2, 3].includes(Number(t.prio)) ? Number(t.prio) : 2}`];
    if (t.suggest === 'A' || t.suggest === 'B') labels.push(`suggest:${t.suggest}`);
    if (t.risk) { const rl = `risk:${t.risk}`; gh(['label', 'create', rl, ...R, '--color', 'f9d0c4', '--force']); labels.push(rl); }
    const body = [`**Run** ${RUN_ID} | published by ${T} at ${myt()} MYT`, '', t.detail || '', '', '_Claim with `./board next` or `./board claim <#>`. Finish with `./board done <#> "summary"`._'].join('\n');
    const url = gh(['issue', 'create', ...R, '--title', t.title, '--body', body, ...labels.flatMap((l) => ['--label', l])]);
    console.log(`published ${url.split('/').pop() ? '#' + url.split('/').pop() : url}: ${t.title}`);
    break;
  }
  case 'list': {
    let list = tasks(flags.has('all') ? 'all' : 'open');
    if (flags.has('mine')) list = list.filter((i) => label(i, 'owner:') === T);
    if (!list.length) { console.log(`(no ${flags.has('all') ? '' : 'open '}tasks in run ${RUN_ID})`); break; }
    const order = { open: 0, claimed: 1, blocked: 2, done: 3 };
    list.sort((x, y) => (order[label(x, 'status:')] ?? 9) - (order[label(y, 'status:')] ?? 9) || Number(label(x, 'prio:') || 2) - Number(label(y, 'prio:') || 2) || x.number - y.number);
    for (const i of list) console.log(fmt(i));
    console.log(`(${list.length} tasks; repo ${REPO}; run ${RUN_ID})`);
    break;
  }
  case 'next': {
    const open = tasks('open').filter((i) => labelsOf(i).includes(LBL.open));
    const score = (i) => (label(i, 'suggest:') === T ? 0 : label(i, 'suggest:') ? 2 : 1) * 10 + Number(label(i, 'prio:') || 2);
    open.sort((x, y) => score(x) - score(y) || x.number - y.number);
    if (!open.length) { console.log('NO OPEN TASKS. Check `board list` (claimed/blocked), run /status, or ask the human.'); break; }
    for (const i of open) { const r = claim(i.number); if (r.ok) { printTask(r.issue); process.exit(0); } console.log(r.why); }
    console.log('could not claim any task (all taken meanwhile). Run board next again.');
    break;
  }
  case 'claim': { const r = claim(Number(a1)); if (!r.ok) die(r.why); printTask(r.issue); break; }
  case 'done': case 'block': case 'release': {
    const n = Number(a1); if (!n) die(`usage: board ${cmd} <#> "<text>"`);
    if (cmd === 'done') { comment(n, `DONE ${T} ${myt()} MYT: ${a2 || ''}`); setLabels(n, [LBL.done], [LBL.claimed, LBL.open, LBL.blocked]); gh(['issue', 'close', String(n), ...R]); }
    if (cmd === 'block') { comment(n, `BLOCKED ${T} ${myt()} MYT: ${a2 || ''}`); setLabels(n, [LBL.blocked], [LBL.claimed, LBL.open]); }
    if (cmd === 'release') { comment(n, `RELEASE ${T} ${myt()} MYT: ${a2 || ''}`); setLabels(n, [LBL.open], [LBL.claimed, LBL.blocked, `owner:${T}`]); }
    console.log(`#${n} ${cmd === 'done' ? 'done and closed' : cmd === 'block' ? 'blocked (needs a human)' : 'released back to open'}`);
    break;
  }
  case 'sync': case 'collect': {
    const WT = path.join(ROOT, '.tb', 'results');
    const BR = `results/${RUN_ID}`;
    const git = (args, cwd = WT) => sh('git', args, { cwd });
    try { git(['fetch', 'origin', BR], ROOT); } catch { /* branch does not exist yet */ }
    if (!fs.existsSync(path.join(WT, '.git'))) {
      let remote = false; try { git(['rev-parse', '--verify', `origin/${BR}`], ROOT); remote = true; } catch {}
      if (remote) git(['worktree', 'add', '-B', BR, WT, `origin/${BR}`], ROOT);
      else {
        git(['worktree', 'add', '--detach', WT, 'HEAD'], ROOT);
        git(['checkout', '--orphan', BR]); git(['rm', '-rf', '--quiet', '.']);
        fs.writeFileSync(path.join(WT, 'README.md'), `# Results for run ${RUN_ID}\n\nWritten by ./board sync from tester A and tester B. Do not edit by hand.\n`);
        git(['add', 'README.md']); git(['commit', '-q', '-m', `Start results for run ${RUN_ID}`]);
      }
    }
    try { git(['pull', '-q', '--rebase', 'origin', BR]); } catch { /* first push */ }
    if (cmd === 'sync') {
      const src = path.join(RUN, T); if (!fs.existsSync(src)) die(`nothing to sync: run/${T} missing`);
      const dst = path.join(WT, T); fs.rmSync(dst, { recursive: true, force: true }); fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) if (f.endsWith('.csv')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      if (fs.existsSync(path.join(src, 'bugs'))) fs.cpSync(path.join(src, 'bugs'), path.join(dst, 'bugs'), { recursive: true });
      if (T === 'A' && fs.existsSync(path.join(RUN, 'risks.csv'))) fs.copyFileSync(path.join(RUN, 'risks.csv'), path.join(WT, 'risks.csv'));
      for (const f of ['recon.md', 'test-plan.md']) if (fs.existsSync(path.join(RUN, f)) && T === 'A') fs.copyFileSync(path.join(RUN, f), path.join(WT, f));
      git(['add', '-A']);
      let changed = true; try { git(['diff', '--cached', '--quiet']); changed = false; } catch {}
      if (!changed) { console.log('nothing new to sync'); break; }
      git(['commit', '-q', '-m', `Sync tester ${T} results ${myt()} MYT\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`]);
      for (let k = 0; k < 4; k++) {
        try { git(['push', '-q', 'origin', `HEAD:${BR}`]); console.log(`synced run/${T} (records + bug packs) to branch ${BR}`); process.exit(0); }
        catch { sleep(1000 + Math.random() * 1000); try { git(['pull', '-q', '--rebase', 'origin', BR]); } catch {} }
      }
      die('push failed 4 times - check gh/git login and retry ./board sync');
    } else {
      const src = path.join(WT, OTHER);
      if (!fs.existsSync(src)) die(`no results from tester ${OTHER} on ${BR} yet (ask them to run ./board sync)`);
      const dst = path.join(RUN, OTHER); fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) if (f.endsWith('.csv')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      if (fs.existsSync(path.join(src, 'bugs'))) fs.cpSync(path.join(src, 'bugs'), path.join(dst, 'bugs'), { recursive: true });
      if (T !== 'A' && fs.existsSync(path.join(WT, 'risks.csv'))) fs.copyFileSync(path.join(WT, 'risks.csv'), path.join(RUN, 'risks.csv'));
      const packs = fs.existsSync(path.join(dst, 'bugs')) ? fs.readdirSync(path.join(dst, 'bugs')).filter((d) => /^D-/.test(d) && fs.statSync(path.join(dst, 'bugs', d)).isDirectory()) : [];
      console.log(`collected tester ${OTHER}: ${fs.readdirSync(src).filter((f) => f.endsWith('.csv')).length} record files, ${packs.length} bug packs (${packs.join(', ') || '-'}) into run/${OTHER}/. ./rec stats now covers both testers.`);
    }
    break;
  }
  default: die(`unknown command ${cmd}. Run: board help`);
}
