# Test Plan - Team TeaYeah
<!-- Pre-filled before the event. On the day, fill every [FILL] and delete the hints in < >. Plain text pastes cleanly into most web forms. -->

Team: TeaYeah (Ye Jianqin, Yuzhe Tee)
Event: Malaysia Testing Cup 2026 - Malaysia Qualifier
Test window: 14 November 2026, 10:00-13:00 MYT (180 minutes)
System under test (SUT): [FILL name, URL, version/build if shown]
Test basis: [FILL briefing notes, any requirements/user stories provided, on-screen help text, and our observation of the SUT. Where no requirement exists, expected results are based on common conventions and are marked "assumed".]

## 1. Objective
Provide the stakeholders with an evidence-based view of the SUT's quality within 180 minutes by (a) finding and reporting valid, reproducible, correctly rated defects in the highest-risk areas, and (b) assessing selected non-functional characteristics (usability, performance, compatibility, accessibility).

## 2. Scope
In scope (observed features):
- [FILL feature 1]
- [FILL feature 2]
- [FILL feature 3]

Out of scope / not tested:
- Load, stress and soak testing (not authorized; would affect other teams)
- Intrusive security testing (scanning, brute force, injection attacks beyond simple input validation)
- Back-end/API testing outside what the browser UI exercises
- [FILL any feature excluded for time, with reason]

## 3. Risk analysis (product risks)
Risk score = Impact (1-5) x Likelihood (1-5). Priority: score >= 15 High, 8-14 Medium, <= 7 Low.

R-01 | [FILL feature] | Impact [ ] x Likelihood [ ] = [ ] | Priority [ ] | Reason: [FILL] | Owner: [A/B]
R-02 | [FILL feature] | Impact [ ] x Likelihood [ ] = [ ] | Priority [ ] | Reason: [FILL] | Owner: [A/B]
R-03 | [FILL feature] | Impact [ ] x Likelihood [ ] = [ ] | Priority [ ] | Reason: [FILL] | Owner: [A/B]
R-04 | [FILL feature] | Impact [ ] x Likelihood [ ] = [ ] | Priority [ ] | Reason: [FILL] | Owner: [A/B]
R-05 | [FILL feature] | Impact [ ] x Likelihood [ ] = [ ] | Priority [ ] | Reason: [FILL] | Owner: [A/B]
<Impact guide: 5 = money/data loss or core journey blocked; 3 = feature degraded, workaround exists; 1 = cosmetic.>
<Likelihood guide: complex logic, calculations, many inputs, state changes and integrations score higher.>

## 4. Test approach (strategy)
Risk-based testing: High-priority risks are tested first and deepest; Low-priority risks receive smoke checks only.
Test levels/types: system-level black-box testing through the browser UI; functional, negative and non-functional testing.
Test techniques (ISTQB):
- Equivalence Partitioning and Boundary Value Analysis for input fields and numeric limits
- Decision Table testing for business rules with combined conditions (e.g. discounts, eligibility)
- State Transition testing for workflows with statuses (e.g. order, booking, account)
- Experience-based techniques: error guessing and session-based exploratory testing with time-boxed charters
Non-functional approach: heuristic usability review (Nielsen heuristics), page-load timing with browser DevTools (3 repeats, median reported), basic accessibility checks (keyboard navigation, labels, contrast via browser tools), cross-browser and responsive checks.
Use of AI: AI assistants support risk analysis, test design, defect report review and report drafting. Every AI output is reviewed and verified by a team member before use; AI never submits anything. See the AI use log.

## 5. Test environment and test data
Browsers: Google Chrome [FILL version] (primary), [FILL Firefox/Edge version] (compatibility)
OS: Windows [FILL version]; viewports: 1920x1080 desktop, 390x844 mobile emulation
Network: home broadband; Fast 3G throttling in DevTools for performance observations
Accounts: [FILL accounts provided / created]. Each tester uses separate accounts and data to avoid collisions.
Test data: valid, invalid and boundary values prepared per technique; no real personal or payment data.
Tools: Chrome DevTools (Console, Network, Lighthouse, device emulation), screenshot and screen-recording tools, shared spreadsheet for test cases, executions and defects.

## 6. Roles and schedule
Tester A (Ye Jianqin): [FILL modules], test plan, summary report
Tester B (Yuzhe Tee): [FILL modules], non-functional testing, defect report review
Both: reconnaissance, risk analysis, cross-review of every defect before submission

00-15 min   Reconnaissance, scope, risk analysis, this plan submitted
15-35 min   Test analysis and design for High risks; test data prepared
35-145 min  Execution and defect reporting; sync every 30 minutes; non-functional checks in parallel
145-170 min Summary report written; final defect review
170-180 min Final submission buffer (all items submitted by 12:50)

## 7. Entry and exit criteria
Entry: SUT reachable; accounts work; competition rules and scope from the briefing understood.
Exit: all High risks tested or explicitly reported as not tested/blocked; every defect reproduced before submission; summary report submitted before 13:00.
Suspension: SUT unavailable for more than 5 minutes -> record the time, inform organizers via the meeting, continue with other areas.

## 8. Defect management
Each suspected defect is reproduced at least twice, checked against expected behavior and checked for duplicates before submission. Enhancement suggestions are not reported as defects.
Severity (impact on the user/business):
- Critical: core function unusable, data loss/corruption, security or money impact, no workaround
- High: major function fails or gives wrong results; workaround is hard or not obvious
- Medium: function partly wrong; reasonable workaround exists; clear user annoyance
- Low: cosmetic, text or layout issue with little functional impact
Priority (urgency of fixing) is stated separately when requested.

## 9. Project risks and mitigations
- Unknown submission fields -> transfer key sections to the platform early, keep drafts locally
- SUT or connection instability -> record timestamps; mobile hotspot as backup network
- Duplicate reports between testers -> shared defect sheet checked before every submission
- Time pressure -> summary report skeleton prepared in advance; hard stop at 145 minutes for reporting
- AI hallucination -> AI output is a draft only; every fact verified against the SUT

## 10. Deliverables
Test plan (this document), test conditions and test cases, execution log, defect reports, summary test report, AI use log.
