#!/usr/bin/env node
// tb - TeaYeah browser CLI for AI agents (CDP).
//
// One long-running process owns a headed Chromium (`tb chrome`) and records console/network/dialog
// events. Every other command connects over CDP, performs ONE action on the active tab, auto-logs it
// (time, element, URL, screenshot, new errors) and disconnects. `tb steps` turns the log into
// reproduction steps for defect reports.
//
// Tester identity: env TB_TESTER=A|B (default A). Port: A=9222, B=9223 (override TB_PORT).

import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = (process.env.TB_TESTER || 'A').toUpperCase();
// Optional second identity (e.g. TB_ROLE=admin or TB_ROLE=user2): own browser, port, login, log
const ROLE = (process.env.TB_ROLE || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ID = ROLE ? `${T}-${ROLE}` : T;
const roleOffset = ROLE ? 10 + 2 * ([...ROLE].reduce((a, c) => a + c.charCodeAt(0), 0) % 40) : 0;
const PORT = Number(process.env.TB_PORT || (T === 'B' ? 9223 : 9222) + roleOffset);
const RT = path.join(ROOT, '.tb', ID);             // runtime: profile, events, state (gitignored)
const RUN = path.join(ROOT, 'run');
const EVID = path.join(RUN, T, 'evidence');
const CFG_FILE = path.join(RUN, 'config.json');
const EVENTS = path.join(RT, 'events.jsonl');
const ACTIONS = path.join(RUN, T, ROLE ? `actions-${ROLE}.jsonl` : 'actions.jsonl');
const NET = path.join(RT, 'net.jsonl');
const STATE = path.join(RT, 'state.json');
for (const d of [RT, EVID]) fs.mkdirSync(d, { recursive: true });

const SECRET_KEYS = /(token|passw|pwd|secret|authori[sz]ation|session|cookie|api[-_]?key|jwt|otp|csrf|credit|card|cvv|iban)/i;
const DEFAULT_GUARD ='delete|remove account|close account|deactivate|pay now|confirm payment|place order|complete purchase|buy now|transfer|send money|withdraw|unsubscribe|reset all|clear all data|log ?out of all';

// ---------------- small utils ----------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const myt = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d).replace(',', '');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2));
const state = () => readJson(STATE, { active: -1, seq: 0, lastTs: 0, dialog: 'dismiss', viewport: null });
const setState = (patch) => writeJson(STATE, { ...state(), ...patch });
const cfg = () => readJson(CFG_FILE, null);
const safeHash = (h) => (h && h.length <= 40 && !h.includes('=') ? h : h ? '#[redacted]' : '');
const redact = (u) => { try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) return u; return x.origin + x.pathname + (x.search ? '?[redacted]' : '') + safeHash(x.hash); } catch { return String(u).slice(0, 200); } };
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const die = (msg, code = 1) => { console.error('ERROR: ' + msg); process.exit(code); };
const appendJsonl = (f, o) => fs.appendFileSync(f, JSON.stringify(o) + '\n');
const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

function hostAllowed(url) {
  const c = cfg();
  if (!c) die('run/config.json missing. Run: tb init <SUT_URL>');
  if (!url || url === 'about:blank' || url.startsWith('chrome-error:')) return true;
  try { const h = new URL(url).host; return c.allowHosts.includes(h); } catch { return false; }
}

// ---------------- args ----------------
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {}; const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const n = argv[i + 1]; if (n === undefined || n.startsWith('--')) flags[k] = true; else { flags[k] = n; i++; } }
  else pos.push(a);
}

const HELP = `tb - TeaYeah browser CLI (identity ${ID}, port ${PORT})

Setup   (second identity for permission tests: TB_ROLE=admin ./tb chrome, then TB_ROLE=admin ./tb ...)
  tb init <SUT_URL> [--allow host2,host3]   write run/config.json (allowed hosts, guard words)
  tb chrome [--headless]                   start the browser + event recorder (keep running)
  tb status | tb stop

Look
  tb snap [--text] [--all]                 page summary + interactive elements with refs (e1, e2, ...)
  tb find "<text>"                         give refs to the elements showing that text (custom widgets, list rows)
  tb text [<ref>]                          visible text of the page or element
  tb shot [<name>] [--full]                screenshot into run/${T}/evidence
  tb tabs | tb tab <n>
  tb js "<expression>"                     read-only inspection (e.g. localStorage.length)

Act (each one is logged with a screenshot; refs come from the latest snap)
  tb open <url|path>        tb back | forward | reload
  tb click <ref> [--double] [--yes --why "..."]   guard words need --yes and a reason
  tb fill <ref> "<text>"    tb type <ref> "<text>"   (type = real keystrokes)
  tb clear <ref>            tb select <ref> "<option>"   tb check|uncheck <ref>
  tb press <key> [<ref>]    tb hover <ref>   tb upload <ref> <file>   tb scroll <ref|down|up|top|bottom>
  tb dialog accept|dismiss  policy for the NEXT confirm/prompt dialog (default dismiss)
  tb viewport desktop|mobile|<W>x<H>

Evidence
  tb mark "<label>"         start a section (e.g. "TC-A03" or "D-A02 repro 1")
  tb steps [--mark <label>] [--from <seq>] [--to <seq>]   reproduction steps from the log
  tb errors [--mark <label>] [--last <n>] [--warnings] console / HTTP / dialog / out-of-scope events
  tb net [--mark <label>] [--grep <text>] [--last <n>] [--body]   XHR/fetch calls with request/response bodies
  tb perf [<runs>]          reload current page N times (cache off), median timings
  tb a11y                   axe-core WCAG 2.1 AA scan of the current page state
  tb save-auth              export login state to .tb/${T}/auth.json (for run-checks.mjs --auth)
`;

