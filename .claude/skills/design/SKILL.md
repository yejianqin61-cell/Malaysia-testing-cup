---
name: design
description: Design high-value black-box test cases for one owned risk (EP, BVA, decision table, state transition, error guessing) and store them with rec. Usage /design R-02
---
Input: a risk id you own. Time box: about 7 minutes per High risk, 3 per Medium.

1. `./rec get risks <R-id>`. Re-check the relevant page with `./tb snap` for exact field constraints and on-screen rules.
2. Choose the technique that fits:
   - numeric/length limits: BVA (min-1, min, max, max+1) plus EP for invalid classes
   - combined business rules (discount + member + coupon): decision table, one case per meaningful rule column
   - statuses or workflows: state transition, covering valid transitions plus at least one invalid transition
   - free text, flows: error guessing (empty, spaces, long, special chars, double submit, back/refresh mid-flow, two tabs)
3. Write 4-8 diverse, high-impact cases (not combinatorial filler). For each:
   `./rec add cases '{"feature":"...","risk_id":"R-02","priority":"High","technique":"BVA","preconditions":"...","test_data":"...","steps":"1. ...; 2. ...","expected_result":"... (exact value or message)","basis":"On-screen rule"}'`
   basis: Requirement = briefing/spec; On-screen rule = text in the SUT; Assumed convention = common practice (say which in expected_result). Expected results must be checkable, with exact numbers or messages where possible.
4. `./rec add ailog '{"prompt_id":"P3","activity":"Test design <R-id>","input_summary":"observed constraints ...","output_summary":"N cases, techniques ...","how_verified":"constraints re-checked in SUT via tb snap #n","used_in":"TestCases"}'`
5. One line to the human: "R-02: 6 cases (BVA x3, decision table x2, error guessing x1)". Continue.
