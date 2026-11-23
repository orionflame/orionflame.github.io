# Classic Chat local bridge (Windows 11)

A *local-only* Node.js service that allows the browser UI at https://pragmatic-vfx.com/classic-chat/ to send authorized AI requests through the official [Sign in with ChatGPT DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit).

## Run

Requires Node.js **22.12+**, Git and internet access. First setup downloads OpenAI's DevKit pinned to revision `0a36fefeb913055c8c7a1a29b63d82b96b2e841a` and builds `@siwc/local` locally.

```powershell
git clone https://github.com/orionflame/orionflame.github.io.git
cd orionflame.github.io\tools\classic-chat-bridge
node setup.mjs
npm start
```

The terminal prints a one-time pairing code. Open **https://pragmatic-vfx.com/classic-chat/** and choose the local bridge settings. Paste the code, click **Pair**, then **Sign in with ChatGPT**. Grant plan sharing in OpenAI's own authentication window. The model picker will show available models. Use **Test subscription** to make one real request.

If your browser blocks the hosted page from accessing `127.0.0.1`, open **http://127.0.0.1:17879/** instead. The local service serves the same UI directly.

Stop the process with **Ctrl+C**. The service does not run by itself or start automatically.

## Security and limitations

- The local listener binds only to `127.0.0.1` and accepts only a strict list of allowed web origins. Requests also require a fresh 128-bit pairing secret printed to your terminal. Other website origins cannot make paired requests.
- OAuth credentials are persisted by `@siwc/local` using **Windows DPAPI (CurrentUser)**, a protected storage format. The pairing code and OAuth tokens are never committed to GitHub. Page JavaScript receives only the pairing secret you enter and account status, never the OAuth access or refresh token.
- Code and dependencies are downloaded only by setup; review before running. The OpenAI SDK has its own [noncommercial license](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/LICENSE).
- The prototype supports text-only chat and model selection. No ChatGPT historical conversations, attachments, Projects, tools, memories or promised High thinking mode.
- **It does not preserve ordinary Chat quota.** OpenAI's approved plan-sharing scope is distinct from normal Chat quota, may count against Work/Codex allowance, and may not be available to all accounts.
- The website stores your chat history only in the current browser's localStorage. Do not put private conversations into a shared computer/browser, and export copies before clearing browser storage.
- Tested: JavaScript syntax and static validation tests. Not yet verified with an authorized Windows ChatGPT account. No API-key fallback or unsupported private endpoint calls.

## Troubleshooting

- "Bridge offline": check that `npm start` is still running and port `17879` is free. Try the local URL if Chrome blocks local-network access from the hosted page.
- "Pairing code incorrect": copy the 32-digit code from the current terminal session. It changes each restart.
- Sign-in cannot complete: confirm default browser, local callback access and your account's eligibility/consent.
- No models: ensure plan usage permission was granted. A model appearing on ChatGPT's original website does not guarantee availability in the DevKit.
- No AI replies: the message was only saved locally until the bridge and authorized model were connected.

## Developer checks

```powershell
npm run check
```
