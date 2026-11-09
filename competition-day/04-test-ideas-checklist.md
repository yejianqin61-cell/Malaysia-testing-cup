# Test Ideas Checklist - TeaYeah
<!-- Generic test ideas for common web features. Pick the ones that match the SUT; do NOT try to run all of them. Each idea can become a test case or an exploratory note. -->

## Any input field
- Empty / only spaces / leading-trailing spaces
- Minimum, minimum-1, maximum, maximum+1 length (BVA)
- Very long string (1000+ chars), emoji, Chinese/Malay characters, accents
- Special characters: ' " < > & ; / \ %  (watch for broken display, not attacks)
- Numbers: 0, negative, decimal, very large, leading zeros, letters in number field
- Copy-paste vs typing; autofill
- Error message: shown? next to the right field? understandable? cleared after fix?
- Client-side vs after submit: does the server still reject invalid data?

## Registration / login / password
- Duplicate email (different case: Test@x.com vs test@x.com)
- Invalid email formats; password rules shown and enforced consistently
- Wrong password message does not reveal whether the account exists
- Login after logout via browser Back button
- Session: refresh, new tab, close and reopen, idle timeout
- "Remember me", "Forgot password" flow completes; old password stops working
- Password field masked; show/hide toggle works

## Search / filter / sort
- No results, one result, many results; message for no results
- Case, partial words, typos, special characters, leading/trailing spaces
- Filters combined (decision table); clearing filters restores the full list
- Sort order correct for numbers, prices, dates (e.g. 10 sorted after 9, not after 1)
- Pagination: first, last, page beyond last, item count consistent across pages
- URL/state kept after refresh and Back

## Cart / order / checkout / payment
- Quantity: 0, 1, max, max+1, negative, decimal
- Totals: price x qty, tax, shipping, discounts, rounding (2 decimals), currency
- Coupons: valid, expired, invalid, used twice, combined with other discounts
- Price/stock changes while item is in cart
- Remove item, empty cart, cart persists after login/logout
- Double-click "Pay" / "Submit" -> duplicate order?
- Back button / refresh during checkout
- Order confirmation and order history match what was paid

## Forms with workflow / status (state transition)
- Draw the states: e.g. Draft -> Submitted -> Approved/Rejected -> Cancelled
- Every valid transition works; invalid transitions blocked (e.g. cancel a completed order)
- Status shown consistently on every page
- Editing after submission; deleting; undo

## Dates / time / booking
- Past dates, today, far future, 29 Feb, end of month/year
- Start date after end date; same start and end
- Time zones (MYT), 12h/24h display, overlapping bookings, capacity full

## Files / images
- Allowed and disallowed types; file with wrong extension
- Size limit and limit+1; 0-byte file; very long file name
- Preview, download, delete

## Profile / account data
- Changes saved and shown everywhere; cancel discards changes
- One user cannot see another user's data by changing an ID in the URL (observe only, report carefully)

## Navigation / UI
- Broken links, 404 pages, wrong page titles
- Buttons that do nothing; disabled state clear
- Consistent labels, spelling, alignment, overlapping text
- Back/forward behavior, deep links, refresh on any page

## Non-functional quick list
Usability (Nielsen heuristics): visibility of system status (loading indicators); match with real world (clear wording); user control (undo, cancel); consistency; error prevention (confirm before delete); recognition rather than recall; help users recover from errors (useful messages).
Performance: DevTools Network tab, Disable cache, reload 3x, report median load time (DOMContentLoaded / Load) and largest request; repeat with Fast 3G throttling; Lighthouse Performance score as supporting data only.
Accessibility: Tab through the page (order logical? focus visible?); form fields have labels; images have alt text; contrast (Lighthouse/axe); zoom to 200%.
Compatibility / responsive: Chrome vs Firefox/Edge for the main journey; DevTools device mode 390 px width: menu, forms, buttons, tables usable.
Reliability: console errors (red) during normal use; failed requests (4xx/5xx) in Network tab.

## Not a defect (do not report)
- "Would be nicer if..." / new feature ideas
- Behavior that matches the stated requirement even if you dislike it
- Issues caused by your own network, browser extension or test data mistakes
- The same root symptom reported again on another page (report once, list where it appears)
