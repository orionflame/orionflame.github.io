# Classic Chat continuation checkpoint

Date: 2026-11-27
Branch: `classic-chat-backup-20261127`
Previous source commit: `0e32e860e1235700829173eb742ebc8a946c6afe`
Recovery checkpoint: `2c060856e1aa6e9547410de5f5895073f5f60253`

## Completed

- Archive schema v1 validation and conflict-safe merge; exact message content, statuses and complete saved histories retained. Interrupted streams are marked incomplete.
- Local JSON import/export with explicit 16 MiB automatic import limit. Storage failures and unreadable existing data are reported, not silently discarded.
- Hosted preview is memory-only, does not read/write browser storage, hides pairing controls, and makes no bridge requests. Local app requests remain same-origin.
- Desktop and mobile sidebar controls fixed. No changes to the website's master branch.
- Portable Node.js checks: 17 passed, 0 failed, 1 Windows DPAPI test skipped. Includes archive and synthetic DOM regression cases. Source hashes verified against the recovery checkpoint.

## HOST_PENDING

- Browser fixture: attempted Chromium navigation in the portable environment; blocked by sandbox browser policy. The fixture is provided for the Windows host, not claimed passed.
- Actual Windows DPAPI, first-time DevKit installation and official account authorization/model access remain unverified on the host. The required procedures and expected results are in `HOST_RUN_REQUEST.md`.
- Third-party preview link was updated to the dedicated branch. Live third-party rendering has not been verified in this run. The extracted local file and local app are the preferred paths for private data.

No confidential inputs, real conversation content, account tokens, or pairing secrets are included. The previous test results remain recorded; no result is promoted without evidence.
