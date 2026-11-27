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

## 2026-11-27: Windows CI and stream recovery continuation

- `978a2d708af86952b01ba97aface047e1f02addc`: periodic partial-response checkpoints, page-hide flush, failure/stop preservation and stream regressions.
- `c63fc5de567111fed161671301ac26deedf8c6b1`: Windows UTF-8 export assertion and batch launcher return handling. [Windows CI run 45972632806](https://github.com/orionflame/orionflame.github.io/actions/runs/45972632806) completed successfully: 19 Node tests passed, 0 failed, 1 non-Windows DPAPI test skipped. The actual Windows DPAPI round trip and all three Chromium regression groups passed.
- `52b261e7aaae87c29d846687323efbbb4926d082`: branch-scoped CI now also installs the pinned official DevKit and checks fresh, unauthenticated loopback startup. Child logs are discarded, no pairing or real AI request is made. [CI run 45972961966](https://github.com/orionflame/orionflame.github.io/actions/runs/45972961966) was in progress at this checkpoint. Do not promote setup or startup to PASS until the run confirms it.

The earlier HOST_PENDING entries for DPAPI and the synthetic Chromium fixture are superseded by the successful Windows run. Remaining: installed bridge CI outcome, direct third-party preview rendering (not accessible from the current environment), direct file-origin behavior on the user's browser, and live account authorization/model access. No change to website master in this continuation. The Houdini fixture task is unrelated to this application.
