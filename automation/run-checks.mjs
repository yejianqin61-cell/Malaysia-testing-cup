#!/usr/bin/env node
// TeaYeah Tier B generic checks - read-only, low-rate, same-host only.
// Use ONLY after the briefing confirms automation is allowed.
//
// Example:
//   node run-checks.mjs --url https://sut.example.com --pages /,/login,/products
//   node run-checks.mjs --config targets.json --checks perf,errors --throttle fast3g
//
// What it does NOT do: click, type (except Tab focus walk), submit forms, crawl links,
// run in parallel, or load anything outside the target host.

import { chromium, firefox } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

// ---------------- CLI ----------------
const HELP = `
Usage: node run-checks.mjs --url <base> [options]

  --url <base>          Base URL of the SUT (required unless in --config)
  --pages <list>        Comma-separated paths, e.g. /,/login,/cart   (default: /)
  --config <file>       JSON file with any of the options below (CLI overrides it)
  --checks <list>       perf,a11y,shots,errors  (default: all; errors are collected during every load)
  --runs <n>            Performance repeats per page, median reported (default: 3)
  --throttle <name>     none | fast3g | slow4g   (Chromium only; default: none)
  --browsers <list>     chromium,firefox for screenshots (default: chromium,firefox)
  --auth <file>         Playwright storageState file (create with: npx playwright codegen --save-storage=auth.json <url>)
  --delay <ms>          Pause between page loads (default: 1500)
  --max-loads <n>       Hard cap on total page loads; aborts before starting if exceeded (default: 80)
  --tab-steps <n>       Tab presses for the keyboard focus walk (default: 15, 0 = off)
  --out <dir>           Output root (default: out)
  --headed              Show the browser windows
`;

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) a[key] = true;
    else { a[key] = next; i++; }
  }
  return a;
}

const cli = parseArgs(process.argv.slice(2));
if (cli.help || cli.h) { console.log(HELP); process.exit(0); }
const fileCfg = cli.config ? JSON.parse(fs.readFileSync(cli.config, 'utf8')) : {};
const list = (v) => (Array.isArray(v) ? v : String(v).split(',')).map((s) => s.trim()).filter(Boolean);
const opt = (k, d) => (cli[k] !== undefined ? cli[k] : fileCfg[k] !== undefined ? fileCfg[k] : d);

const cfg = {
  url: opt('url', null),
  pages: list(opt('pages', '/')),
  checks: list(opt('checks', 'perf,a11y,shots,errors')),
  runs: Number(opt('runs', 3)),
  throttle: String(opt('throttle', 'none')),
  browsers: list(opt('browsers', 'chromium,firefox')),
  auth: opt('auth', null),
  delay: Number(opt('delay', 1500)),
  maxLoads: Number(opt('max-loads', 80)),
  tabSteps: Number(opt('tab-steps', 15)),
  out: opt('out', 'out'),
  headed: Boolean(opt('headed', false)),
};

if (!cfg.url) { console.error('ERROR: --url is required.\n' + HELP); process.exit(2); }
const base = new URL(cfg.url);
const targets = cfg.pages.map((p) => {
  const u = new URL(p, base);
  if (u.host !== base.host) {
    console.error(`ERROR: ${u.href} is outside the target host ${base.host}. Refusing.`);
    process.exit(2);
  }
  return u;
});
if (cfg.auth && !fs.existsSync(cfg.auth)) { console.error(`ERROR: auth file ${cfg.auth} not found.`); process.exit(2); }

const has = (c) => cfg.checks.includes(c);
const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const THROTTLES = {
  none: null,
  // Legacy Chrome DevTools "Fast 3G" profile
  fast3g: { label: 'Fast 3G (562.5 ms RTT, 1.44 Mbps down, 0.67 Mbps up)', latency: 562.5, down: (1.6 * 1024 * 1024 / 8) * 0.9, up: (750 * 1024 / 8) * 0.9 },
  // Chrome DevTools "Slow 4G" profile
  slow4g: { label: 'Slow 4G (150 ms RTT, 1.6 Mbps down, 0.75 Mbps up)', latency: 150, down: (1.6 * 1024 * 1024 / 8) * 0.9, up: (750 * 1024 / 8) * 0.9 },
};
if (!(cfg.throttle in THROTTLES)) { console.error(`ERROR: unknown --throttle ${cfg.throttle}`); process.exit(2); }

