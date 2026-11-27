# Classic Chat Windows host verification

## Scope

The portable Node.js checks cover source syntax, archive normalization/merge, an offline DOM stand-in, validation, and preview isolation. Actual Chromium navigation was blocked by the sandbox browser policy. Windows CI run [45972632806](https://github.com/orionflame/orionflame.github.io/actions/runs/45972632806) subsequently passed all three synthetic Chromium groups and the Windows DPAPI round trip, with 19 Node passes, zero failures and one non-Windows-only skip. Actual account authorization remains HOST_PENDING.

## Host environment

Record:
- Windows edition/build
- Node.js version (must be 22.12 or newer)
- Git version
- Browser and version

Do not record or upload the pairing code, OAuth tokens, account identifiers, private conversation text, or screenshots containing personal data.

## Required checks

From the repository root in PowerShell:

```powershell
node --version
git --version
Push-Location tools\classic-chat-bridge
npm run check
Pop-Location
```

Expected:
- All JavaScript syntax checks pass.
- The Windows DPAPI encrypt/decrypt test runs, not skips.
- The non-Windows DPAPI rejection test skips on Windows.
- All validation tests pass, including rejection of `https://raw.githack.com` as a trusted bridge origin.

## Real browser regression (synthetic data only)

From the repository root, with Python available:

```powershell
python -m pip install playwright
python -m playwright install chromium
python tools/classic-chat-bridge/test/browser_offline.py
```

Optional: set `CHROMIUM_PATH` to an installed Chromium executable instead. The fixture serves all resources from the extracted files and synthetic service responses; it must not use your real sign-in, account, or conversations. Expected: three PASS groups (loopback archive recovery, hosted preview isolation, local UI model selection/streaming). Keep the host browser policy intact.

Also open `classic-chat/index.html` directly from the extracted ZIP. Import a synthetic version 1 archive, reload, and export it. If the browser restricts file-origin storage, the UI should report memory-only operation or storage failure instead of silently claiming persistence. Use the local bridge origin for persistent history if necessary.

## Installed bridge smoke test (no account)

The branch-scoped [installation/startup CI](https://github.com/orionflame/orionflame.github.io/actions/runs/45972961966) was in progress when this checkpoint was recorded. Do not assume it passed. To reproduce on Windows, stop the existing bridge first, then run from the repository root:

```powershell
Push-Location tools\classic-chat-bridge
node setup.mjs
node test/startup-smoke.mjs
Pop-Location
```

The smoke test uses a fresh temporary home, discards child logs, and makes no account authorization or inference requests. Expected: loopback health and static resources load, unauthenticated session state remains private, and the process exits cleanly. Report only PASS/FAIL, never the pairing code.

## Windows bridge and live authorization

Start the application from the repository root:

```powershell
.\START-CLASSIC-CHAT.cmd
```

When the terminal reports that the bridge is listening, open:

```
http://127.0.0.1:17879/
```

Then verify:
1. The UI loads and reports the local bridge as available.
2. Pairing accepts the 32-character code printed for this run.
3. Sign in opens the official OpenAI authorization flow.
4. If plan-sharing consent is offered, grant it explicitly.
5. The model picker populates with models returned by the authorized integration.
6. **Test subscription** returns a nonempty response.
7. A normal prompt streams a response, and a follow-up includes the previous turns.
8. Stop response aborts an active generation.
9. Disconnect removes the connected state and disables further AI requests.
10. Restarting the bridge rotates the pairing code.

## Static preview check

Open the direct RawGitHack preview from `CLASSIC-CHAT-BACKUP.md`. Confirm the interface loads, the status says memory-only, and synthetic text can be exported. Refreshing must not restore hosted-preview chats. It must not read or write browser storage, expose pairing controls, or contact the local bridge. Do not add RawGitHack or other third-party preview hosts to `ORIGINS`.

## Report format

Record only pass/fail and non-sensitive diagnostics:

- Installed bridge smoke test: PASS/FAIL/PENDING
- Real browser fixture: PASS/FAIL/BLOCKED
- Offline file archive import/export: PASS/FAIL
- DPAPI test: PASS/FAIL
- Local UI and health check: PASS/FAIL
- Pairing: PASS/FAIL
- Official sign-in and consent: PASS/FAIL/NOT_AVAILABLE
- Model discovery: PASS/FAIL/NOT_AVAILABLE
- Test subscription: PASS/FAIL/NOT_AVAILABLE
- Streaming and follow-up: PASS/FAIL
- Stop and disconnect: PASS/FAIL
- Pairing rotation: PASS/FAIL
- Raw preview isolation: PASS/FAIL

If plan-sharing is unavailable for the account, record `NOT_AVAILABLE` and the safe error category only. Do not try private endpoints, browser-cookie reuse, API-key fallback, or quota workarounds.
