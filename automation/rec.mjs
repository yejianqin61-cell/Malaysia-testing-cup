#!/usr/bin/env node
// rec - TeaYeah record keeper. Agents write test records through this (JSON in, validated CSV out)
// instead of editing CSV by hand. Columns and allowed values match competition-day/06-TeaYeah-workbook.xlsx.
//
//   rec add cases '{"feature":"Login","risk_id":"R-01",...}'      -> prints new id (TC-A01)
//   rec update defects D-A02 '{"status":"Verified","repro":"3/3"}'
//   rec list defects [--status Suspected] [--full]     rec get cases TC-A03
//   rec stats                                          numbers for the summary report (both testers)
//   rec copy <sheet>                                   TSV to clipboard -> Ctrl+V into Google Sheets
//   rec import <sheet> <file.tsv|csv|->                rows copied from Google Sheets (e.g. shared risks)
//   rec import-nfr automation/out/<run>/nonfunctional.csv   add run-checks.mjs rows with new ids
//
// Tester: env TB_TESTER=A|B. Files: run/<T>/<sheet>.csv ; risks are shared in run/risks.csv.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = (process.env.TB_TESTER || 'A').toUpperCase();
const RUN = path.join(ROOT, 'run');

const SHEETS = {
  risks: {
    title: 'Risks', prefix: 'R-', shared: true,
    cols: ['risk_id', 'feature', 'impact_1to5', 'likelihood_1to5', 'score', 'priority', 'reason', 'owner', 'coverage'],
    required: ['feature', 'impact_1to5', 'likelihood_1to5', 'reason', 'owner'],
    enums: { impact_1to5: ['1', '2', '3', '4', '5'], likelihood_1to5: ['1', '2', '3', '4', '5'], owner: ['A', 'B', 'Both'], coverage: ['Tested in depth', 'Smoke only', 'Not tested', ''] },
  },
  cases: {
    title: 'TestCases', prefix: 'TC-',
    cols: ['case_id', 'feature', 'risk_id', 'priority', 'technique', 'preconditions', 'test_data', 'steps', 'expected_result', 'basis', 'owner', 'status', 'actual_result', 'defect_id', 'executed_at_myt'],
    required: ['feature', 'risk_id', 'priority', 'technique', 'steps', 'expected_result', 'basis'],
    enums: { priority: ['High', 'Medium', 'Low'], technique: ['EP', 'BVA', 'Decision table', 'State transition', 'Error guessing', 'Exploratory', 'Use case'], basis: ['Requirement', 'On-screen rule', 'Assumed convention'], owner: ['A', 'B'], status: ['Not Run', 'Passed', 'Failed', 'Blocked'] },
    defaults: { status: 'Not Run' },
  },
  defects: {
    title: 'Defects', prefix: 'D-',
    cols: ['defect_id', 'title', 'feature', 'severity', 'priority', 'repro', 'steps', 'expected', 'actual', 'impact', 'evidence', 'case_id', 'risk_id', 'owner', 'reviewed_by', 'status', 'platform_id'],
    required: ['title', 'feature', 'severity', 'steps', 'expected', 'actual', 'evidence'],
    enums: { severity: ['Critical', 'High', 'Medium', 'Low'], priority: ['P1', 'P2', 'P3', ''], owner: ['A', 'B'], reviewed_by: ['A', 'B', 'AI+A', 'AI+B', ''], status: ['Suspected', 'Verified', 'Submitted', 'Dropped-not a bug', 'Duplicate'] },
    defaults: { status: 'Suspected' },
  },
  nfr: {
    title: 'NonFunctional', prefix: 'NF-',
    cols: ['nfr_id', 'category', 'scenario', 'environment', 'method', 'baseline_expectation', 'observation_units', 'repeats', 'user_impact', 'evidence', 'verdict'],
    required: ['category', 'scenario', 'environment', 'method', 'observation_units'],
    enums: { category: ['Usability', 'Performance', 'Accessibility', 'Compatibility', 'Responsive', 'Reliability', 'Security (passive)'], verdict: ['Finding', 'No issue', 'Not tested', ''] },
  },
  ailog: {
    title: 'AI_Log', prefix: 'AI-', noId: true,
    cols: ['time_myt', 'prompt_id', 'activity', 'input_summary', 'output_summary', 'what_we_kept_changed', 'how_verified', 'used_in'],
    required: ['prompt_id', 'activity', 'input_summary', 'output_summary', 'how_verified'],
    enums: { prompt_id: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'other'] },
  },
};
const ALIAS = { testcases: 'cases', tc: 'cases', defect: 'defects', bugs: 'defects', nonfunctional: 'nfr', ai: 'ailog', ai_log: 'ailog', risk: 'risks' };

