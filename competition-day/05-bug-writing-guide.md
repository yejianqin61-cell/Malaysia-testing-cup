# Bug Writing Guide - TeaYeah
<!-- Severity scale, report template and English phrase bank. -->

## Severity scale (state it in the test plan; apply consistently)
Critical - Core function unusable, data loss/corruption, money or security impact, no workaround.
  e.g. "Payment is charged but no order is created."
High - Major function fails or gives wrong results; workaround hard or not obvious.
  e.g. "Order total ignores the quantity when quantity > 9."
Medium - Function partly wrong; reasonable workaround exists; clear user annoyance.
  e.g. "Search returns no results when the keyword has a trailing space."
Low - Cosmetic, text, layout with little functional impact.
  e.g. "Typo 'Adress' on the profile page."
Priority (if asked) = urgency of fixing for the business: P1 fix now, P2 fix before release, P3 fix later. A Low-severity typo on the home page can still be P2.

## Report template (plain text, paste into the platform)
Title: [Feature] <what is wrong> when/after <condition>
Severity: <Critical/High/Medium/Low> - <one-line reason>
Priority: <P1/P2/P3> (if requested)
Environment: <Chrome 1xx, Windows 11, 1920x1080 | account: tester_a1 | 14 Nov 2026 hh:mm MYT>
Preconditions: <logged in as..., cart contains...>
Steps to reproduce:
1. Go to <page/URL>
2. Enter "<exact value>" in <field>
3. Click "<button label>"
Expected result: <what should happen> (Basis: <requirement / on-screen rule / common convention>)
Actual result: <exactly what happened, with exact message text and numbers>
Reproducibility: <3/3 attempts>; <also in Firefox 1xx / only in Chrome>
Impact: <who is affected and how - money, data, blocked journey, trust>
Evidence: <screenshot name / console error text / failed request and status code>
Related: <test case ID TC-xx; risk R-0x>

## Title formula and examples
Bad: "Cart bug" / "Doesn't work" / "Error on page"
Good:
- [Cart] Total price is not updated after quantity is changed to 10
- [Registration] Account is created with an email address that has no domain (e.g. "user@")
- [Search] Results are sorted alphabetically instead of by price when "Price: Low to High" is selected
- [Checkout] Double-clicking "Place order" creates two identical orders
- [Profile] Saved phone number is replaced by the old value after page refresh

## Phrase bank
Steps: "Navigate to...", "Enter ... in the ... field", "Select ... from the ... drop-down", "Click the ... button", "Observe the ...".
Expected: "The system should reject the input and display a validation message.", "The total should be recalculated as unit price x quantity (RM 25.00 x 10 = RM 250.00).", "The user should be redirected to the order confirmation page."
Actual: "The system accepts the value and saves the record.", "The total remains RM 25.00.", "A blank page is displayed and the console shows: <error text>.", "The request POST /api/orders returns HTTP 500."
Reproducibility: "Reproduced 3 out of 3 attempts.", "Intermittent: reproduced 2 out of 5 attempts; no pattern identified."
Impact: "Customers may be charged an incorrect amount.", "Users cannot complete registration, blocking the primary journey.", "Invalid data is stored, which may affect downstream reports."
Basis when no requirement: "Expected behavior is based on common e-commerce conventions as no requirement was provided."
Hedging (no root-cause claims): "This suggests that...", "Possibly related to D-03.", "Root cause not investigated."

## Pre-submission checklist (both testers, 30 seconds)
[ ] Reproduced at least twice   [ ] Not an enhancement   [ ] Not a duplicate (checked Defects sheet)
[ ] Exact values and messages written   [ ] Severity matches the scale   [ ] Sensitive data removed
[ ] Logged in Defects sheet with platform ID after submitting
