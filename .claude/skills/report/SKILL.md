---
name: report
description: Summary test report (12:25) filled strictly from rec data into competition-day/02-summary-report.md structure; GATE 3 human review of every number.
---
Tester A writes the team report from both testers' data: `./board collect` pulls B's records and bug packs into run/B/, then `./rec pack --all` (re)builds every evidence pack. Check that `./rec stats` says "Data from: run/A, run/B"; if B's data is missing, ask the human whether B has synced.

1. Freeze data: `./board list --all` (task coverage), `./rec stats`, the evidence packs `run/A/bugs/D-*/evidence-pack.md` and `run/B/bugs/D-*/evidence-pack.md` (the Defects section and the top findings come from these, with their defect_type, location and DevTools lines), `./rec list risks`, `./rec list defects --all --full`, `./rec list nfr --full`, `./rec list ailog --full`, `run/recon.md`, `run/$TB_TESTER/sessions.md`.
2. Write `run/summary-report.md` following `competition-day/02-summary-report.md` section by section. Every [FILL] comes from the data above; if data is missing, write "not recorded" rather than estimating.
   - Keep Passed / Failed / Blocked / Not Run separate; show denominators.
   - Defect counts by severity count Submitted (and say how many Verified were not submitted in time).
   - Risks Not tested or Smoke only go into residual risks, with the reason.
   - Non-functional: measurement method, environment, repeats, units, lab-measurement limitation.
   - Use of AI (section 10): describe the real workflow. Agents explored and executed through a logged CDP CLI; every action was screenshotted and replayable; data was validated (rec); humans approved the plan, reviewed every defect before submission and checked report numbers; numbers of AI log entries, dropped defects and human corrections come from the log.
   - Executive summary last, max 5 sentences, a cautious release recommendation based only on evidence.
3. GATE 3: give the human the file path and a list of every number with its source (e.g. "Executed 34 = rec stats Passed 25 + Failed 6 + Blocked 3"). Wait for corrections, apply them, and tell them to submit by 12:50.
4. `./rec add ailog '{"prompt_id":"P8","activity":"Summary report draft",...}'`.
