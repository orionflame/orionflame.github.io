# Classic Chat Windows host verification

## Scope

Only Windows-specific credential protection and live account authorization require the Windows host. The browser UI, bridge source, syntax checks, validation tests, and origin-policy regression test have already been checked in the portable environment.

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
cd tools\classic-chat-bridge
npm run check
```

Expected:
- All JavaScript syntax checks pass.
- The Windows DPAPI encrypt/decrypt test runs, not skips.
- The non-Windows DPAPI rejection test skips on Windows.
- All validation tests pass, including rejection of `https://raw.githack.com` as a trusted bridge origin.

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

Open the direct RawGitHack preview from `CLASSIC-CHAT-BACKUP.md`. Confirm the interface loads and local chat storage works. It must remain static-only: it should not connect to the local bridge. Do not add RawGitHack or other third-party preview hosts to `ORIGINS`.

## Report format

Record only pass/fail and non-sensitive diagnostics:

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
