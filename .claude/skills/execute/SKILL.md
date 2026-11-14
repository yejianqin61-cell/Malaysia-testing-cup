---
name: execute
description: Execute designed test cases through tb, judge each against its expected result, record the outcome with rec, and hand mismatches to /bug. Usage /execute R-02 or /execute TC-A03 TC-A04
---
Input: a risk id (all Not Run cases for it, High priority first) or case ids.

For each case:
1. `./rec get cases <id>`, then `./tb mark "<TC-id>"`, then `./tb open <start page>` so the steps start from a known page.
2. Perform the steps with tb (snap, act, snap). Use the exact test data. After every action read the printed messages, events and URL.
3. Use every oracle you have, not only the visible text:
   - Visible: messages, values and URL printed by tb.
   - Visual: if `tb snap` shows Layout warnings, or the case is about display (prices, tables, layout, images, mobile), READ the latest screenshot.
   - Data: when the case shows numbers or lists coming from the server, compare them with `./tb net --mark "<TC-id>"` (for example, the UI total versus the API total, or the request quantity versus the confirmed quantity).
   - Health: `events:` lines (console errors, HTTP 4xx/5xx).
   Judge strictly against expected_result:
   - matches, and no unexpected console error/HTTP 5xx: `./rec update cases <id> '{"status":"Passed","actual_result":"<what you saw, exact values>"}'`
   - cannot run (blocked by another defect, missing data, environment): `Blocked`, with the reason in actual_result
   - mismatch: do NOT mark Failed yet. Run `/bug` on it. Only when the defect row exists, set `Failed` with `defect_id`. If `/bug` drops it (expected behaviour, environment), re-judge the case.
4. Every 3-4 cases print one status line to the human. Re-check the clock; at 12:25 stop executing and go to `/report`.

Rules: Not Run is never Passed. If the expected result itself looks wrong (oracle problem), note "ORACLE?" in actual_result and ask the human. Never repeat a guard-word action more than needed.
