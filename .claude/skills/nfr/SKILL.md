---
name: nfr
description: Non-functional testing session (performance, accessibility, compatibility, responsive, usability, reliability, passive security) with run-checks.mjs and tb; results recorded with rec nfr. Usage /nfr "<key pages>"
---
Normally tester B owns this, for about 25 minutes, around 10:35-11:00.

1. Batch checks for 3-5 key pages (logged-out pages directly; logged-in pages after `./tb save-auth`):
   `node automation/run-checks.mjs --url <SUT_URL> --pages "./,<p1>,<p2>" [--auth .tb/$TB_TESTER/auth.json]`
   then again with `--checks perf --throttle fast3g` for the 1-2 most important pages.
   `./rec import-nfr automation/out/<run>/nonfunctional.csv`
2. In-session checks (current login state): `./tb perf 3` on a key logged-in page; `./tb a11y` on a form after a failed submit (are error messages announced and labelled?); `./tb viewport mobile` and walk the main journey (menu, forms, buttons, tables usable?), then `./tb viewport desktop`.
3. Usability heuristic review (Nielsen): pick 2-3 concrete observations from the journeys you saw: system status (loading feedback), error messages (which field, how to fix), user control (cancel/undo, confirm before delete), consistency (labels, buttons). `./rec add nfr '{"category":"Usability","scenario":"...","environment":"...","method":"Heuristic evaluation (Nielsen: <heuristic>)","observation_units":"...","repeats":"1","user_impact":"...","evidence":"<shot>","verdict":"Finding"}'`
4. Passive security only (Security (passive)): password field masked, HTTPS, error messages that do not reveal whether an account exists, sensitive data in URLs. No probing.
5. Review every imported row: set `baseline_expectation` (with basis: requirement, WCAG criterion, Core Web Vitals "good" LCP <= 2.5 s, convention), `user_impact`, and `verdict` (Finding / No issue). Merge duplicate rows (same axe rule on many pages = one finding listing the pages). A serious functional consequence (e.g. button unreachable on mobile) also goes through `/bug`.
6. `./rec add ailog '{"prompt_id":"P6",...}'`. Tell the human the top 3 non-functional findings.
