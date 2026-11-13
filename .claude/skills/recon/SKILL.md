---
name: recon
description: Competition minute 0-10. Breadth-first tour of the unknown SUT with tb; produce the observed feature map, on-screen rules and open questions in run/recon.md.
---
Goal: in at most 10 minutes, know what the SUT does. Do not hunt bugs yet; note suspicions in one line and move on.

1. `./tb status` (start `./tb chrome` in the background if it is not running). `./tb snap`.
2. Visit every top-level navigation item once (`./tb click`, then `./tb snap`, then `./tb back` or open the next item). On each page note:
   - purpose, main user actions, inputs with their constraints (type, required, min/max, maxlength, pattern, options)
   - business rules visible on screen (limits, prices, statuses, messages, help text)
   - state-changing flows (create/edit/delete, cart, checkout, booking, status workflows)
   - anything that needs login or another role
   Stay on the allowed host. If a page needs login, ask the human to log in in the window, then continue.
3. Write `run/recon.md` (English):
   - SUT: name, URL, version/build if shown, browser used
   - Feature map grouped by user journey: OBSERVED features only, each with page path and key inputs/rules
   - Business rules seen (quote exact text)
   - Open questions / unclear requirements (these become "Assumed convention" oracles)
   - Hypotheses: features suspected but not seen (clearly labelled)
   - Quick suspicions (one line each, with tb seq number)
4. `./rec add ailog '{"prompt_id":"P1","activity":"Reconnaissance feature map","input_summary":"tb tour of N pages","output_summary":"run/recon.md: N features, N rules, N questions","how_verified":"every feature observed via tb snapshots #a-#b","used_in":"Test plan scope"}'`
5. Tell the human: a 5-line summary of the feature map plus the open questions they should check in the briefing. Then continue with `/plan`.
