# Classic Chat Test

A local, ChatGPT-style conversation UI for testing **your own ChatGPT plan** with OpenAI's official [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) flow.

This is a **personal experiment**, not an OpenAI product or a copy of OpenAI's site source code. It reproduces the general dark Chat layout from a supplied screenshot using original HTML/CSS/JavaScript.

## What works

- Sign in with your ChatGPT account via OpenAI's official browser consent screen.
- Explicitly approve ChatGPT plan sharing for this local app, if your account is eligible.
- List models made available by the official plan-sharing API.
- Send messages, stream replies, continue a local multi-turn conversation, stop a response, and start new chats.
- Run a **Test subscription** request, displaying the selected model and actual reply.
- Manage usage and disconnect the account.
- Keep OAuth credentials encrypted on your machine through Electron safeStorage. The renderer never receives credentials.

## What this does **not** do

- **No preservation of the original Chat allowance.** Official plan-sharing requests may use your **Work/Codex allowance or credits**, not the ordinary Chat message quota. They are subject to your plan's eligibility and usage limits.
- **No ChatGPT conversation history, memories, Projects, attachments, voice, web search, image generation, or Work mode.** The SDK does not grant those features.
- **No High reasoning-effort switch.** The current DevKit's `streamResponse` API exposes a model selection but not a reasoning-effort setting.
- No sharing of browser cookies, scraping of ChatGPT's private endpoints, API key, or bypass of service limits.
- No syncing or saved chat history. Chats exist **in memory only** while this window stays open.

## Windows 11 setup

Requirements: **Node.js 22.12+**, **Git**, and network access to GitHub and OpenAI. The first setup downloads Electron and the official OpenAI DevKit.

```powershell
git clone --single-branch --branch experiments/chatgpt-classic-subscription-20261123 https://github.com/orionflame/orionflame.github.io.git classic-chat-test
cd classic-chat-test
node scripts/setup.mjs
npm start
```

The code lives on an isolated experiment branch. **No website files on the original `master` branch are changed.**

1. Click **Connect ChatGPT**, then **Continue with ChatGPT**.
2. Your system browser opens `auth.openai.com`. Authenticate directly with OpenAI, select your ChatGPT workspace, and approve the separate **plan usage** consent if offered.
3. Return to the local app. Wait for models to appear in the model picker.
4. Click **Test subscription** in the account popover. A successful response is proof this local app made a real request using the authorized plan-sharing connection.
5. Send a message in the composer. Conversation state stays in this local app and does not appear in chatgpt.com Recents.

If **Test subscription** fails, inspect the error shown in the app. Common causes: authorization was not granted, the model is unavailable, connection was lost, or your plan allowance is exhausted. There is **no fallback to a separately billed API key**.

## Build and verification

```powershell
npm run check
```

The command runs JavaScript syntax checks and unit tests that validate chat message boundaries and prevent request details from leaking through generic errors. Static tests do not prove OpenAI account eligibility or run real inference.

The prototype was authored and syntax-tested in a restricted environment without network access to npm or GitHub and without a signed-in ChatGPT account. **The complete Electron/OAuth integration has not been end-to-end tested on Windows yet.** The final confirmation must be performed on your computer.

## What setup installs

The `scripts/setup.mjs` script fetches the official [`openai/sign-in-with-chatgpt-devkit`](https://github.com/openai/sign-in-with-chatgpt-devkit) repository at pinned commit `0a36fefeb913055c8c7a1a29b63d82b96b2e841a` into ignored `vendor/siwc-devkit/`. It installs the SDK dependencies, builds only `@siwc/local`, and installs Electron. This avoids copying or vendoring the DevKit source into the prototype repo.

**Security model:** OAuth happens in the system browser on OpenAI's domain. OAuth access/refresh tokens and related credentials are stored by the SDK using OS-backed Electron `safeStorage` encryption. Linux's insecure `basic_text` storage is explicitly rejected. The UI can call only explicitly allowlisted IPC functions, and content appears as text rather than executable HTML. Credentials are never returned to the renderer, stored in this repository, or put into logs. The app serves only local static files and has a restrictive content security policy.

Review the SDK's [licensing and security documentation](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/docs/security.md) before using or redistributing it. The official DevKit uses a separate noncommercial license. The project does not assert that the SDK offers unrestricted access to normal ChatGPT Chat features.

## Troubleshooting

- **No models:** Check the requested permissions, plan eligibility, and your network, then reconnect. Model availability may differ from chatgpt.com's picker.
- **Cannot connect:** Ensure the app can open your default browser and listen on a loopback `127.0.0.1` callback, and allow the OpenAI sign-in page to return to the app.
- **Encryption unavailable:** Windows should use Electron's OS-backed storage. Do not use a plaintext credentials workaround.
- **No replies or usage cap:** Check [ChatGPT usage settings](https://chatgpt.com/settings/usage). The app will not evade a disabled API permission or plan limit.
- **No npm/GitHub access:** Install with an internet connection; setup cannot finish offline.

## Sources

- [OpenAI's DevKit and SDK](https://github.com/openai/sign-in-with-chatgpt-devkit)
- [OpenAI's official sign-in and plan usage guide](https://developers.openai.com/siwc/token-sharing-open-source)
- [OpenAI's implementation cookbook](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [OpenAI Help Center on plan use in other apps](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites)
