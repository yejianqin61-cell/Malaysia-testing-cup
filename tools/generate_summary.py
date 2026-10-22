#!/usr/bin/env python3
"""Local CSV summary draft helper. Uses only recorded statuses; does not upload data."""
import csv
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'templates'


def read_csv(filename):
    with (DATA / filename).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def md_counts(values):
    return '\n'.join(f'- {key}: {count}' for key, count in sorted(Counter(values).items())) or '- None recorded'


def main():
    cases = [r for r in read_csv('test-design.csv') if r.get('case_id', '').strip()]
    executions = [r for r in read_csv('test-execution.csv') if r.get('execution_id', '').strip()]
    defects = [r for r in read_csv('defects.csv') if r.get('defect_id', '').strip()]
    # Only count latest execution per case; template rows marked Not Run are not evidence of execution.
    latest = {}
    for r in executions:
        case_id = r.get('case_id', '').strip()
        if case_id:
            latest[case_id] = r
    count = Counter((r.get('status') or 'Unknown').strip() for r in latest.values())
    executed = sum(n for s, n in count.items() if s.lower() in ('passed', 'failed', 'blocked'))
    passed = sum(n for s, n in count.items() if s.lower() == 'passed')
    failed = sum(n for s, n in count.items() if s.lower() == 'failed')
    eligible = passed + failed
    verified = [d for d in defects if (d.get('repro_status') or '').strip().lower() in ('verified', 'reproduced')]
    content = f'''# TeaYeah — Automatically Drafted Test Summary

**This is a local draft, not the official competition submission.** Check all figures and filter out demo rows before using.

## Test case status
- Designed cases: {len(cases)}
- Cases with any execution log: {len(latest)}
- Executed (Passed/Failed/Blocked): {executed}
- Passed: {passed}
- Failed: {failed}
- Blocked: {sum(n for s,n in count.items() if s.lower() == 'blocked')}
- Not run / other recorded statuses: {sum(n for s,n in count.items() if s.lower() not in ('passed','failed','blocked'))}
- Pass rate (passed / [passed + failed]): {f'{passed/eligible:.1%}' if eligible else 'N/A'}

### Recorded status distribution
{md_counts([(r.get('status') or 'Unknown').strip() for r in latest.values()])}

## Defects
- Total defect records: {len(defects)}
- Verified / reproduced defect records: {len(verified)}

### Severity of verified defects
{md_counts([(d.get('severity') or 'Unspecified').strip() for d in verified])}

## Manual completion required
- SUT, scope, test strategy and environment
- Highest-impact findings, linked case IDs and platform submission IDs
- Non-functional evidence and untested or blocked risk areas
- Limitations, objective quality conclusion and evidence references
'''
    output = ROOT / 'summary_generated.md'
    output.write_text(content, encoding='utf-8')
    print(f'Wrote {output}')


if __name__ == '__main__':
    main()