const die = (m) => { console.error('ERROR: ' + m); process.exit(1); };
const myt = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()).replace(',', '');

// ---------- CSV ----------
function parseDelimited(text, delim) {
  const rows = []; let row = []; let f = ''; let q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const fileOf = (key, tester = T) => (SHEETS[key].shared ? path.join(RUN, 'risks.csv') : path.join(RUN, tester, `${key}.csv`));
function load(key, tester = T) {
  const f = fileOf(key, tester);
  if (!fs.existsSync(f)) return [];
  const rows = parseDelimited(fs.readFileSync(f, 'utf8'), ',');
  const head = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(SHEETS[key].cols.map((c) => [c, r[head.indexOf(c)] ?? ''])));
}
function save(key, rows, tester = T) {
  const f = fileOf(key, tester); fs.mkdirSync(path.dirname(f), { recursive: true });
  const cols = SHEETS[key].cols;
  fs.writeFileSync(f, '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n');
}

// ---------- rules ----------
function derive(key, r) {
  if (key === 'risks' && r.impact_1to5 && r.likelihood_1to5) {
    const s = Number(r.impact_1to5) * Number(r.likelihood_1to5);
    r.score = String(s); r.priority = s >= 15 ? 'High' : s >= 8 ? 'Medium' : 'Low';
  }
  return r;
}
function validate(key, r, isNew) {
  const sh = SHEETS[key]; const errs = [];
  for (const k of Object.keys(r)) if (!sh.cols.includes(k)) errs.push(`unknown field "${k}" (allowed: ${sh.cols.join(', ')})`);
  if (isNew) for (const k of sh.required) if (!String(r[k] ?? '').trim()) errs.push(`missing required "${k}"`);
  for (const [k, vals] of Object.entries(sh.enums || {})) if (r[k] !== undefined && r[k] !== '' && !vals.includes(String(r[k]))) errs.push(`${k}="${r[k]}" not allowed (use: ${vals.filter(Boolean).join(' | ')})`);
  if (key === 'defects') {
    if (r.status === 'Verified') {
      const m = /^(\d+)\s*\/\s*(\d+)/.exec(r.repro || '');
      if (!m || Number(m[1]) < 2) errs.push('status Verified needs repro like "2/2" or "3/3" (reproduced at least twice)');
      if (!String(r.evidence || '').trim()) errs.push('status Verified needs evidence');
    }
    if (r.status === 'Submitted') {
      if (!String(r.platform_id || '').trim()) errs.push('status Submitted needs platform_id (the ID shown by the official platform after a HUMAN submits it)');
      if (!/^(A|B|AI\+A|AI\+B)$/.test(r.reviewed_by || '')) errs.push('status Submitted needs reviewed_by (a human: A, B, AI+A or AI+B)');
    }
    if (/\b(root cause is|caused by)\b/i.test(r.actual || '')) errs.push('actual result must describe what was observed, not a root cause');
  }
  if (key === 'cases' && r.status && r.status !== 'Not Run' && !String(r.actual_result || '').trim()) errs.push('executed case needs actual_result');
  if (key === 'cases' && r.status === 'Failed' && !String(r.defect_id || '').trim()) errs.push('Failed case needs defect_id (log the defect first as Suspected)');
  if (errs.length) die(errs.join('\n       '));
}
function nextId(key, rows) {
  const sh = SHEETS[key]; const idc = sh.cols[0];
  const pre = sh.shared ? sh.prefix : `${sh.prefix}${T}`;
  const nums = rows.map((r) => r[idc]).filter((x) => x.startsWith(pre)).map((x) => Number(x.slice(pre.length)) || 0);
  return pre + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
}
function parseJson(s) { try { const o = JSON.parse(s); for (const k of Object.keys(o)) o[k] = o[k] === null ? '' : String(o[k]); return o; } catch (e) { die(`invalid JSON: ${e.message}`); } }