// ---------------- init ----------------
if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); process.exit(0); }

if (cmd === 'init') {
  const url = pos[0]; if (!url) die('usage: tb init <SUT_URL> [--allow host2,host3]');
  const u = new URL(url);
  const extra = flags.allow ? String(flags.allow).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const c = { sutUrl: u.href, allowHosts: [u.host, ...extra], guard: DEFAULT_GUARD, minActionGapMs: 300, createdAt: myt() };
  fs.mkdirSync(RUN, { recursive: true });
  writeJson(CFG_FILE, c);
  console.log(`Wrote ${rel(CFG_FILE)}: allowed hosts ${c.allowHosts.join(', ')}`);
  process.exit(0);
}

// ---------------- daemon ----------------
if (cmd === 'chrome') {
  const c = cfg(); if (!c) die('run tb init <SUT_URL> first');
  try { await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); die(`a browser is already listening on ${PORT} (identity ${ID}). Use tb stop first.`); } catch { /* free */ }
  const ctx = await chromium.launchPersistentContext(path.join(RT, 'profile'), {
    headless: Boolean(flags.headless), viewport: null,
    args: [`--remote-debugging-port=${PORT}`, '--window-size=1440,960', '--no-first-run', '--no-default-browser-check'],
  });
  const ev = (type, page, data) => appendJsonl(EVENTS, { ts: Date.now(), time: myt(), type, page: page ? redact(page.url()) : null, ...data });
  let appliedVp = null;
  const applyVp = async (page) => { const v = state().viewport; if (v) await page.setViewportSize(v).catch(() => {}); };
  const wire = (page) => {
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') ev('console.' + m.type(), page, { text: m.text().slice(0, 400) }); });
    page.on('pageerror', (e) => ev('uncaught', page, { text: String(e.message || e).slice(0, 400) }));
    page.on('response', (r) => {
      if (r.status() >= 400) ev('http', page, { status: r.status(), text: `${r.request().method()} ${redact(r.url())}` });
      recordApi(r, page);
    });
    page.on('requestfailed', (r) => { const f = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(f)) ev('requestfailed', page, { text: `${r.method()} ${redact(r.url())} ${f}` }); });
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) { ev('nav', page, { text: redact(f.url()) }); if (!hostAllowed(f.url())) ev('OUT-OF-SCOPE', page, { text: `navigated outside allowed hosts: ${redact(f.url())}` }); } });
    page.on('dialog', (d) => handleDialog(d, (data) => ev('dialog', page, data)));
    applyVp(page);
  };
  // Hard scope guard: block top-level navigations to hosts outside run/config.json (links, redirects, popups).
  // Note: routing disables the HTTP cache in this browser; perf numbers are cold-cache anyway.
  await ctx.route('**/*', (route) => {
    const r = route.request();
    let main = false; try { main = r.isNavigationRequest() && r.frame() === r.frame().page().mainFrame(); } catch {}
    if (main && !hostAllowed(r.url())) { ev('OUT-OF-SCOPE', null, { text: `blocked navigation to ${redact(r.url())}` }); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  ctx.on('page', (p) => { wire(p); ev('newtab', p, { text: 'new tab opened' }); });
  for (const p of ctx.pages()) wire(p);
  const first = ctx.pages()[0] || (await ctx.newPage());
  await first.goto(c.sutUrl).catch((e) => ev('nav-error', first, { text: e.message.split('\n')[0] }));
  setState({ active: 0, viewport: null });
  // apply viewport changes requested by `tb viewport` (emulation must live in this long-running session)
  const timer = setInterval(async () => {
    const v = JSON.stringify(state().viewport);
    if (v !== appliedVp) { appliedVp = v; for (const p of ctx.pages()) await applyVp(p); if (v === 'null') for (const p of ctx.pages()) await p.setViewportSize({ width: 1440, height: 860 }).catch(() => {}); }
  }, 500);
  console.log(`tb chrome ready: identity ${ID}, CDP port ${PORT}, profile ${rel(path.join(RT, 'profile'))}`);
  console.log(`Events -> ${rel(EVENTS)}. Log in manually in this window if needed. Ctrl+C or "tb stop" to quit.`);
  ctx.on('close', () => { clearInterval(timer); console.log('browser closed'); process.exit(0); });
  process.on('SIGINT', async () => { await ctx.close().catch(() => {}); process.exit(0); });
  await new Promise(() => {});
}

// ---------------- API (XHR/fetch) capture ----------------
// Bodies are kept locally as evidence for "UI shows X but the server returned Y".
// Secret-looking JSON fields and form fields are redacted before writing.
function redactBody(text) {
  if (!text) return '';
  let t = String(text);
  t = t.replace(/("([^"]*)"\s*:\s*)("(?:[^"\\]|\\.)*"|\d+)/g, (m, pre, key, val) => (SECRET_KEYS.test(key) ? `${pre}"[redacted]"` : m));
  t = t.replace(/(^|&)([^=&]+)=([^&]*)/g, (m, a, k, v) => (SECRET_KEYS.test(decodeURIComponent(k)) ? `${a}${k}=[redacted]` : m));
  t = t.replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{5,}/g, '[jwt-redacted]');
  return t;
}
async function recordApi(r, page) {
  try {
    const req = r.request();
    const type = req.resourceType();
    if (type !== 'xhr' && type !== 'fetch') return;
    // The SUT's API often lives on another host (e.g. api.example.com, *.railway.app): record it, labelled with its host.
    const host = (() => { try { return new URL(r.url()).host; } catch { return ''; } })();
    if (/google-analytics|googletagmanager|doubleclick|facebook\.net|hotjar|sentry\.io|clarity\.ms/.test(host)) return;
    const ct = (r.headers()['content-type'] || '').split(';')[0];
    let body = '';
    if (/json|text|xml|form/.test(ct)) body = redactBody((await r.text().catch(() => '')).slice(0, 4000));
    const post = redactBody((req.postData() || '').slice(0, 1500));
    appendJsonl(NET, { ts: Date.now(), time: myt(), method: req.method(), url: redact(r.url()), host, ext: !hostAllowed(r.url()), path: (() => { try { return new URL(r.url()).pathname; } catch { return r.url(); } })(), status: r.status(), ct, size: Number(r.headers()['content-length'] || body.length || 0), req: post, body, page: redact(page.url()) });
  } catch (e) { try { appendJsonl(EVENTS, { ts: Date.now(), time: myt(), type: 'tb-internal', text: 'api capture: ' + String(e.message).slice(0, 200) }); } catch {} }
}

function handleDialog(d, log) {
  const s = state();
  const accept = d.type() === 'alert' || s.dialog === 'accept';
  log({ text: `${d.type()}: "${d.message().slice(0, 200)}" -> ${accept ? 'accepted' : 'dismissed'}` });
  if (d.type() !== 'alert' && s.dialog === 'accept') setState({ dialog: 'dismiss' });
  (accept ? d.accept() : d.dismiss()).catch(() => {});
}

// ---------------- connect ----------------
let browser;
async function connect() {
  try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 5000 }); }
  catch { die(`no browser on port ${PORT}. Start it with: tb chrome   (TB_TESTER=${T}${ROLE ? ' TB_ROLE=' + ROLE : ''})`); }
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  if (!pages.length) die('browser has no tabs');
  let i = state().active; if (i < 0 || i >= pages.length) i = pages.length - 1;
  const page = pages[i];
  page.on('dialog', (d) => handleDialog(d, () => {}));
  return { ctx, pages, page, index: i };
}
const done = async (code = 0) => { try { await browser?.close(); } catch {} process.exit(code); };

