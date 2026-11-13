---
name: bug
description: Defect pipeline for a suspected problem - skeptical triage, two clean reproductions with tb, severity, rec record, and a paste-ready report queued for human submission (GATE 2). Usage /bug "<what looked wrong>" [TC-id]
---
Invalid or enhancement-type reports lose points, so be your own harshest reviewer.

1. Triage before spending time:
   - Is there a basis for the expected behaviour (requirement, on-screen rule, clear convention)? If it is only "would be nicer", it is an enhancement: drop it (note it for the report's suggestions).
   - Could it be our own data, timing, network, the blocked out-of-scope navigation, or our viewport emulation? Rule these out. A visual defect seen only through `tb viewport` should be re-checked with `node automation/run-checks.mjs --checks shots` (real mobile emulation) before it is called a defect.
   - Duplicate? `./rec list defects --all`, and ask the human whether the other tester has it (one line).
2. Log it right away: `./rec add defects '{"title":"[Feature] what is wrong when/after condition","feature":"...","severity":"...","steps":"(pending)","expected":"...","actual":"...","evidence":"<shot path>","case_id":"...","risk_id":"...","repro":"1/1"}'` (status is Suspected).
3. Reproduce twice from a clean start, as separate marks:
   `./tb mark "<D-id> repro 1"`, then `./tb open <start page>`, perform the minimal steps, and note the outcome. Repeat with `"<D-id> repro 2"`. If it is intermittent, try up to 5 times and report "x/5".
   Minimise the steps: remove any step that is not needed to trigger the problem.
4. Build the report from evidence, not memory:
   - steps: `./tb steps --mark "<D-id> repro 2"` (exact values, button names)
   - console/HTTP: `./tb errors --mark "<D-id> repro 2"`
   - API evidence when relevant: `./tb net --mark "<D-id> repro 2"`. Quote the exact field ("API returns price 45.0, UI shows RM 40.00"). Never paste tokens; the tool redacts known secret fields, but check anyway.
   - final screenshot: `./tb shot <D-id>-actual`. For a visual defect, READ the screenshot and describe exactly what is wrong and where. A Layout warning alone is never evidence.
   Severity (impact on user/business): Critical = core function unusable, data loss, money or security impact, no workaround; High = major function wrong, hard workaround; Medium = partly wrong, workaround exists; Low = cosmetic. Priority separately (P1/P2/P3). No root-cause claims ("Root cause not investigated").
5. If reproduced at least 2 times: `./rec update defects <D-id> '{"status":"Verified","repro":"2/2","steps":"...","evidence":"..."}'`.
   If it is not reproducible or not a defect: status "Dropped-not a bug" with the reason in actual.
6. GATE 2 (do not wait): write `run/$TB_TESTER/bugs/<D-id>.md` in the exact format of `competition-day/05-bug-writing-guide.md` (Title, Severity + reason, Priority, Environment with browser version and MYT time, Preconditions, Steps, Expected + basis, Actual with exact text/numbers, Reproducibility, Impact, Evidence file names, Related TC/R ids). Tell the human in one line: "D-A03 ready to submit: run/A/bugs/D-A03.md (High)". Continue testing.
   When the human replies with the platform ID: `./rec update defects <D-id> '{"status":"Submitted","platform_id":"<id>","reviewed_by":"AI+<A|B>"}'`.
7. `./rec add ailog '{"prompt_id":"P5","activity":"Defect triage and report <D-id>","input_summary":"suspected: ...","output_summary":"Verified/Dropped, severity ...","how_verified":"reproduced 2/2 via tb marks; human reviewed before submission","used_in":"Defect report"}'`.
