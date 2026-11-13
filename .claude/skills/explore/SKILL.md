---
name: explore
description: Time-boxed exploratory testing session (charter based) with tb, logged as a session note and as an Exploratory test case. Usage /explore "Explore checkout with invalid coupons to discover pricing errors" R-03
---
1. Charter: "Explore <target> with <resources> to discover <information>", time box 15 minutes, linked risk.
2. `./tb mark "EXP-<n> <short charter>"`. Note the start time.
3. Test ideas to cycle through, picking the ones relevant to the target: boundaries and invalid classes; double-click submit; back/refresh/new tab mid-flow; very long, emoji, Malay/Chinese and `' " < > &` text (display only, no attack payloads); 0, negative, decimal, huge numbers; rounding (2 dp, RM); sort and filter combos (10 after 9); pagination edges; state changes reflected everywhere (cart badge, history, profile); validation shown and cleared correctly; mobile viewport for the same flow (`./tb viewport mobile`, then back to desktop).
   Visual tour: at desktop and at `./tb viewport mobile`, screenshot each screen of the flow and READ it. Look for overlap, cut-off text or buttons, misaligned columns, wrong or broken images, unreadable contrast, and content hidden behind banners.
   API consistency: after each state change, `./tb net --last 5`. Does the UI show what the server returned (price, quantity, status, totals, counts)? Does the request send what the user entered?
   Roles (if the SUT has them): see `/roles`.
4. Anything suspicious: stop, run `/bug`, then continue the session.
5. At the end write `run/$TB_TESTER/sessions.md` (append): charter, duration, areas covered, ideas tried, bugs (D-ids), questions, coverage feeling. Then record the session:
   `./rec add cases '{"feature":"...","risk_id":"R-03","priority":"Medium","technique":"Exploratory","steps":"Session EXP-<n>: <charter>","expected_result":"No defects in charter area","basis":"Assumed convention","status":"Passed or Failed","actual_result":"<summary>","defect_id":"<D-ids or empty>"}'`
6. `./rec add ailog '{"prompt_id":"P4",...}'`.
