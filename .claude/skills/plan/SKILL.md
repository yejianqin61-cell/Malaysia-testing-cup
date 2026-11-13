---
name: plan
description: Competition minute 10-15. Build the shared risk list with rec and a paste-ready test plan from competition-day/01-test-plan.md; stop at GATE 1 for human approval.
---
Only tester A runs this. Tester B receives the risks and tasks through `./board collect` / `./board list`.

1. Read `run/recon.md` and `competition-day/01-test-plan.md`.
2. Build 5-8 product risks from OBSERVED features only. Impact 1-5 (5 = money/data loss or core journey blocked, 1 = cosmetic); likelihood 1-5 (higher for calculations, many inputs, state changes, integrations, unclear rules). For each:
   `./rec add risks '{"feature":"...","impact_1to5":5,"likelihood_1to5":4,"reason":"...","owner":"A"}'` (score and priority are computed).
   Split owners so A and B do not overlap and each has at least one High risk. Give B the non-functional-heavy areas.
3. Write `run/test-plan.md`: a copy of 01-test-plan.md with every [FILL] filled from recon and the risk list. Delete the hint lines in < >. Scope lists observed features; out-of-scope lists what we will not test and why. Section 3 uses the exact `rec list risks` rows. Section 4 says AI agents execute tests through a logged CDP browser CLI under human supervision, and humans approve the plan, review every defect before submission, and review the report. Keep it truthful.
4. `./rec add ailog '{"prompt_id":"P2","activity":"Risk analysis and test plan draft",...}'`
5. GATE 1: show the human the risk list (`./rec list risks`) and the path of the plan. Ask: "Approve risks and owners? Edit anything?" Wait. Apply their edits with `rec update risks`. Tell them to submit the plan on the platform.
6. Publish the task list on the shared board (`./board init` once per run, then one `./board add` per task):
   - one task per High or Medium risk: `{"title":"Test R-0x <feature> (design + execute)","type":"execute","risk":"R-0x","suggest":"<risk owner>","prio":1 for High, 2 for Medium,"detail":"pages, rules, inputs from recon; techniques to use; known suspects"}`
   - one non-functional task: `{"title":"Non-functional session","type":"nfr","suggest":"B","prio":1,"detail":"key pages ...; perf + a11y + responsive + usability"}`
   - one roles task if recon found roles: `{"type":"roles","suggest":"A","prio":1,...}`
   - one explore task per High risk (charter in the title), prio 2, suggested to the other tester than the risk owner (a fresh pair of eyes)
   - Low risks: one combined smoke task, prio 3
   Each detail must be self-contained: the claiming agent may not have read run/recon.md.
7. `./board sync` (puts risks.csv, recon.md and test-plan.md on the results branch for tester B), then `./board list`, and tell the human how many tasks were published.
