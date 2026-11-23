# Hand-off and verification

## Scope

Independent local Electron prototype for testing official ChatGPT plan-sharing against a new, Chat-style UI. No undocumented private endpoints, no credentials in repository, no changes to existing website default branch.

## Source / dependencies

- Prototype branch: `experiments/chatgpt-classic-subscription-20261123` in `orionflame/orionflame.github.io`.
- DevKit revision: `0a36fefeb913055c8c7a1a29b63d82b96b2e841a`.
- SDK: `@siwc/local` built from a pinned clone, installed through `file:` dependency.
- Electron: `^42.11.4` (downloaded during setup).
- Credentials: Electron OS encryption in main process, no plaintext fallback.

## Tests recorded by author

- `npm run check`: 6/6 Node tests passed, all JS syntax checks passed.
- Live OAuth / model request: **NOT RUN** because this environment cannot reach npm/GitHub or authenticate as the user's ChatGPT account.
- Visual browser screenshot: **NOT VERIFIED** because headless Chromium did not complete a screenshot in the sandbox. Verify locally in Electron.

## Acceptance test on Windows

1. Follow `README.md` setup, start Electron, verify the dark interface appears.
2. Connect with ChatGPT via real authorization and explicitly enable plan usage.
3. Verify model list loads; select a model.
4. Click `Test subscription` and confirm a nonempty reply.
5. Send `Reply with the number 7.`; confirm streaming then completion.
6. Send a follow-up and confirm the prior user/assistant turns are included.
7. Create a new chat, verify history navigation during current run.
8. Quit/restart, verify chat history intentionally resets but encrypted account connection persists.
9. Disconnect, verify the app no longer sends messages.
10. Inspect usage in ChatGPT settings. Compare model access and usage separately from ordinary Chat mode.

## Known limitations

Official plan-sharing is a separate authorized product surface. It can draw from Work/Codex or credit allowance, not Chat quota. No exact Chat parity is claimed, and the prototype does not prove the Chat mode can survive server-side removal.