// ---------------- Load budget (safety) ----------------
const plannedLoads =
  (has('perf') ? targets.length * cfg.runs : 0) +
  (has('a11y') ? targets.length : 0) +
  (has('shots') ? targets.length * cfg.browsers.length * VIEWPORTS.length : 0) +
  (has('errors') && !has('perf') && !has('shots') && !has('a11y') ? targets.length : 0);
if (plannedLoads > cfg.maxLoads) {
  console.error(`ERROR: plan needs ${plannedLoads} page loads, above --max-loads ${cfg.maxLoads}. Reduce pages/runs/browsers.`);
  process.exit(2);
}
let loadsDone = 0;

// ---------------- Helpers ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const myt = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date()).replace(',', '') + ' MYT';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
const outDir = path.resolve(cfg.out, stamp);
fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'axe'), { recursive: true });
const rel = (p) => path.relative(path.resolve('.'), p).replace(/\\/g, '/');
// Strip query/fragment so tokens never land in reports or AI prompts
// Keep short SPA hash routes (#/cart); redact token-like fragments (#access_token=...)
const safeHash = (h) => (h && h.length <= 40 && !h.includes('=') ? h : h ? '#[redacted]' : '');
const redact = (u) => { try { const x = new URL(u); return x.origin + x.pathname + (x.search ? '?[redacted]' : '') + safeHash(x.hash); } catch { return String(u).slice(0, 200); } };
const slug = (u) => ((u.pathname + safeHash(u.hash)).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'home').slice(0, 50);
const OS = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform] || process.platform;
const median = (xs) => { const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b); if (!s.length) return NaN; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sec = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(2) + ' s' : 'n/a');
const kb = (b) => (b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(2) + ' MB' : (b / 1024).toFixed(0) + ' KB');

const errors = new Map(); // key -> {type,text,status,count,pages:Set,browsers:Set}
function recordError(type, text, status, pageUrl, browser) {
  const key = `${type}|${status ?? ''}|${text}`;
  const e = errors.get(key) || { type, text, status, count: 0, pages: new Set(), browsers: new Set() };
  e.count++; e.pages.add(redact(pageUrl)); e.browsers.add(browser);
  errors.set(key, e);
}
function wireErrorCapture(page, pageUrl, browser) {
  page.on('console', (m) => { if (m.type() === 'error') recordError('console.error', m.text().slice(0, 300), null, pageUrl, browser); });
  page.on('pageerror', (e) => recordError('uncaught exception', String(e.message || e).slice(0, 300), null, pageUrl, browser));
  page.on('response', (r) => { if (r.status() >= 400) recordError('http', `${r.request().method()} ${redact(r.url())}`, r.status(), pageUrl, browser); });
  page.on('requestfailed', (r) => recordError('request failed', `${r.method()} ${redact(r.url())} (${r.failure()?.errorText})`, null, pageUrl, browser));
}

