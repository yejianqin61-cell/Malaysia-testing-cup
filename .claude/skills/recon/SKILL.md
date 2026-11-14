---
name: recon
description: Competition minute 0-10. Parallel breadth-first tour of the unknown SUT - map the top-level navigation, fork tb worker browsers, dispatch recon-worker sub-agents per area at the same time, stream findings to run/LIVE.md, then merge them into run/recon.md.
---
Goal: in about 10 minutes, know what the SUT does. Do not hunt bugs yet; note suspicions in one line and move on.

## 1. Map the top level (about 1 minute, main browser)
`./tb status` (start `./tb chrome` in the background if it is not running), then `./tb snap`. Note the SUT name, version, login state and the top-level navigation. If a login is needed, ask the human to log in in the window first, because workers inherit this browser's login.

## 2. Split and fork (about 30 seconds)
Group the navigation into 2-4 areas of similar size by user journey (for example: browse and search / cart and checkout / account and profile / admin). Then:
`./tb fork <number of areas>`. Each worker browser (w1..wn) inherits the current login (cookies, localStorage, sessionStorage) and the current page.
If the SUT is small (5 pages or fewer), skip forking and do the tour yourself (step 4 only).

## 3. Dispatch in parallel (about 6 minutes)
In ONE message, launch one `recon-worker` sub-agent per area, so they run at the same time. Each prompt contains: the worker id (w1, w2, ...), TB_TESTER, the area name and slug, and the exact pages or links to cover (paths from your snap). Example prompt:
"Worker id w2, tester A. Area: cart-checkout. Pages: /cart, /checkout, /orders. Follow your agent instructions; stream findings with rec note recon-cart-checkout ... --by w2."
While they run, do not wait idle:
- Do the mobile pass yourself on the 2-3 key pages: `./tb viewport mobile`, `./tb shot <page>-mobile`, READ them, `./tb viewport desktop`.
- Open `run/LIVE.md`: worker notes appear there as they are written. Pass any striking SUSPECT line to the human at once.

## 4. Merge (about 2 minutes)
When all workers have reported, write `run/recon.md` (English) from their final answers plus `run/notes/recon-*.md`:
- SUT: name, URL, version/build if shown, browser used
- Feature map grouped by user journey: OBSERVED features only, each with page path and key inputs/rules
- Business rules seen (exact quotes)
- Roles seen or suspected, and how a second identity could log in
- API style and endpoints (an API on another host is common)
- Open questions / unclear requirements (they become "Assumed convention" oracles)
- Hypotheses: features suspected but not seen (clearly labelled)
- Suspicions with worker id, seq number and screenshot path
Resolve conflicts between workers by looking yourself (`./tb snap` / screenshot). Never merge a claim you cannot trace.
Keep the workers running: /bug reuses them for reproductions. Stop them with `./tb workers stop` only when they are no longer needed.

## 5. Log and hand over
`./rec add ailog '{"prompt_id":"P1","activity":"Parallel reconnaissance (N recon-worker sub-agents)","input_summary":"N areas, M pages","output_summary":"run/recon.md: N features, N rules, N questions, N suspicions","how_verified":"every feature traced to tb snapshots of the workers; conflicts re-checked by the lead","used_in":"Test plan scope"}'`
Tell the human: a 5-line summary of the feature map plus the open questions to check against the briefing. Then continue with `/plan`.
