---
name: status
description: Mid-point check (about 11:30) and any 30-minute sync - coverage gaps, unsubmitted defects, and the best use of the remaining time.
---
1. `./rec stats`, `./rec list risks`, `./rec list cases`, `./rec list defects`.
2. Report to the human in at most 8 lines:
   - time left until the 12:25 execution stop
   - own High risks: executed / designed cases, and which are under-tested
   - Verified defects not yet Submitted (these are points waiting to be collected; remind the human)
   - Suspected defects older than 15 minutes (decide: reproduce now or drop)
   - Non-functional rows still unreviewed
   - the 3 most valuable next actions, in order
3. Update risk coverage where it is now clear: `./rec update risks R-0x '{"coverage":"Tested in depth|Smoke only|Not tested"}'`.
4. `./rec add ailog '{"prompt_id":"P7","activity":"Mid-point status check",...}'`.
