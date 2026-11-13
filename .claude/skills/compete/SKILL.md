---
name: compete
description: Run the whole 180-minute competition autonomously as tester $TB_TESTER - recon, plan, design, execute/explore/bug, nfr, status, report - pausing only at the three human gates. Usage /compete <SUT_URL>
---
Read CLAUDE.md first. Check `echo $TB_TESTER`, `./tb status`, and the clock (`./rec stats` prints MYT).

Tester A:
1. If `run/config.json` is missing or points elsewhere, ask the human to run `./tb init <SUT_URL>` (allowed hosts are their decision). Make sure `./tb chrome` is running.
2. `/recon`, then `/plan` (GATE 1: wait for approval).
3. For each own risk, High first: `/design R-xx`, then `/execute R-xx`. Between risks run one `/explore` charter on the riskiest area.
4. At about 11:30: `/status`. Re-plan the remaining time toward under-tested High risks and Verified-but-unsubmitted defects.
5. At 12:25: stop executing. `/report` (GATE 3).

Tester B:
1. Wait until the human gives you the shared risk list (`./rec import risks <file>`, or rows pasted in chat that you import with `./rec import risks -`). Meanwhile do a light `/recon` of the areas B is likely to own, without writing run/test-plan.md.
2. 10:35-11:00: `/nfr` on the key pages.
3. Then own risks: `/design`, `/execute`, `/explore`, the same as A.
4. At about 11:30: `/status`. At 12:20: send your final numbers to the human for A's report, then keep executing until 12:25.

Both, all the time:
- Every suspected problem goes to `/bug`. Verified ones are queued for the human (GATE 2) without stopping.
- Every 30 minutes, a 3-line sync to your human: done / found / next.
- If the SUT is down for more than 2 minutes, record the time, tell the human, and switch to records or report work.
- If a `tb` command fails twice the same way, try a different approach (`tb find`, scroll, re-snap). After that, ask the human instead of fighting the UI.
