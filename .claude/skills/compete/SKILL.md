---
name: compete
description: Run the whole 180-minute competition as tester $TB_TESTER - A does recon, plan and task publishing; then both agents claim tasks from the shared board (GitHub Issues) until 12:25, sync bug packs to the results branch, and A integrates everything into the report. Pauses only at the three human gates. Usage /compete <SUT_URL>
---
Read CLAUDE.md first. Check `echo $TB_TESTER`, `./tb status`, `gh auth status`, and the clock (`./rec stats` prints MYT).

## Phase 1 - Tester A only (10:00-10:15)
1. If `run/config.json` is missing or points elsewhere, ask the human to run `./tb init <SUT_URL>`. Make sure `./tb chrome` is running.
2. `/recon` (parallel recon-workers), then `/plan` (GATE 1: wait for approval). `/plan` ends by publishing the task list (`./board add ...`) and running `./board sync` so tester B receives risks.csv and the plan.

## Phase 1 - Tester B (10:00-10:15)
1. `./tb init <same SUT_URL>` (the human), `./tb chrome`. Do a light read-only tour of the SUT (`./tb snap` on 3-4 pages) to warm up; do NOT write run/recon.md or the plan.
2. Poll `./board list` every 2 minutes until tasks appear. Then `./board collect` (it copies A's risks.csv) and `./rec list risks`.

## Phase 2 - Both testers: the task loop (10:15-12:25)
Repeat until 12:25:
1. `./board next` claims the best open task (your own suggestions first, then the other tester's: work stealing). It prints the task body.
2. Run the skill for the task type:
   - design: `/design R-xx`, then publish an execute task if the body says so
   - execute: `/execute R-xx` (or the TC ids in the body)
   - explore: `/explore "<charter>" R-xx`
   - nfr: `/nfr "<pages>"`
   - roles: `/roles <role>`
   - retest / other: follow the body
   Every suspected defect goes through `/bug` (parallel repro-workers; the evidence pack is built automatically on Verified).
3. Finish: `./board done <#> "<one line: cases run, defects D-xx, notes>"`. Blocked: `./board block <#> "<what the human must do>"` and tell your human.
4. Run `./board sync` after every `board done` and after every Verified defect, so the team results stay current.
5. New work discovered (an area nobody owns, a retest after a fix, a promising charter): `./board add '{...}'` instead of doing it silently, unless it takes under 3 minutes.
Every 30 minutes: a 3-line sync to your human (done / found / next) plus `./board list`.
At about 11:30: `/status`.

## Phase 3 - Wrap-up (12:20-12:50)
- Tester B, at 12:20: finish or `board release` the current task, `./rec pack --all`, `./board sync`, and tell the human "B synced". Keep executing small tasks until 12:25, then sync again.
- Tester A, at 12:25: `./board collect` (B's records + packs into run/B/), `./rec pack --all`, then `/report` (GATE 3).

## Always
- If the SUT is down for more than 2 minutes, record the time, tell the human, and switch to records or report work.
- If a `tb` command fails twice the same way, try a different approach (`tb find`, scroll, re-snap). After that, ask the human instead of fighting the UI.
- If `board` cannot reach GitHub, keep testing, keep the records locally, and tell the human. The humans can coordinate verbally and sync later.
