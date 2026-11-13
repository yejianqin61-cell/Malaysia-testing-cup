---
name: bug
description: Defect pipeline - skeptical triage, then two independent reproductions dispatched in parallel to repro-worker sub-agents in separate tb worker browsers while you keep testing; evidence and the report update live (run/LIVE.md), and the paste-ready report is queued for human submission (GATE 2). Usage /bug "<what looked wrong>" [TC-id]
---
Invalid or enhancement-type reports lose points, so be your own harshest reviewer.

## 1. Triage (you, about 1 minute)
- Is there a basis for the expected behaviour (requirement, on-screen rule, clear convention)? If it is only "would be nicer", it is an enhancement: drop it (note it for the report's suggestions).
- Could it be our own data, timing, network, the blocked out-of-scope navigation, or our viewport emulation? Rule these out. A visual defect seen only through `tb viewport` must be re-checked with `node automation/run-checks.mjs --checks shots` (real mobile emulation) before it is called a defect.
- Duplicate? `./rec list defects --all`, and ask the human whether the other tester has it (one line).

## 2. Log it at once (status Suspected, so it shows on the live board)
`./rec add defects '{"title":"[Feature] what is wrong when/after condition","feature":"...","severity":"...","steps":"(pending)","expected":"...","actual":"...","evidence":"<shot path>","case_id":"...","risk_id":"...","repro":"1/1"}'`
Get the finder's steps with `./tb steps --mark <the mark you were in>`, and minimise them (remove every step that is not needed).

## 3. Reproduce in parallel, without stopping your own testing
- Workers: `./tb workers` (reuse them if they are running), otherwise `./tb fork 2`.
- Shared-state check: if the steps change account state (cart, order, profile, post, booking), two workers on the same account interfere. Then either run ONE repro-worker at a time, or have the human give a second account (`/roles`).
- In ONE message, launch two `repro-worker` sub-agents in the background (w1 and w2). Each prompt contains: the worker id, the defect id, the start page, the minimal numbered steps with exact test data, the expected result with its basis, and the finder's actual result. Guard-word steps need an explicit `--why` reason in the prompt.
- Meanwhile continue your current test case or charter in your main browser. Do not wait.
- Their streamed notes (`run/notes/<D-id>.md`) and the defect row appear on `run/LIVE.md` as they happen.

## 4. Decide when both report
- Both REPRODUCED: `./rec update defects <D-id> '{"status":"Verified","repro":"3/3","steps":"<numbered steps from the cleaner worker run>","evidence":"<finder shot>; <w1 shot>; <w2 shot>"}'` (finder + 2 independent runs = 3/3).
- One reproduced: run a third attempt yourself or with one worker; report "x/y" honestly, and mark it intermittent if it stays inconsistent.
- None reproduced: compare the steps. A step difference may be the real trigger, so retry once with the finder's exact steps. Still nothing: status "Dropped-not a bug", with the reason in actual.
- Evidence to quote: steps from `tb steps`; console/HTTP from the workers' errors output; API fields ("API returns price 45.0, UI shows RM 40.00"); the final screenshot. For a visual defect, describe exactly what is wrong and where; a Layout warning alone is never evidence. Never paste tokens.
- Severity (impact on the user or business): Critical = core function unusable, data loss, money or security impact, no workaround; High = major function wrong, hard workaround; Medium = partly wrong, workaround exists; Low = cosmetic. Priority separately (P1/P2/P3). No root-cause claims ("Root cause not investigated").

## 5. GATE 2 (do not wait)
Write `run/$TB_TESTER/bugs/<D-id>.md` in the exact format of `competition-day/05-bug-writing-guide.md` (Title, Severity + reason, Priority, Environment with browser version and MYT time, Preconditions, Steps, Expected + basis, Actual with exact text/numbers, Reproducibility "3/3 (finder + 2 independent browser sessions)", Impact, Evidence file names, Related TC/R ids). The board lists it under "Waiting for a human to submit". Tell the human in one line: "D-A03 ready to submit: run/A/bugs/D-A03.md (High, 3/3)". Continue testing.
When the human replies with the platform ID: `./rec update defects <D-id> '{"status":"Submitted","platform_id":"<id>","reviewed_by":"AI+<A|B>"}'`.

## 6. Log
`./rec add ailog '{"prompt_id":"P5","activity":"Defect triage + parallel reproduction <D-id>","input_summary":"suspected: ...","output_summary":"Verified 3/3 / Dropped, severity ...","how_verified":"2 independent repro-worker sub-agents in separate browsers; human reviewed before submission","used_in":"Defect report"}'`