const browsers = {};
async function getBrowser(name) {
  if (!browsers[name]) browsers[name] = await ({ chromium, firefox }[name]).launch({ headless: !cfg.headed });
  return browsers[name];
}
async function newContext(name, vp) {
  const b = await getBrowser(name);
  const o = { viewport: { width: vp.width, height: vp.height } };
  if (vp.mobile && name === 'chromium') Object.assign(o, { isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  if (cfg.auth) o.storageState = cfg.auth;
  return b.newContext(o);
}
async function load(page, url) {
  if (loadsDone >= cfg.maxLoads) throw new Error('max-loads reached');
  if (loadsDone > 0) await sleep(cfg.delay);
  loadsDone++;
  const resp = await page.goto(url.href, { waitUntil: 'load', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch { /* long-polling sites never idle */ }
  return resp;
}

// ---------------- NonFunctional rows (workbook columns) ----------------
const rows = [];
const env = {};
function addRow(category, scenario, environment, method, observation, repeats, evidence, extra = {}) {
  rows.push({
    nfr_id: `NF-A${String(rows.length + 1).padStart(2, '0')}`,
    category, scenario, environment, method,
    baseline_expectation: extra.baseline || '[REVIEW] set expectation + basis (requirement or common guideline)',
    observation_units: observation,
    repeats,
    user_impact: '[REVIEW]',
    evidence,
    verdict: extra.verdict || '[REVIEW]',
  });
}

// ---------------- Checks ----------------
async function perfCheck() {
  const th = THROTTLES[cfg.throttle];
  const b = await getBrowser('chromium');
  env.chromium = b.version();
  const results = [];
  for (const url of targets) {
    const runs = [];
    for (let i = 0; i < cfg.runs; i++) {
      const ctx = await newContext('chromium', VIEWPORTS[0]); // fresh context = cold cache
      const page = await ctx.newPage();
      wireErrorCapture(page, url.href, 'chromium');
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (th) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: th.latency, downloadThroughput: th.down, uploadThroughput: th.up });
      await page.addInitScript(() => {
        window.__lcp = 0;
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      });
      let status = null; let err = null;
      try { status = (await load(page, url))?.status() ?? null; } catch (e) { err = e.message.split('\n')[0]; }
      const m = err ? {} : await page.evaluate(() => {
        const n = performance.getEntriesByType('navigation')[0] || {};
        const res = performance.getEntriesByType('resource');
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return {
          ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd,
          fcp: fcp ? fcp.startTime : NaN, lcp: window.__lcp || NaN,
          requests: res.length + 1,
          bytes: res.reduce((s, r) => s + (r.transferSize || 0), 0) + (n.transferSize || 0),
        };
      });
      runs.push({ run: i + 1, status, error: err, ...m });
      await ctx.close();
      console.log(`  perf ${redact(url.href)} run ${i + 1}/${cfg.runs}: ${err ? 'ERROR ' + err : sec(m.load)}`);
    }
    const md = (k) => median(runs.map((r) => r[k]));
    const summary = { url: redact(url.href), runs, median: { ttfb: md('ttfb'), fcp: md('fcp'), lcp: md('lcp'), dcl: md('dcl'), load: md('load'), requests: md('requests'), bytes: md('bytes') } };
    results.push(summary);
    const s = summary.median;
    const failed = runs.filter((r) => r.error).length;
    addRow('Performance',
      `Cold page load of ${redact(url.href)}`,
      `Chromium ${env.chromium} (Playwright, ${cfg.headed ? 'headed' : 'headless'}), ${OS}, 1920x1080, network: ${th ? th.label : 'unthrottled local broadband'}`,
      `Navigation Timing + Paint Timing API; new browser context and cache disabled for every run; median of ${cfg.runs}. Lab measurement, not a load test.`,
      `median load ${sec(s.load)} (runs: ${runs.map((r) => sec(r.load)).join(' / ')}); DCL ${sec(s.dcl)}; FCP ${sec(s.fcp)}; LCP ${sec(s.lcp)}; TTFB ${sec(s.ttfb)}; ${Math.round(s.requests)} requests, ${kb(s.bytes)} transferred${failed ? `; ${failed} run(s) failed to load` : ''}`,
      cfg.runs, rel(path.join(outDir, 'perf.json')),
      { baseline: '[REVIEW] e.g. LCP <= 2.5 s ("good" per Google Core Web Vitals guideline; not a stated requirement)' });
  }
  fs.writeFileSync(path.join(outDir, 'perf.json'), JSON.stringify({ throttle: cfg.throttle, results }, null, 2));
}

async function a11yCheck() {
  for (const url of targets) {
    const ctx = await newContext('chromium', VIEWPORTS[0]);
    const page = await ctx.newPage();
    wireErrorCapture(page, url.href, 'chromium');
    try { await load(page, url); } catch (e) { console.log(`  a11y ${redact(url.href)}: load ERROR ${e.message.split('\n')[0]}`); await ctx.close(); continue; }
    env.chromium = env.chromium || (await getBrowser('chromium')).version();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const file = path.join(outDir, 'axe', `${slug(url)}.json`);
    fs.writeFileSync(file, JSON.stringify({ url: redact(url.href), violations: r.violations, incompleteCount: r.incomplete.length, passes: r.passes.length }, null, 2));
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    const v = [...r.violations].sort((a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9));
    console.log(`  a11y ${redact(url.href)}: ${v.length} rule violations`);
    for (const x of v) {
      addRow('Accessibility',
        `${redact(url.href)} - axe rule "${x.id}"`,
        `Chromium ${env.chromium}, 1920x1080`,
        `axe-core ${r.testEngine.version} automated scan, tags WCAG 2.0/2.1 A+AA. Automated scan finds only part of a11y issues; confirm manually.`,
        `${x.impact || 'n/a'} impact: ${x.help}. ${x.nodes.length} element(s), e.g. ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}. Ref: ${x.helpUrl}`,
        1, rel(file), { baseline: 'WCAG 2.1 Level AA (industry standard; not a stated requirement)' });
    }
    if (!v.length) addRow('Accessibility', `${redact(url.href)} - axe scan`, `Chromium ${env.chromium}, 1920x1080`, `axe-core ${r.testEngine.version} automated scan, WCAG 2.0/2.1 A+AA`, `0 violations (${r.incomplete.length} items need manual review)`, 1, rel(file), { baseline: 'WCAG 2.1 Level AA', verdict: 'No automated violation (manual check still needed)' });

    // Keyboard focus walk: only presses Tab, never Enter/Space.
    if (cfg.tabSteps > 0) {
      const steps = [];
      for (let i = 0; i < cfg.tabSteps; i++) {
        await page.keyboard.press('Tab');
        steps.push(await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const cs = getComputedStyle(el);
          const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim().slice(0, 40);
          const visible = !(cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0) || cs.boxShadow !== 'none';
          return { tag: el.tagName.toLowerCase(), label, focusIndicator: visible };
        }));
      }
      // Stop counting once focus wraps back to the first stop
      const key = (s) => `${s.tag}|${s.label}`;
      const firstReal = steps.find(Boolean);
      const real = [];
      for (const s of steps) {
        if (!s) continue;
        if (real.length && key(s) === key(firstReal)) break;
        real.push(s);
      }
      const noIndicator = real.filter((s) => !s.focusIndicator);
      fs.writeFileSync(path.join(outDir, 'axe', `${slug(url)}-tab-order.json`), JSON.stringify(steps, null, 2));
      addRow('Accessibility',
        `${redact(url.href)} - keyboard Tab order and focus indicator`,
        `Chromium ${env.chromium}, 1920x1080`,
        `Pressed Tab ${cfg.tabSteps} times; recorded focused element and whether outline/box-shadow is visible (heuristic, confirm on screenshot/manually)`,
        `${real.length} focus stops; ${noIndicator.length} without detectable focus indicator${noIndicator.length ? ': ' + noIndicator.slice(0, 4).map((s) => `${s.tag} "${s.label}"`).join(', ') : ''}. Order: ${real.slice(0, 8).map((s) => `${s.tag}"${s.label}"`).join(' > ')}`,
        1, rel(path.join(outDir, 'axe', `${slug(url)}-tab-order.json`)), { baseline: 'WCAG 2.4.3 Focus Order, 2.4.7 Focus Visible' });
    }
    await ctx.close();
  }
}

