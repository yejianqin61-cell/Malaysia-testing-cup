---
name: plan
description: Competition minute 10-15. Build the shared risk list with rec and a paste-ready test plan from competition-day/01-test-plan.md; stop at GATE 1 for human approval.
---
Only tester A runs this (B waits for the shared risks, then imports them with `./rec import risks <file>` or from the human's paste).

1. Read `run/recon.md` and `competition-day/01-test-plan.md`.
2. Build 5-8 product risks from OBSERVED features only. Impact 1-5 (5 = money/data loss or core journey blocked, 1 = cosmetic); likelihood 1-5 (higher for calculations, many inputs, state changes, integrations, unclear rules). For each:
   `./rec add risks '{"feature":"...","impact_1to5":5,"likelihood_1to5":4,"reason":"...","owner":"A"}'` (score and priority are computed).
   Split owners so A and B do not overlap and each has at least one High risk. Give B the non-functional-heavy areas.
3. Write `run/test-plan.md`: a copy of 01-test-plan.md with every [FILL] filled from recon and the risk list. Delete the hint lines in < >. Scope lists observed features; out-of-scope lists what we will not test and why. Section 3 uses the exact `rec list risks` rows. Section 4 says AI agents execute tests through a logged CDP browser CLI under human supervision, and humans approve the plan, review every defect before submission, and review the report. Keep it truthful.
4. `./rec add ailog '{"prompt_id":"P2","activity":"Risk analysis and test plan draft",...}'`
5. GATE 1: show the human the risk list (`./rec list risks`) and the path of the plan. Ask: "Approve risks and owners? Edit anything?" Wait. Apply their edits with `rec update risks`. Then run `./rec copy risks` so they can paste it into the shared sheet and give the rows to tester B. Tell them to submit the plan on the platform.
