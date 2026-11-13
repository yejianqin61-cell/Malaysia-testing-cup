---
name: roles
description: Access-control and multi-user checks with two tb identities (e.g. customer vs admin, user1 vs user2) - what one role can see or do that it should not, and whether one user's change shows up correctly for another. Usage /roles <role-name>
---
Only when the SUT has roles or per-user data, and the human has given a second test account (never guess or create accounts unless the briefing allows sign-up with test data). Observe and report; never try to break authentication.

1. Second identity: ask the human to run `TB_ROLE=<role> ./tb chrome` (its own window, port and profile) and log in there with the second account. Then every command for that identity is `TB_ROLE=<role> ./tb ...`. Its actions go to `run/$TB_TESTER/actions-<role>.jsonl`, and its evidence files are named `<T>-<role>-...png`.
2. Map both views: on the same pages, `./tb snap` versus `TB_ROLE=<role> ./tb snap`. List the links, buttons and data that differ.
3. Checks (each one is a test case, technique "Decision table" with role x action, or "Error guessing"):
   - Direct URL: open a privileged page's URL (taken from the privileged identity's snap) as the less privileged identity. Expected: denied or redirected. Actual content shown = defect candidate.
   - Hidden control: a button hidden for role X. Does its target page or action still work for X when opened by URL?
   - Own versus other's data: after user 1 creates or changes something, does user 2 see what they should (shared data) and not what they should not (private data)? Do not alter other real users' data. Use only the two test accounts.
   - Cross-user consistency: a change made by one identity (status, stock, price) is shown correctly to the other after refresh.
   - Logout: after `./tb` logout in one identity, the Back button or a reopened URL must not show private data.
4. Reproduction steps for a cross-identity defect: run `./tb steps --mark` for each identity's part and label them "As <role A>:" / "As <role B>:". Include which account type was used (never the password).
5. Severity guide: data from another user or admin functions exposed = High or Critical (security impact); a cosmetic role-label mismatch = Low.
6. `./rec add ailog '{"prompt_id":"other","activity":"Role/access checks",...}'`.