async function shotsCheck() {
  for (const bName of cfg.browsers) {
    env[bName] = (await getBrowser(bName)).version();
    for (const vp of VIEWPORTS) {
      for (const url of targets) {
        const ctx = await newContext(bName, vp);
        const page = await ctx.newPage();
        wireErrorCapture(page, url.href, bName);
        const file = path.join(outDir, 'shots', `${slug(url)}-${bName}-${vp.name}.png`);
        let obs;
        try {
          await load(page, url);
          await page.screenshot({ path: file, fullPage: true });
          const o = await page.evaluate(() => {
            const vw = document.documentElement.clientWidth;
            const sw = document.documentElement.scrollWidth;
            const wide = [];
            for (const el of document.querySelectorAll('body *')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
                wide.push((el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')));
                if (wide.length >= 5) break;
              }
            }
            return { vw, sw, overflow: sw - vw, wide, title: document.title };
          });
          obs = o.overflow > 1
            ? `Horizontal overflow ${o.overflow}px (page ${o.sw}px wide vs viewport ${o.vw}px); elements past right edge: ${o.wide.join(', ') || 'n/a'}`
            : `No horizontal overflow; title "${o.title.slice(0, 60)}"`;
        } catch (e) { obs = `Load/screenshot ERROR: ${e.message.split('\n')[0]}`; }
        console.log(`  shot ${bName}/${vp.name} ${redact(url.href)}: ${obs.slice(0, 70)}`);
        addRow('Compatibility / responsive',
          `${redact(url.href)} at ${vp.width}x${vp.height} (${vp.name})`,
          `${bName} ${env[bName]}, ${vp.width}x${vp.height}${vp.mobile && bName === 'chromium' ? ', mobile emulation (touch, DPR 3)' : ''}`,
          'Full-page screenshot + automatic horizontal-overflow check. Compare screenshots across browsers/viewports manually for layout defects.',
          obs, 1, rel(file), { baseline: 'Content usable without horizontal scrolling at 390 px (WCAG 1.4.10 Reflow; common responsive convention)' });
        await ctx.close();
      }
    }
  }
}

async function errorsOnly() {
  for (const url of targets) {
    const ctx = await newContext('chromium', VIEWPORTS[0]);
    const page = await ctx.newPage();
    wireErrorCapture(page, url.href, 'chromium');
    try { await load(page, url); } catch (e) { recordError('navigation', e.message.split('\n')[0], null, url.href, 'chromium'); }
    await ctx.close();
  }
}

function writeErrorRows() {
  const list = [...errors.values()].sort((a, b) => b.count - a.count);
  fs.writeFileSync(path.join(outDir, 'errors.json'), JSON.stringify(list.map((e) => ({ ...e, pages: [...e.pages], browsers: [...e.browsers] })), null, 2));
  for (const e of list) {
    addRow('Reliability',
      `${e.type}${e.status ? ' HTTP ' + e.status : ''} during normal page load`,
      `${[...e.browsers].join(', ')}`,
      'Captured console errors, uncaught exceptions, HTTP >= 400 responses and failed requests during every automated page load',
      `${e.text}${e.status ? ' -> ' + e.status : ''}; seen ${e.count}x on ${[...e.pages].join(', ')}`,
      e.count, rel(path.join(outDir, 'errors.json')),
      { baseline: 'No console errors or failed requests during normal use (convention)' });
  }
  return list.length;
}

// ---------------- Output ----------------
const COLS = ['nfr_id', 'category', 'scenario', 'environment', 'method', 'baseline_expectation', 'observation_units', 'repeats', 'user_impact', 'evidence', 'verdict'];
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function writeOutputs(startedAt, errorCount) {
  const csv = '﻿' + [COLS.join(','), ...rows.map((r) => COLS.map((c) => csvCell(r[c])).join(','))].join('\r\n');
  fs.writeFileSync(path.join(outDir, 'nonfunctional.csv'), csv);
  const md = [
    `# Tier B automated check results`,
    ``,
    `Run: ${startedAt} to ${myt()} | target host: ${base.host} | pages: ${targets.map((u) => redact(u.href)).join(', ')}`,
    `Checks: ${cfg.checks.join(', ')} | page loads: ${loadsDone} (sequential, ${cfg.delay} ms apart, read-only) | throttle: ${cfg.throttle}`,
    `Browsers: ${Object.entries(env).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    ``,
    `Status: RAW OBSERVATIONS. Not yet reviewed. Fields marked [REVIEW] must be filled by a tester. Nothing here is a confirmed defect until reproduced manually.`,
    `Paste-safe: URLs have query strings redacted; no cookies/headers/bodies are included.`,
    ``,
    ...['Performance', 'Accessibility', 'Compatibility / responsive', 'Reliability'].flatMap((cat) => {
      const rs = rows.filter((r) => r.category === cat);
      if (!rs.length) return [];
      return [`## ${cat}`, ...rs.map((r) => `- ${r.nfr_id} ${r.scenario}: ${r.observation_units}`), ''];
    }),
    errorCount === 0 && has('errors') ? '## Reliability\n- No console errors, uncaught exceptions or failed requests captured.\n' : '',
    `Files: nonfunctional.csv (paste into NonFunctional sheet), perf.json, errors.json, axe/, shots/`,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
}

// ---------------- Main ----------------
(async () => {
  const startedAt = myt();
  console.log(`TeaYeah Tier B checks -> ${rel(outDir)}`);
  console.log(`Target ${base.host}, ${targets.length} page(s), checks ${cfg.checks.join(',')}, planned loads ${plannedLoads} (cap ${cfg.maxLoads})`);
  try {
    if (has('perf')) { console.log('[perf]'); await perfCheck(); }
    if (has('a11y')) { console.log('[a11y]'); await a11yCheck(); }
    if (has('shots')) { console.log('[shots]'); await shotsCheck(); }
    if (has('errors') && !has('perf') && !has('a11y') && !has('shots')) { console.log('[errors]'); await errorsOnly(); }
  } catch (e) {
    console.error('Stopped early:', e.message);
  } finally {
    const n = has('errors') ? writeErrorRows() : 0;
    writeOutputs(startedAt, n);
    for (const b of Object.values(browsers)) await b.close();
    console.log(`Done. ${loadsDone} page loads, ${rows.length} rows. Open ${rel(path.join(outDir, 'summary.md'))}`);
  }
})();