if (cmd === 'stop') {
  try { const b = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { timeout: 3000 }); const s = await b.newBrowserCDPSession(); await s.send('Browser.close'); console.log('stopped'); }
  catch { console.log(`nothing running on ${PORT}`); }
  process.exit(0);
}

// ---------------- snapshot ----------------
async function snapshot(page, { text = false, all = false } = {}) {
  return page.evaluate(({ text, all }) => {
    document.querySelectorAll('[data-tb-ref]').forEach((e) => e.removeAttribute('data-tb-ref'));
    const SEL = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],[role=option],[role=switch],[role=combobox],[role=slider],[contenteditable=""],[contenteditable=true],[onclick]';
    const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
    const clean = (s, n = 70) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
    const isField = (el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    const labelOf = (el) => clean(el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.innerText) || (isField(el) ? '' : el.innerText) || el.getAttribute('title') || el.getAttribute('alt') || el.querySelector?.('img[alt]')?.alt || '');
    const roleOf = (el) => el.getAttribute('role') || (el.matches(SEL) ? null : 'clickable') || ({ A: 'link', BUTTON: 'button', SELECT: 'select', TEXTAREA: 'textarea', SUMMARY: 'summary' }[el.tagName]) || (el.tagName === 'INPUT' ? (['checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'range'].includes(el.type) ? el.type : 'input') : el.tagName.toLowerCase());
    const out = []; let n = 0;
    // Visually hidden checkboxes/radios/file inputs (custom-styled) still count if not display:none
    const shown = (el) => { if (vis(el)) return true; if (el.tagName === 'INPUT' && ['checkbox', 'radio', 'file'].includes(el.type)) { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; } return false; };
    // Custom widgets: elements styled cursor:pointer whose parent is not (catches div/span onClick handlers)
    const cands = [...document.querySelectorAll(SEL)];
    let extra = 0;
    for (const el of document.querySelectorAll('div,span,li,label,img,svg,td,i,p')) {
      if (extra >= 60) break;
      if (el.matches(SEL) || el.closest(SEL)) continue;
      const cs = getComputedStyle(el);
      if (cs.cursor !== 'pointer' || (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer')) continue;
      if (vis(el)) { cands.push(el); extra++; }
    }
    cands.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const el of cands) {
      if (!all && !shown(el)) continue;
      const parent = el.parentElement && el.parentElement.closest('[data-tb-ref]');
      if (parent && !isField(el) && parent.hasAttribute('data-tb-ref')) continue;
      const ref = 'e' + (++n); el.setAttribute('data-tb-ref', ref);
      const role = roleOf(el); const bits = [`${ref} ${role}`];
      const name = labelOf(el); if (name) bits.push(`"${name}"`);
      if (role === 'link') { const h = el.getAttribute('href'); if (h && !h.startsWith('javascript')) bits.push('-> ' + h.slice(0, 60)); }
      if (isField(el)) {
        if (el.tagName === 'INPUT' && !['checkbox', 'radio', 'submit', 'button', 'reset'].includes(el.type)) bits.push(`[${el.type}]`);
        for (const a of ['name', 'placeholder', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern', 'accept']) { const v = el.getAttribute(a); if (v) bits.push(`${a}=${JSON.stringify(v.slice(0, 40))}`); }
        if (el.required) bits.push('required');
        if (el.type === 'password') bits.push('value=[hidden]');
        else if (el.tagName === 'SELECT') bits.push(`value=${JSON.stringify(el.options[el.selectedIndex]?.text || '')} options=[${[...el.options].slice(0, 12).map((o) => o.text.trim()).join(' | ')}${el.options.length > 12 ? ' | ...' : ''}]`);
        else if (['checkbox', 'radio'].includes(el.type)) bits.push(el.checked ? 'checked' : 'unchecked');
        else if (el.value) bits.push(`value=${JSON.stringify(el.value.slice(0, 60))}`);
        try { if (el.matches(':user-invalid')) bits.push(`INVALID(${JSON.stringify(el.validationMessage)})`); } catch {}
      }
      if (el.getAttribute('aria-checked')) bits.push('aria-checked=' + el.getAttribute('aria-checked'));
      if (el.getAttribute('aria-expanded')) bits.push('expanded=' + el.getAttribute('aria-expanded'));
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') bits.push('(disabled)');
      if (el.readOnly) bits.push('(readonly)');
      out.push(bits.join(' '));
      if (n >= 200) { out.push('... truncated at 200 elements'); break; }
    }
    // Layout heuristics: leads for visual defects (confirm on a screenshot before reporting)
    const warn = [];
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) warn.push(`horizontal overflow: page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);
    // An element scrolled out of an overflow container (tab strip, carousel) is hidden on purpose, not broken
    const clipped = (el, r) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') { const pr = p.getBoundingClientRect(); if (r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.bottom > pr.bottom + 1) return true; } } return false; };
    const tagged = [...document.querySelectorAll('[data-tb-ref]')].map((el) => ({ el, r: el.getBoundingClientRect(), ref: el.dataset.tbRef })).filter((x) => x.r.width > 2 && x.r.height > 2 && !clipped(x.el, x.r));
    for (let i = 0; i < tagged.length && warn.length < 10; i++) {
      const a = tagged[i];
      if (a.r.right > vw + 2 && getComputedStyle(a.el).position !== 'fixed') warn.push(`${a.ref} extends past the right edge (${Math.round(a.r.right - vw)}px)`);
      for (let j = i + 1; j < tagged.length && warn.length < 10; j++) {
        const b = tagged[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
        const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
        const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (small > 0 && (ix * iy) / small > 0.3) warn.push(`${a.ref} and ${b.ref} overlap (${Math.round((100 * ix * iy) / small)}% of the smaller one)`);
      }
    }
    for (const el of document.querySelectorAll('button,a,label,h1,h2,h3,td,th,li,p,span')) {
      if (warn.length >= 12) break;
      const cs = getComputedStyle(el);
      if (!vis(el) || !el.innerText || cs.textOverflow === 'ellipsis') continue;
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2) warn.push(`text clipped: "${clean(el.innerText, 40)}" (${el.scrollWidth}px content in ${el.clientWidth}px box)`);
    }
    const brokenImgs = [...document.images].filter((im) => im.complete && im.naturalWidth === 0 && vis(im)).slice(0, 3).map((im) => im.getAttribute('src')?.slice(0, 60));
    if (brokenImgs.length) warn.push(`broken image(s): ${brokenImgs.join(', ')}`);
    const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis).slice(0, 12).map((h) => `${h.tagName.toLowerCase()} "${clean(h.innerText, 60)}"`);
    const msgSel = '[role=alert],[role=status],[aria-live],.error,.errors,.alert,.toast,.invalid-feedback,.help-block,.notification,.message,.flash,[class*="error" i],[class*="warning" i],[class*="success" i]';
    const msgs = [...new Set([...document.querySelectorAll(msgSel)].filter(vis).map((m) => clean(m.innerText, 140)).filter(Boolean))].slice(0, 10);
    const iframes = document.querySelectorAll('iframe').length;
    return {
      url: location.href, title: document.title, heads, msgs, out, iframes, warn,
      text: text ? clean(document.body?.innerText || '', 6000) : clean(document.body?.innerText || '', 600),
    };
  }, { text, all });
}
function printSnap(s, i) {
  console.log(`URL: ${redact(s.url)}   [tab ${i}]`);
  console.log(`Title: ${s.title}`);
  if (s.heads.length) console.log(`Headings: ${s.heads.join(' | ')}`);
  console.log(`Messages: ${s.msgs.length ? s.msgs.map((m) => `"${m}"`).join(' | ') : '(none visible)'}`);
  if (s.warn && s.warn.length) console.log('Layout warnings (leads only - look at a screenshot before reporting):\n  ' + s.warn.join('\n  '));
  if (s.iframes) console.log(`Note: ${s.iframes} iframe(s) on page - elements inside iframes are not listed.`);
  console.log(`Interactive (${s.out.length}):`);
  for (const l of s.out) console.log('  ' + l);
  console.log(`Text: ${s.text}`);
}

// ---------------- action wrapper ----------------
async function describe(page, ref) {
  const loc = page.locator(`[data-tb-ref="${ref}"]`);
  if ((await loc.count()) === 0) die(`ref ${ref} not found (page changed). Run: tb snap`);
  const d = await loc.evaluate((el) => {
    const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
    const name = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].innerText) || (isField ? '' : el.innerText) || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('title') || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const role = el.getAttribute('role') || ({ A: 'link', BUTTON: 'button', SELECT: 'drop-down', TEXTAREA: 'field' }[el.tagName]) || (el.tagName === 'INPUT' ? (['checkbox', 'radio', 'submit', 'button', 'file'].includes(el.type) ? (el.type === 'submit' ? 'button' : el.type) : 'field') : ({ LABEL: 'label', IMG: 'image', SUMMARY: 'section toggle', LI: 'list item', TD: 'table cell' }[el.tagName] || 'item'));
    return { name, role, password: el.type === 'password' };
  });
  return { loc, ...d };
}

async function act(name, fn, { target = null, value: value0 = null, why = null } = {}) {
  let value = value0;
  const c = cfg(); if (!c) die('run tb init <SUT_URL> first');
  const { page, pages, ctx } = await connect();
  if (!hostAllowed(page.url()) && !['back', 'open'].includes(name)) die(`current page ${redact(page.url())} is outside allowed hosts ${c.allowHosts.join(', ')}. Use tb back or tb open <SUT path>.`);
  const s = state(); const gap = Date.now() - s.lastTs; if (gap < c.minActionGapMs) await sleep(c.minActionGapMs - gap);
  const evOffset = fs.existsSync(EVENTS) ? fs.statSync(EVENTS).size : 0;
  const netOffset = fs.existsSync(NET) ? fs.statSync(NET).size : 0;
  const before = page.url(); const nPages = pages.length; const seq = s.seq + 1;
  let t = null; let error = null;
  try { t = await fn(page); } catch (e) { error = e.message.split('\n')[0]; }
  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
  await sleep(700);
  let active = state().active;
  const now = ctx.pages();
  let cur = page;
  if (now.length > nPages) { active = now.length - 1; cur = now[active]; await cur.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {}); }
  const shot = path.join(EVID, `${ID}-${String(seq).padStart(4, '0')}-${name}.png`);
  await cur.screenshot({ path: shot }).catch(() => {});
  let info = { title: '', msgs: [] };
  try { const sn = await snapshot(cur); info = { title: sn.title, msgs: sn.msgs }; } catch {}
  await sleep(150);
  const apis = readEventsFrom(netOffset, NET).map((a) => `${a.method} ${a.ext ? a.host : ''}${a.path} ${a.status}${a.ct ? ' ' + a.ct.split('/')[1] : ''}`);
  const newEv = readEventsFrom(evOffset).filter((e) => !['nav', 'console.warning'].includes(e.type));
  const tgt = t || target;
  if (tgt?.password) value = '[password]';
  const rec = { seq, ts: Date.now(), time: myt(), tester: T, identity: ID, cmd: name, target: tgt, value, why, urlBefore: redact(before), urlAfter: redact(cur.url()), title: info.title, messages: info.msgs, api: apis.slice(0, 10), events: [...new Set(newEv.map((e) => `${e.type}${e.status ? ' ' + e.status : ''}: ${e.text.slice(0, 180)}`))], shot: rel(shot), error };
  appendJsonl(ACTIONS, rec);
  setState({ seq, lastTs: Date.now(), active });
  console.log(`#${seq} ${error ? 'FAILED' : 'ok'} ${name}${tgt ? ' ' + tgt.role + ' "' + tgt.name + '"' : ''}${value !== null ? ' <- ' + JSON.stringify(value) : ''}`);
  if (error) console.log(`  error: ${error}`);
  console.log(`  now: ${redact(cur.url())} | "${info.title}"${now.length > nPages ? ' (NEW TAB opened and selected)' : ''}`);
  if (info.msgs.length) console.log(`  messages: ${info.msgs.map((m) => `"${m}"`).join(' | ')}`);
  if (apis.length) console.log(`  api: ${apis.slice(0, 6).join(' | ')}${apis.length > 6 ? ` (+${apis.length - 6})` : ''}   (details: tb net --last ${Math.min(apis.length, 6)})`);
  if (rec.events.length) console.log(`  events: ${rec.events.slice(0, 8).join(' || ')}`);
  if (rec.events.some((e) => e.startsWith('OUT-OF-SCOPE'))) console.log('  NOTE: navigation outside the allowed hosts was blocked (not a SUT defect). Run: tb back');
  console.log(`  shot: ${rec.shot}`);
  await done(error ? 3 : 0);
}
function readEventsFrom(offset, file = EVENTS) {
  if (!fs.existsSync(file)) return [];
  const fd = fs.openSync(file, 'r'); const size = fs.statSync(file).size;
  const buf = Buffer.alloc(Math.max(0, size - offset)); fs.readSync(fd, buf, 0, buf.length, offset); fs.closeSync(fd);
  return buf.toString('utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const needRef = () => { if (!pos[0] || !/^e\d+$/.test(pos[0])) die(`usage: tb ${cmd} <ref> ...  (refs like e12 come from tb snap)`); return pos[0]; };

// ---------------- commands ----------------
switch (cmd) {
  case 'status': {
    const s = state();
    try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); console.log(`running: ${v.Browser}, identity ${ID}, port ${PORT}`); }
    catch { console.log(`not running (identity ${ID}, port ${PORT})`); process.exit(0); }
    const { pages, index } = await connect();
    console.log(`active tab ${index}: ${redact(pages[index].url())}; ${pages.length} tab(s); last action #${s.seq}; next dialog: ${s.dialog}; viewport: ${s.viewport ? s.viewport.width + 'x' + s.viewport.height : 'window'}`);
    await done();
  }
  case 'snap': {
    const { page, index } = await connect();
    let sn = await snapshot(page, { text: Boolean(flags.text), all: Boolean(flags.all) });
    // single-page apps may still be rendering: retry up to ~4 s while the page looks empty
    for (let i = 0; i < 8 && !sn.out.length && sn.text.length < 20; i++) { await sleep(500); sn = await snapshot(page, { text: Boolean(flags.text), all: Boolean(flags.all) }); }
    if (!sn.out.length && sn.text.length < 20) console.log('NOTE: page still looks empty after 4 s (slow load, canvas UI or iframe). Try tb shot and read it.');
    printSnap(sn, index);
    await done();
  }
  case 'text': {
    const { page } = await connect();
    const t = pos[0] ? await page.locator(`[data-tb-ref="${pos[0]}"]`).innerText().catch(() => die('ref not found, run tb snap')) : await page.locator('body').innerText();
    console.log(t.replace(/\n{3,}/g, '\n\n').slice(0, 12000));
    await done();
  }
  case 'find': {
    if (!pos[0]) die('usage: tb find "<visible text>"');
    const { page } = await connect();
    const hits = await page.evaluate((needle) => {
      const lc = needle.toLowerCase(); const res = [];
      const max = Math.max(0, ...[...document.querySelectorAll('[data-tb-ref]')].map((e) => Number(e.dataset.tbRef.slice(1)) || 0));
      let n = max;
      const all = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (el.innerText || '').toLowerCase().includes(lc); });
      // keep the deepest matches (no matching child)
      for (const el of all) {
        if ([...el.children].some((c) => (c.innerText || '').toLowerCase().includes(lc))) continue;
        if (!el.dataset.tbRef) el.dataset.tbRef = 'e' + (++n);
        res.push(`${el.dataset.tbRef} ${el.tagName.toLowerCase()} "${(el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)}"`);
        if (res.length >= 8) break;
      }
      return res;
    }, pos[0]);
    console.log(hits.length ? hits.join('\n') : 'no visible element contains that text');
    await done();
  }
  case 'tabs': {
    const { pages, index } = await connect();
    pages.forEach((p, i) => console.log(`${i === index ? '*' : ' '} ${i}: ${redact(p.url())}`));
    await done();
  }
  case 'tab': {
    const { pages } = await connect(); const i = Number(pos[0]);
    if (!(i >= 0 && i < pages.length)) die('no such tab'); setState({ active: i }); await pages[i].bringToFront();
    console.log(`active tab ${i}: ${redact(pages[i].url())}`); await done();
  }
  case 'js': {
    if (!pos[0]) die('usage: tb js "<expression>"');
    if (/(\bfetch\s*\(|new\s+XMLHttpRequest|sendBeacon|\.submit\(|\.click\(|localStorage\.(set|remove|clear)|sessionStorage\.(set|remove|clear)|document\.cookie\s*=|location\s*=|location\.(assign|replace|href\s*=))/.test(pos[0])) die('tb js is for read-only inspection. Use tb actions to change state.');
    const { page } = await connect();
    const r = await page.evaluate((e) => { try { const v = (0, eval)(e); return JSON.stringify(v, null, 1)?.slice(0, 4000); } catch (x) { return 'error: ' + x.message; } }, pos[0]);
    appendJsonl(ACTIONS, { seq: state().seq, ts: Date.now(), time: myt(), tester: T, cmd: 'js', value: pos[0].slice(0, 200), inspectOnly: true });
    console.log(r); await done();
  }
  case 'shot': {
    const { page } = await connect();
    const f = path.join(EVID, `${ID}-${String(state().seq).padStart(4, '0')}-${(pos[0] || 'shot').replace(/[^a-z0-9_-]+/gi, '_')}.png`);
    await page.screenshot({ path: f, fullPage: Boolean(flags.full) });
    console.log(rel(f)); await done();
  }
  case 'mark': {
    if (!pos[0]) die('usage: tb mark "<label>"');
    const s = state(); appendJsonl(ACTIONS, { seq: s.seq, ts: Date.now(), time: myt(), tester: T, cmd: 'mark', value: pos[0] });
    console.log(`mark "${pos[0]}" at #${s.seq} ${myt()} MYT`); process.exit(0);
  }
  case 'dialog': {
    if (!['accept', 'dismiss'].includes(pos[0])) die('usage: tb dialog accept|dismiss');
    setState({ dialog: pos[0] }); console.log(`next confirm/prompt dialog will be: ${pos[0]}`); process.exit(0);
  }
  case 'viewport': {
    const v = pos[0]; let vp = null;
    if (v === 'mobile') vp = { width: 390, height: 844 };
    else if (/^\d+x\d+$/.test(v || '')) { const [w, h] = v.split('x').map(Number); vp = { width: w, height: h }; }
    else if (v !== 'desktop') die('usage: tb viewport desktop|mobile|<W>x<H>');
    setState({ viewport: vp }); await sleep(900);
    console.log(`viewport: ${vp ? vp.width + 'x' + vp.height + ' (size only; no touch/UA emulation - use run-checks.mjs for that)' : 'window size'}`); process.exit(0);
  }
  case 'save-auth': {
    const { ctx } = await connect(); const f = path.join(RT, 'auth.json'); await ctx.storageState({ path: f });
    console.log(`saved ${rel(f)} (contains session tokens: never paste or share)`); await done();
  }

  // ----- actions -----
  case 'open': {
    if (!pos[0]) die('usage: tb open <url|path>');
    if (/^[A-Za-z]:[\/]/.test(pos[0])) die(`"${pos[0]}" looks like a Windows path (Git Bash rewrote a /path argument). Use the ./tb wrapper, or write the path without the leading slash.`);
    const u = new URL(pos[0], cfg()?.sutUrl || undefined);
    if (!hostAllowed(u.href)) die(`${u.host} is not in allowed hosts (${cfg().allowHosts.join(', ')}). Edit run/config.json only if the briefing allows it.`);
    await act('open', (p) => p.goto(u.href, { timeout: 30000 }).then(() => null), { value: redact(u.href) });
    break;
  }
  case 'back': await act('back', (p) => p.goBack({ timeout: 15000 }).then(() => null)); break;
  case 'forward': await act('forward', (p) => p.goForward({ timeout: 15000 }).then(() => null)); break;
  case 'reload': await act('reload', (p) => p.reload({ timeout: 30000 }).then(() => null)); break;
  case 'click': {
    const ref = needRef();
    await act(flags.double ? 'dblclick' : 'click', async (p) => {
      const d = await describe(p, ref);
      const guard = new RegExp(cfg().guard, 'i');
      if (guard.test(d.name) && !(flags.yes && typeof flags.why === 'string')) die(`"${d.name}" matches a guard word. Re-run with --yes --why "<risk id / reason>" only if this flow is in scope and uses test data.`, 4);
      const how = flags.double ? 'dblclick' : 'click';
      let forced = false;
      // Custom-styled controls are often covered by their <label>: fall back to a forced click
      await d.loc[how]({ timeout: 5000 }).catch(async (e) => { if (!/intercepts pointer|not visible|outside of the viewport|Timeout/i.test(e.message)) throw e; forced = true; await d.loc[how]({ force: true, timeout: 5000 }); });
      return { role: d.role, name: d.name, ...(forced ? { forced: true } : {}) };
    }, { why: flags.why || null });
    break;
  }
  case 'fill': case 'type': {
    const ref = needRef(); if (pos[1] === undefined) die(`usage: tb ${cmd} <ref> "<text>"`);
    await act(cmd, async (p) => {
      const d = await describe(p, ref);
      if (cmd === 'fill') await d.loc.fill(pos[1], { timeout: 8000 });
      else { await d.loc.click({ timeout: 8000 }); await d.loc.pressSequentially(pos[1], { delay: 30 }); }
      return { role: d.role, name: d.name, password: d.password };
    }, { value: pos[1] });   // act() replaces the value with [password] for password fields
    break;
  }
  case 'clear': { const ref = needRef(); await act('clear', async (p) => { const d = await describe(p, ref); await d.loc.fill(''); return { role: d.role, name: d.name }; }); break; }
  case 'select': { const ref = needRef(); await act('select', async (p) => { const d = await describe(p, ref); await d.loc.selectOption({ label: pos[1] }).catch(() => d.loc.selectOption(pos[1])); return { role: d.role, name: d.name }; }, { value: pos[1] }); break; }
  case 'check': case 'uncheck': { const ref = needRef(); await act(cmd, async (p) => { const d = await describe(p, ref); await (cmd === 'check' ? d.loc.check() : d.loc.uncheck()); return { role: d.role, name: d.name }; }); break; }
  case 'hover': { const ref = needRef(); await act('hover', async (p) => { const d = await describe(p, ref); await d.loc.hover(); return { role: d.role, name: d.name }; }); break; }
  case 'press': {
    if (!pos[0]) die('usage: tb press <Key> [<ref>]');
    await act('press', async (p) => { if (pos[1]) { const d = await describe(p, pos[1]); await d.loc.press(pos[0]); return { role: d.role, name: d.name }; } await p.keyboard.press(pos[0]); return null; }, { value: pos[0] });
    break;
  }
  case 'upload': {
    const ref = needRef(); const f = pos[1]; if (!f || !fs.existsSync(f)) die('usage: tb upload <ref> <existing file>');
    await act('upload', async (p) => { const d = await describe(p, ref); await d.loc.setInputFiles(f); return { role: d.role, name: d.name }; }, { value: path.basename(f) });
    break;
  }
  case 'scroll': {
    const t = pos[0] || 'down';
    await act('scroll', async (p) => {
      if (/^e\d+$/.test(t)) { const d = await describe(p, t); await d.loc.scrollIntoViewIfNeeded(); return { role: d.role, name: d.name }; }
      await p.evaluate((t) => { const h = window.innerHeight * 0.8; if (t === 'top') scrollTo(0, 0); else if (t === 'bottom') scrollTo(0, document.body.scrollHeight); else scrollBy(0, t === 'up' ? -h : h); }, t);
      return null;
    }, { value: /^e\d+$/.test(t) ? null : t });
    break;
  }

  // ----- evidence -----
  case 'steps': {
    const all = readJsonl(ACTIONS);
    let from = flags.from ? Number(flags.from) : 1; let to = flags.to ? Number(flags.to) : Infinity;
    if (flags.mark) {
      const mi = all.findIndex((r) => r.cmd === 'mark' && r.value === flags.mark);
      if (mi < 0) die(`mark "${flags.mark}" not found`);
      from = all[mi].seq + 1;
      const next = all.slice(mi + 1).find((r) => r.cmd === 'mark'); if (next) to = next.seq;
    }
    const acts = all.filter((r) => r.cmd !== 'mark' && !r.inspectOnly && r.seq >= from && r.seq <= to);
    if (!acts.length) die('no actions in that range');
    const q = (r) => (r.target ? `"${r.target.name || '(unnamed)'}" ${r.target.role}` : '');
    const line = (r) => ({
      open: `Navigate to ${r.value}`,
      click: `Click the ${q(r)}`, dblclick: `Double-click the ${q(r)}`,
      fill: `Enter ${r.target?.password ? '[test password]' : JSON.stringify(r.value)} in the ${q(r)}`,
      type: `Type ${r.target?.password ? '[test password]' : JSON.stringify(r.value)} into the ${q(r)}`,
      clear: `Clear the ${q(r)}`, select: `Select ${JSON.stringify(r.value)} from the ${q(r)}`,
      check: `Tick the ${q(r)}`, uncheck: `Untick the ${q(r)}`, hover: `Hover over the ${q(r)}`,
      press: `Press ${r.value}${r.target ? ' in the ' + q(r) : ''}`, upload: `Upload file ${r.value} via the ${q(r)}`,
      scroll: r.target ? `Scroll to the ${q(r)}` : `Scroll ${r.value}`,
      back: 'Click the browser Back button', forward: 'Click the browser Forward button', reload: 'Refresh the page (F5)',
    }[r.cmd] || `${r.cmd} ${r.value ?? ''}`);
    console.log(`Steps (#${acts[0].seq}-#${acts[acts.length - 1].seq}, ${acts[0].time} to ${acts[acts.length - 1].time} MYT, ${ROLE ? 'identity ' + ID : 'tester ' + T}):`);
    acts.forEach((r, i) => console.log(`${i + 1}. ${line(r)}${r.error ? '  [action failed: ' + r.error + ']' : ''}`));
    const last = acts[acts.length - 1];
    console.log(`\nObserved after last step: URL ${last.urlAfter}; title "${last.title}"${last.messages?.length ? '; messages: ' + last.messages.map((m) => `"${m}"`).join(' | ') : ''}`);
    const evs = acts.flatMap((r) => r.events || []); if (evs.length) console.log(`Events during steps: ${[...new Set(evs)].join(' || ')}`);
    console.log(`Evidence: ${acts.map((r) => r.shot).filter(Boolean).slice(-3).join(', ')}`);
    process.exit(0);
  }
  case 'errors': {
    let evs = readJsonl(EVENTS).filter((e) => e.type !== 'nav' && (flags.warnings || e.type !== 'console.warning'));
    if (flags.mark) {
      const all = readJsonl(ACTIONS); const mi = all.findIndex((r) => r.cmd === 'mark' && r.value === flags.mark);
      if (mi < 0) die(`mark "${flags.mark}" not found`);
      const next = all.slice(mi + 1).find((r) => r.cmd === 'mark');
      evs = evs.filter((e) => e.ts >= all[mi].ts && (!next || e.ts < next.ts));
    }
    const grouped = new Map();
    for (const e of evs) { const k = `${e.type}|${e.status ?? ''}|${e.text}|${e.page}`; const g = grouped.get(k) || { ...e, n: 0 }; g.n++; g.time = e.time; grouped.set(k, g); }
    const out = [...grouped.values()].slice(-(Number(flags.last) || 40));
    if (!out.length) console.log('no console errors / HTTP errors / dialogs recorded in range' + (flags.warnings ? '' : ' (add --warnings to include console warnings)'));
    for (const e of out) console.log(`${e.time} ${e.type}${e.status ? ' ' + e.status : ''}${e.n > 1 ? ' (x' + e.n + ')' : ''}: ${e.text.slice(0, 300)}  @ ${e.page}`);
    process.exit(0);
  }
  case 'net': {
    let calls = readJsonl(NET);
    if (flags.mark) {
      const all = readJsonl(ACTIONS); const mi = all.findIndex((r) => r.cmd === 'mark' && r.value === flags.mark);
      if (mi < 0) die(`mark "${flags.mark}" not found`);
      const next = all.slice(mi + 1).find((r) => r.cmd === 'mark');
      calls = calls.filter((c) => c.ts >= all[mi].ts && (!next || c.ts < next.ts));
    }
    if (flags.grep) calls = calls.filter((c) => (c.url + ' ' + c.req + ' ' + c.body).toLowerCase().includes(String(flags.grep).toLowerCase()));
    calls = calls.slice(-(Number(flags.last) || 15));
    if (!calls.length) { console.log('no XHR/fetch calls recorded in range (the SUT may render server-side; then the page itself is the only oracle)'); process.exit(0); }
    for (const c of calls) {
      console.log(`${c.time} ${c.method} ${c.url} -> ${c.status} ${c.ct || ''} ${c.size ? '(' + c.size + ' B)' : ''}`);
      if (c.req) console.log(`  request: ${c.req.slice(0, flags.body ? 1500 : 200)}`);
      if (c.body) console.log(`  response: ${c.body.slice(0, flags.body ? 4000 : 300)}`);
    }
    console.log('(secret-looking fields are redacted; use --body for full stored bodies)');
    process.exit(0);
  }
  case 'perf': {
    const runs = Math.min(Number(pos[0]) || 3, 5);
    const { page } = await connect();
    if (!hostAllowed(page.url())) die('current page outside allowed hosts');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const res = [];
    for (let i = 0; i < runs; i++) {
      await sleep(1000);
      await page.reload({ waitUntil: 'load', timeout: 60000 });
      await sleep(800);
      res.push(await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] || {}; const f = performance.getEntriesByName('first-contentful-paint')[0]; const r = performance.getEntriesByType('resource'); return { ttfb: n.responseStart, fcp: f?.startTime, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, req: r.length + 1, bytes: r.reduce((s, x) => s + (x.transferSize || 0), 0) + (n.transferSize || 0) }; }));
    }
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
    const med = (k) => { const s = res.map((r) => r[k]).filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
    const sec = (ms) => (Number.isFinite(ms) ? (ms / 1000).toFixed(2) + ' s' : 'n/a');
    const v = await browser.version();
    console.log(`Performance of ${redact(page.url())} (Chromium ${v}, ${(await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).Browser.startsWith('Headless') ? 'headless' : 'headed'}, cache disabled, current login state, unthrottled, median of ${runs}):`);
    console.log(`  load ${sec(med('load'))} (runs ${res.map((r) => sec(r.load)).join(' / ')}); DCL ${sec(med('dcl'))}; FCP ${sec(med('fcp'))}; TTFB ${sec(med('ttfb'))}; ${med('req')} requests; ${(med('bytes') / 1024).toFixed(0)} KB`);
    console.log('  Lab measurement on one machine/network, not a load test.');
    appendJsonl(ACTIONS, { seq: state().seq, ts: Date.now(), time: myt(), tester: T, cmd: 'perf', value: { url: redact(page.url()), runs: res }, inspectOnly: true });
    await done();
  }
  case 'a11y': {
    const { page } = await connect();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const f = path.join(EVID, `${ID}-${String(state().seq).padStart(4, '0')}-axe.json`);
    writeJson(f, { url: redact(page.url()), time: myt(), violations: r.violations });
    console.log(`axe-core ${r.testEngine.version} on ${redact(page.url())}: ${r.violations.length} rule violation(s), ${r.incomplete.length} need manual review`);
    for (const x of r.violations) console.log(`  [${x.impact}] ${x.id}: ${x.help} - ${x.nodes.length} element(s), e.g. ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
    console.log(`  full result: ${rel(f)}`);
    await done();
  }
  default: die(`unknown command "${cmd}". Run: tb help`);
}
