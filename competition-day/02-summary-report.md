# Summary Test Report - Team TeaYeah
<!-- MASTER REPORT. Covers all six scoring areas so nothing is lost if the platform only has a bug form and one report field. Fill [FILL]; delete hints in < >. Start filling it at minute 15, not minute 145. Every number must come from the shared workbook. -->

Team: TeaYeah (Ye Jianqin, [FILL])
SUT: [FILL name, URL, version]
Test window: 14 November 2026, 10:00-13:00 MYT
Environment: [FILL Chrome version], [FILL second browser], Windows [FILL], desktop 1920x1080 and mobile emulation 390x844

## 1. Executive summary
<3-5 sentences: overall quality verdict, the 1-2 most serious risks, how confident we are and why.>
Within 180 minutes we tested [FILL N] of [FILL M] identified product risks, executing [FILL] test cases and reporting [FILL] verified defects ([FILL] Critical, [FILL] High, [FILL] Medium, [FILL] Low). The most serious problems are [FILL short description of top defect(s)], which affect [FILL user journey]. [FILL one sentence on non-functional quality]. Based on the evidence, we [do / do not] recommend release [FILL condition, e.g. "until defects D-01 and D-03 are fixed"]. Confidence is [high/medium/low] because [FILL reason, e.g. "the payment flow was tested in depth but account management only received smoke tests"].

## 2. Test planning summary
Objective: find and report valid defects in the highest-risk areas and assess selected non-functional characteristics.
Approach: risk-based testing (risk score = impact x likelihood).
Risk ranking used:
- R-01 [FILL] - score [ ] - [High/Medium/Low] - [Tested in depth / Smoke only / Not tested]
- R-02 [FILL] - score [ ] - [ ] - [ ]
- R-03 [FILL] - score [ ] - [ ] - [ ]
- R-04 [FILL] - score [ ] - [ ] - [ ]
- R-05 [FILL] - score [ ] - [ ] - [ ]
Out of scope: load/stress testing, intrusive security testing, [FILL].

## 3. Test analysis and design
Test basis: [FILL briefing, requirements provided, observed behavior; assumed expectations are labelled as such].
Test conditions identified: [FILL N], traced to risks R-01..R-0[ ].
Test design techniques applied:
- Equivalence Partitioning / Boundary Value Analysis: [FILL where, e.g. "quantity field 1-99: tested 0, 1, 99, 100"]
- Decision table: [FILL where, or delete]
- State transition: [FILL where, or delete]
- Exploratory testing: [FILL N] time-boxed sessions; charters: [FILL e.g. "Explore checkout with invalid coupons to discover pricing errors"]
- Error guessing: [FILL e.g. special characters, double submit, back button, session timeout]

## 4. Test implementation
Test data prepared: [FILL e.g. valid/invalid emails, boundary numbers, long strings, special characters, separate accounts per tester].
Environment set-up: [FILL browsers, viewports, throttling profile].
Test procedures were ordered by risk priority; [FILL N] test cases were ready before execution started at minute [FILL].

## 5. Test execution results
<Numbers from the workbook. Not Run is never counted as Passed.>
- Test cases designed: [FILL]
- Executed: [FILL] (Passed [FILL], Failed [FILL], Blocked [FILL])
- Not run: [FILL] - reason: [FILL time / blocked by D-xx]
- Pass rate: [FILL]% (Passed / (Passed + Failed))
- Exploratory sessions: [FILL] sessions, [FILL] minutes in total
Coverage by risk:
- R-01: [FILL] cases executed, [FILL] defects
- R-02: [FILL] cases executed, [FILL] defects

## 6. Defects
Verified defects reported: [FILL total] - Critical [ ], High [ ], Medium [ ], Low [ ]
Most important defects:
1. [FILL platform ID] [FILL title] - [Severity] - impact: [FILL one line]
2. [FILL platform ID] [FILL title] - [Severity] - impact: [FILL one line]
3. [FILL platform ID] [FILL title] - [Severity] - impact: [FILL one line]
Defect clusters: [FILL e.g. "4 of 7 defects are in input validation of the booking form, suggesting missing server-side validation" - describe as observation, not as confirmed root cause].

## 7. Non-functional testing
<Each finding: what, how measured, environment, result with units, repeat count, user impact.>
Usability: [FILL e.g. "Error messages on the registration form do not say which field is wrong (heuristic: help users recognize and recover from errors)"]
Performance: [FILL e.g. "Search results page: median 4.8 s (3 runs, Chrome, Fast 3G throttling); Lighthouse Performance score 41. Lab measurement only, not a load test."]
Compatibility / responsive: [FILL e.g. "At 390 px width the checkout button is hidden behind the cookie banner"]
Accessibility: [FILL e.g. "Login form inputs have no labels; keyboard focus is not visible"]
Security observations (non-intrusive only): [FILL or "none observed"]

## 8. Residual risks and limitations
- Not tested: [FILL areas and why]
- Only partially tested: [FILL]
- Unclear requirements: [FILL expected behavior we had to assume]
- Environment limits: single network, lab performance measurements only, no load testing.

## 9. Quality assessment and recommendation
[FILL Ready / Ready with conditions / Not ready] for release.
Reason: [FILL based only on evidence above].
Recommended next steps: fix [FILL defect IDs]; retest [FILL]; test [FILL untested areas] before release.

## 10. Use of AI
We used [FILL tool name] as an assistant, not as a decision-maker:
- Risk analysis: AI proposed a risk list from our reconnaissance notes; we re-scored [FILL] risks and removed [FILL] features the AI assumed but the SUT does not have.
- Test design: AI drafted test cases per technique; we kept [FILL] of [FILL] and corrected expected results against the SUT.
- Defect review: every defect was challenged by an AI "skeptical reviewer" prompt before submission; [FILL N] suspected defects were dropped as non-defects or duplicates.
- Reporting: AI drafted wording; all numbers come from our execution log and were checked by a team member.
No credentials or personal data were shared with AI tools. AI never interacted with the SUT or submitted anything.

## 11. Notable findings / insights
[FILL the single most interesting finding or pattern, and why it matters to the business.]
