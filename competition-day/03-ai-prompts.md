# AI Prompt Library - TeaYeah
<!-- Copy-paste in order. Replace {{...}}. Before pasting: remove passwords, tokens, personal data from text and screenshots. After every use: add one row to the AI_Log sheet (what we asked, what we kept, how we verified). -->

---------------------------------------------------------------
## P0 - Session primer (paste once at 10:00, in a fresh chat)
---------------------------------------------------------------
You are the AI assistant of team TeaYeah in a 3-hour software testing competition judged on ISTQB-style test planning, test analysis and design, implementation, execution and defect reporting, non-functional testing and the summary report. Invalid defect reports and enhancement requests reported as defects lose points.
Rules for you for the whole session:
1. Never invent features, behavior, results or evidence. If you don't know, say "unknown" and tell us what to check.
2. Separate "observed" (we told you) from "assumed" (your expectation).
3. Use ISTQB terminology. Write concise professional English.
4. You only advise. You never execute tests or submit anything.
5. Keep answers short and in plain text (no wide tables) unless asked.
Reply "Ready" and nothing else.

---------------------------------------------------------------
## P1 - Reconnaissance -> feature map   (minute 5-10)
---------------------------------------------------------------
Here are our reconnaissance notes and screenshots of the SUT.
SUT purpose: {{one line}}
Briefing notes / requirements given: {{paste}}
Pages and features we observed: {{bullet list}}
Business rules / limits we saw on screen: {{e.g. max 10 items, password min 8}}
Task: produce (a) a feature map of OBSERVED features grouped by user journey, (b) a list of open questions / unclear requirements, (c) 3 features you suspect exist but we have NOT observed (label as hypotheses).

---------------------------------------------------------------
## P2 - Risk analysis -> test plan section 3   (minute 10-15)
---------------------------------------------------------------
Using only the observed features above, build a product risk list, max 8 rows, in this exact plain-text format:
R-01 | feature | Impact 1-5 x Likelihood 1-5 = score | High(>=15)/Medium(8-14)/Low(<=7) | one-line reason | suggested owner A or B
Impact: 5 = money/data loss or core journey blocked, 1 = cosmetic. Likelihood: higher for calculations, many inputs, state changes, integrations.
Then suggest how to split the High risks between 2 testers so the work does not overlap.

---------------------------------------------------------------
## P3 - Test design for one risk   (minute 15-35, once per High risk)
---------------------------------------------------------------
Risk: {{R-0x and feature}}
Observed behavior and rules: {{paste}}
Input fields and their constraints (observed or assumed - say which): {{list}}
Design max {{8}} high-value test cases. Use the technique that fits: EP, BVA, decision table, state transition, error guessing. Output one case per line in this exact format (CSV, no header, so we can paste into our sheet):
TC-xx,feature,R-0x,priority,technique,preconditions,test data,steps (separated by ;),expected result,(basis: requirement or assumed)
Prefer diverse, high-impact cases over combinations. Mark any case whose expected result is uncertain with "ORACLE?".

---------------------------------------------------------------
## P4 - Exploratory charter   (any time)
---------------------------------------------------------------
Write 3 exploratory test charters (format: "Explore <target> with <resources> to discover <information>") for {{feature}}, each 15 minutes, aimed at risks: {{risk ids}}. For each, list 5 concrete test ideas (error guessing: double submit, back button, refresh mid-flow, long/special input, session expiry, concurrent tabs, etc.).

---------------------------------------------------------------
## P5 - Skeptical defect review   (before EVERY submission)
---------------------------------------------------------------
Act as a skeptical defect triage reviewer. Challenge this suspected defect.
Feature: {{ }}
Steps we performed: {{ }}
Expected (and why - requirement or convention): {{ }}
Actual (exactly what we saw): {{ }}
Reproduced: {{x/y attempts}}, environment: {{browser, viewport, account}}
Already reported defects (titles): {{ }}
Return:
1. Decision: Verified candidate / Needs verification / Likely non-defect (enhancement or expected behavior) / Duplicate candidate - with reason.
2. Alternative explanations we must rule out.
3. Severity suggestion (Critical/High/Medium/Low per: Critical = core function unusable, data/money/security impact; High = major function wrong, hard workaround; Medium = partly wrong, workaround exists; Low = cosmetic) with one-line justification, and priority separately.
4. Only if Verified candidate: the final report in our template (Title "[Feature] what is wrong + condition", Environment, Preconditions, Steps, Expected, Actual, Reproducibility, Impact). Do not claim root cause. Do not invent evidence.

---------------------------------------------------------------
## P6 - Non-functional check plan   (minute 35-60)
---------------------------------------------------------------
For SUT {{ }} with key pages {{ }}, propose a 25-minute non-functional test session: 2 usability checks (name the Nielsen heuristic), 2 performance observations (how to measure in Chrome DevTools, repeat 3x, which number to report), 2 accessibility checks, 1 responsive/compatibility check. No load testing, no intrusive security testing. For each: steps, what counts as a finding, and what is NOT a defect.

---------------------------------------------------------------
## P7 - Mid-point check   (minute 90)
---------------------------------------------------------------
Here is our current status: risks {{list with tested/not tested}}, cases executed {{n}}, defects {{titles + severity}}, time left 90 minutes. What are the 3 most valuable things to do in the next 55 minutes? Which High risk is under-tested?

---------------------------------------------------------------
## P8 - Summary report draft   (minute 145)
---------------------------------------------------------------
Fill our summary report template below using ONLY the data I paste. Do not invent numbers or claim coverage we did not record. Keep Not Run, Blocked, Passed and Failed separate. Write the executive summary last, max 5 sentences, with a cautious, evidence-based release recommendation.
Template: {{paste 02-summary-report.md}}
Data: risk list {{ }}; execution counts {{ }}; defect list {{ID, title, severity}}; non-functional notes {{ }}; not tested {{ }}; AI log {{ }}.

---------------------------------------------------------------
## P10 - Triage automated check output   (Tier B only, minute 35-60)
---------------------------------------------------------------
Below is the raw output of our read-only automated checks (Playwright + axe-core) against the SUT. It contains observations only; nothing is reproduced or confirmed yet.
{{paste automation/out/<run>/summary.md}}
Task:
1. Group observations into: (a) defect candidates worth manual reproduction, (b) non-functional findings for the report, (c) noise / not a defect (third-party scripts, expected 401 before login, test-tool artefacts) - with reason.
2. For each (a): which manual steps would confirm it, and a provisional severity with one-line justification.
3. For each (b): suggest baseline_expectation with its basis (requirement, WCAG criterion, Core Web Vitals guideline, convention) and user_impact in one line.
4. Flag any number that looks unreliable (e.g. large spread between runs) and say what to re-measure.
Do not claim root cause. Do not upgrade an automated observation to a confirmed defect.

---------------------------------------------------------------
## P11 - Tidy a recorded smoke test   (Tier B only)
---------------------------------------------------------------
Here is Playwright code recorded with codegen for test case {{TC-xx: title}}. Expected result: {{ }}.
{{paste code - no passwords, no auth.json}}
Rewrite it as one @playwright/test test titled "{{TC-xx title}}": use role/label locators, page.goto('./') for the start page, add expect() assertions for the expected result, no fixed waits, no new actions beyond what was recorded. Output code only.

---------------------------------------------------------------
## P9 - Final English polish   (any report)
---------------------------------------------------------------
Polish the English of the text below for a professional test report. Keep all facts, numbers and IDs unchanged. Make titles specific. Do not add content.
{{text}}
