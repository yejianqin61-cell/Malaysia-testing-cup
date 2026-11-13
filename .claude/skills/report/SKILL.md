---
name: report
description: Summary test report (12:25) filled strictly from rec data into competition-day/02-summary-report.md structure; GATE 3 human review of every number.
---
Tester A writes the team report; tester B first sends A its numbers (the human pastes B's `./rec stats` output and `./rec copy defects` rows into the shared sheet, or gives them to A).

1. Freeze data: `./rec stats` (and B's stats from the human), `./rec list risks`, `./rec list defects --all --full`, `./rec list nfr --full`, `./rec list ailog --full`, `run/recon.md`, `run/$TB_TESTER/sessions.md`.
2. Write `run/summary-report.md` following `competition-day/02-summary-report.md` section by section. Every [FILL] comes from the data above; if data is missing, write "not recorded" rather than estimating.
   - Keep Passed / Failed / Blocked / Not Run separate; show denominators.
   - Defect counts by severity count Submitted (and say how many Verified were not submitted in time).
   - Risks Not tested or Smoke only go into residual risks, with the reason.
   - Non-functional: measurement method, environment, repeats, units, lab-measurement limitation.
   - Use of AI (section 10): describe the real workflow. Agents explored and executed through a logged CDP CLI; every action was screenshotted and replayable; data was validated (rec); humans approved the plan, reviewed every defect before submission and checked report numbers; numbers of AI log entries, dropped defects and human corrections come from the log.
   - Executive summary last, max 5 sentences, a cautious release recommendation based only on evidence.
3. GATE 3: give the human the file path and a list of every number with its source (e.g. "Executed 34 = rec stats Passed 25 + Failed 6 + Blocked 3"). Wait for corrections, apply them, and tell them to submit by 12:50.
4. `./rec add ailog '{"prompt_id":"P8","activity":"Summary report draft",...}'`.