// ---------- commands ----------
const [cmd, rawSheet, a3, a4] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith('--')).map((x, i, arr) => [x.slice(2), true]));
const argAfter = (name) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : undefined; };
const sheet = (s) => { const k = ALIAS[String(s || '').toLowerCase()] || String(s || '').toLowerCase(); if (!SHEETS[k]) die(`unknown sheet "${s}". Use: ${Object.keys(SHEETS).join(', ')}`); return k; };

switch (cmd) {
  case 'add': {
    const key = sheet(rawSheet); if (!a3) die(`usage: rec add ${key} '<json>'`);
    const sh = SHEETS[key]; const rows = load(key);
    const r = { ...(sh.defaults || {}), ...parseJson(a3) };
    if (sh.cols.includes('owner') && !r.owner && !sh.shared) r.owner = T;
    if (key === 'ailog') r.time_myt = r.time_myt || myt();
    if (key === 'cases' && r.status && r.status !== 'Not Run' && !r.executed_at_myt) r.executed_at_myt = myt();
    derive(key, r); validate(key, r, true);
    if (!sh.noId) { if (r[sh.cols[0]] && rows.some((x) => x[sh.cols[0]] === r[sh.cols[0]])) die(`${r[sh.cols[0]]} already exists`); r[sh.cols[0]] = r[sh.cols[0]] || nextId(key, rows); }
    rows.push(r); save(key, rows);
    console.log(sh.noId ? `logged ${sh.title} row ${rows.length}` : `${r[sh.cols[0]]} added to ${path.relative(ROOT, fileOf(key))}${key === 'risks' ? ` (score ${r.score}, ${r.priority})` : ''}`);
    break;
  }
  case 'update': {
    const key = sheet(rawSheet); if (!a3 || !a4) die(`usage: rec update ${key} <id> '<json>'`);
    const rows = load(key); const idc = SHEETS[key].cols[0];
    const r = rows.find((x) => x[idc] === a3); if (!r) die(`${a3} not found in ${key} (tester ${T})`);
    const patch = parseJson(a4);
    if (key === 'cases' && patch.status && patch.status !== 'Not Run' && !patch.executed_at_myt) patch.executed_at_myt = myt();
    Object.assign(r, patch); derive(key, r); validate(key, r, false);
    save(key, rows); console.log(`${a3} updated: ${Object.keys(patch).join(', ')}`);
    break;
  }
  case 'get': {
    const key = sheet(rawSheet); const r = load(key).find((x) => x[SHEETS[key].cols[0]] === a3);
    if (!r) die(`${a3} not found`); for (const [k, v] of Object.entries(r)) console.log(`${k}: ${v}`);
    break;
  }
  case 'list': {
    const key = sheet(rawSheet); const sh = SHEETS[key];
    const testers = sh.shared ? [T] : flags.all ? ['A', 'B'] : [T];
    let rows = testers.flatMap((t) => load(key, t));
    const st = argAfter('status'); if (st) rows = rows.filter((r) => r.status === st);
    const brief = { risks: ['risk_id', 'feature', 'score', 'priority', 'owner', 'coverage'], cases: ['case_id', 'risk_id', 'priority', 'technique', 'status', 'feature', 'expected_result'], defects: ['defect_id', 'severity', 'status', 'repro', 'title', 'platform_id'], nfr: ['nfr_id', 'category', 'verdict', 'scenario'], ailog: ['time_myt', 'prompt_id', 'activity'] }[key];
    if (!rows.length) { console.log(`(no ${sh.title} rows${st ? ' with status ' + st : ''})`); break; }
    for (const r of rows) console.log(flags.full ? JSON.stringify(r) : brief.map((c) => (r[c] || '-').slice(0, c === 'title' || c === 'expected_result' || c === 'scenario' || c === 'feature' ? 70 : 20)).join(' | '));
    console.log(`(${rows.length} rows)`);
    break;
  }
  case 'copy': case 'tsv': {
    const key = sheet(rawSheet); const sh = SHEETS[key];
    const rows = sh.shared ? load(key) : (flags.all ? ['A', 'B'] : [T]).flatMap((t) => load(key, t));
    const tsv = rows.map((r) => sh.cols.map((c) => String(r[c] ?? '').replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
    const out = path.join(RUN, T, `paste-${sh.title}.tsv`); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, tsv);
    if (cmd === 'copy') {
      try { execFileSync('powershell', ['-NoProfile', '-Command', `Get-Content -Raw -Encoding UTF8 '${out}' | Set-Clipboard`]); console.log(`${rows.length} ${sh.title} rows copied to clipboard (no header). In Google Sheets click the first empty cell in column A, Ctrl+V.`); }
      catch { console.log(`clipboard unavailable; open ${path.relative(ROOT, out)} and copy its content`); }
    } else console.log(tsv);
    break;
  }
  case 'import': {
    const key = sheet(rawSheet); const src = a3; if (!src) die(`usage: rec import ${key} <file|->`);
    const text = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8');
    const delim = text.split('\n')[0].includes('\t') ? '\t' : ',';
    let rows = parseDelimited(text, delim); const cols = SHEETS[key].cols;
    if (rows[0] && rows[0][0] === cols[0]) rows.shift();
    const objs = rows.map((r) => derive(key, Object.fromEntries(cols.map((c, i) => [c, (r[i] ?? '').trim()]))));
    for (const o of objs) validate(key, o, false);
    const existing = load(key); const idc = cols[0];
    for (const o of objs) { const i = existing.findIndex((x) => x[idc] === o[idc]); if (i >= 0) existing[i] = o; else existing.push(o); }
    save(key, existing); console.log(`imported ${objs.length} ${SHEETS[key].title} rows into ${path.relative(ROOT, fileOf(key))}`);
    break;
  }
  case 'import-nfr': {
    const src = rawSheet; if (!src || !fs.existsSync(src)) die('usage: rec import-nfr <run-checks nonfunctional.csv>');
    const rows = parseDelimited(fs.readFileSync(src, 'utf8'), ','); const head = rows.shift();
    const existing = load('nfr'); let n = 0;
    for (const r of rows) {
      const o = Object.fromEntries(SHEETS.nfr.cols.map((c) => [c, r[head.indexOf(c)] ?? '']));
      if (o.verdict.startsWith('[REVIEW]') || !SHEETS.nfr.enums.verdict.includes(o.verdict)) o.verdict = '';
      if (!SHEETS.nfr.enums.category.includes(o.category)) o.category = /mobile|390/i.test(o.scenario) ? 'Responsive' : /compat/i.test(o.category) ? 'Compatibility' : 'Reliability';
      for (const k of ['baseline_expectation', 'user_impact']) if (o[k].startsWith('[REVIEW]')) o[k] = o[k].replace(/^\[REVIEW\]\s*/, 'TO REVIEW: ');
      o.nfr_id = nextId('nfr', existing); existing.push(o); n++;
    }
    save('nfr', existing); console.log(`imported ${n} automated NFR rows (verdict left empty - review each, then rec update nfr <id> '{"verdict":"Finding",...}')`);
    break;
  }
  case 'stats': {
    const testers = ['A', 'B'].filter((t) => fs.existsSync(path.join(RUN, t)));
    const all = (k) => testers.flatMap((t) => load(k, t));
    const risks = load('risks'); const cases = all('cases'); const defects = all('defects'); const nfr = all('nfr'); const ai = all('ailog');
    const c = (arr, f) => arr.filter(f).length;
    const passed = c(cases, (r) => r.status === 'Passed'); const failed = c(cases, (r) => r.status === 'Failed');
    const sub = defects.filter((d) => d.status === 'Submitted');
    const ver = defects.filter((d) => d.status === 'Verified');
    const lines = [
      `Data from: ${testers.map((t) => `run/${t}`).join(', ') || '(none)'} + run/risks.csv  (${myt()} MYT)`,
      `Risks identified: ${risks.length} (High ${c(risks, (r) => r.priority === 'High')}, Medium ${c(risks, (r) => r.priority === 'Medium')}, Low ${c(risks, (r) => r.priority === 'Low')})`,
      `  Tested in depth ${c(risks, (r) => r.coverage === 'Tested in depth')}, Smoke only ${c(risks, (r) => r.coverage === 'Smoke only')}, Not tested ${c(risks, (r) => r.coverage === 'Not tested')}, coverage not set ${c(risks, (r) => !r.coverage)}`,
      `Test cases designed: ${cases.length}`,
      `  Passed ${passed}, Failed ${failed}, Blocked ${c(cases, (r) => r.status === 'Blocked')}, Not run ${c(cases, (r) => r.status === 'Not Run' || !r.status)}`,
      `  Pass rate (Passed/(Passed+Failed)): ${passed + failed ? ((passed / (passed + failed)) * 100).toFixed(1) + '%' : 'N/A'}`,
      `Defects submitted: ${sub.length} (Critical ${c(sub, (d) => d.severity === 'Critical')}, High ${c(sub, (d) => d.severity === 'High')}, Medium ${c(sub, (d) => d.severity === 'Medium')}, Low ${c(sub, (d) => d.severity === 'Low')})`,
      `  Verified but NOT yet submitted: ${ver.length}${ver.length ? ' -> ' + ver.map((d) => d.defect_id).join(', ') : ''}`,
      `  Still Suspected: ${c(defects, (d) => d.status === 'Suspected')}; Dropped after review: ${c(defects, (d) => /Dropped|Duplicate/.test(d.status))}`,
      `Non-functional findings: ${c(nfr, (r) => r.verdict === 'Finding')} (rows ${nfr.length}, unreviewed ${c(nfr, (r) => !r.verdict)})`,
      `AI interactions logged: ${ai.length}`,
    ];
    console.log(lines.join('\n'));
    if (testers.length < 2) console.log(`NOTE: only tester ${testers.join('') || '-'} data on this machine. Team totals come from the shared Google Sheet Stats tab.`);
    break;
  }
  case 'reset': {
    // Archive (never delete) rehearsal data so competition stats start at zero
    if (!flags.yes) die('rec reset --yes   moves run/ and .tb/<T>/ logs to archive/<time>/ (nothing is deleted)');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const dest = path.join(ROOT, 'archive', stamp); fs.mkdirSync(dest, { recursive: true });
    if (fs.existsSync(RUN)) fs.renameSync(RUN, path.join(dest, 'run'));
    for (const t of ['A', 'B']) for (const f of ['events.jsonl', 'state.json']) { const p = path.join(ROOT, '.tb', t, f); if (fs.existsSync(p)) { fs.mkdirSync(path.join(dest, 'tb', t), { recursive: true }); fs.renameSync(p, path.join(dest, 'tb', t, f)); } }
    console.log(`archived to ${path.relative(ROOT, dest)}. Browser profiles (logins) kept. Next: ./tb init <SUT_URL>`);
    break;
  }
  default:
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
