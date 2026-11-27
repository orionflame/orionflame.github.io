# Classic Chat local bridge (Windows 11)

This local-only Node.js service serves the Classic Chat browser UI and can send authorized text requests through OpenAI's official [Sign in with ChatGPT DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit).

**Use the local UI at `http://127.0.0.1:17879/` for AI replies.** The raw browser preview at [RawGitHack](https://raw.githack.com/orionflame/orionflame.github.io/classic-chat-backup-20261127/classic-chat/index.html) is a static backup only. It is deliberately not trusted by this local service. Do not add third-party preview hosts to the bridge allowlist.

## Requirements

- Windows 11
- Node.js **22.12+**
- Git
- Internet access for the first-time setup and OpenAI authorization

The setup downloads OpenAI's DevKit at pinned revision `0a36fefeb913055c8c7a1a29b63d82b96b2e841a`, builds `@siwc/local`, and installs the bridge dependencies.

## Quick start

If you have not downloaded the backup yet, clone the dedicated backup branch:

```powershell
git clone --single-branch --branch classic-chat-backup-20261127 https://github.com/orionflame/orionflame.github.io.git classic-chat-backup
cd classic-chat-backup
```

From the repository root, run:

```powershell
.\START-CLASSIC-CHAT.cmd
```

Or run the commands manually:

```powershell
cd tools\classic-chat-bridge
node setup.mjs
npm start
```

Keep the terminal open. When the service reports that it is listening, open **http://127.0.0.1:17879/**. The same UI is served locally by the bridge.

1. Open the connection panel.
2. Paste the one-time 32-character pairing code shown in the terminal, then click **Pair**.
3. Click **Sign in with ChatGPT**.
4. Complete the official OpenAI sign-in and grant plan-sharing if offered.
5. Select an available model and click **Test subscription**.

Stop the service with **Ctrl+C**. It does not install itself as a background service or start automatically.

## Security

- The listener binds only to `127.0.0.1`, not to the LAN.
- Requests are restricted to an explicit origin allowlist and require a fresh 128-bit pairing secret printed in the terminal.
- The raw preview origin is not on the allowlist. Open the locally served UI instead of trying to connect the raw preview to the bridge.
- OAuth credentials are stored using Windows DPAPI (CurrentUser) through the official SDK. Credentials are not committed to GitHub and are not returned to page JavaScript.
- Do not bypass the encryption check or replace protected storage with plaintext files.
- Review the SDK before running it. The OpenAI DevKit has its own [noncommercial license](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/LICENSE).

## Limitations

- This is not ordinary ChatGPT Chat. Official plan-sharing is separate, eligibility-gated, and may count against Work/Codex allowance or credits rather than normal Chat quota.
- Text only. No ChatGPT history, memories, Projects, attachments, voice, web search, image generation, or Work mode.
- No private ChatGPT endpoints, browser-cookie access, API-key fallback, or quota bypass.
- Local conversation history uses browser storage when available. JSON import merges archives without overwriting existing chats, with a 16 MiB automatic import limit. Export explicitly for a separate backup. Hosted previews are memory-only.
- Static syntax and validation tests do not prove live account eligibility. Complete the authorization and test request on your own Windows machine.

## Troubleshooting

- **Bridge offline:** confirm the terminal still shows the service running and port `17879` is free. Open `http://127.0.0.1:17879/`, not the raw preview URL.
- **Pairing code incorrect:** use the current terminal's 32-character code. It changes after each restart.
- **No models:** confirm that plan-sharing permission was granted and that the account is eligible. A model in the ChatGPT website picker is not guaranteed to be available through the DevKit.
- **No replies:** first run **Test subscription**. If it fails, read the safe error in the UI and the non-secret diagnostic in the terminal.
- **DPAPI unavailable:** use a supported Windows account environment. Do not bypass encryption or store OAuth tokens as plaintext.

## Developer checks

```powershell
npm run check
```

See [HOST_RUN_REQUEST.md](../../HOST_RUN_REQUEST.md) for optional Chromium regression tests with synthetic fixtures and the Windows DPAPI/live authorization checks. The portable tests are not a substitute for real browser or account verification.
