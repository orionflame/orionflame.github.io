# Independent Classic Chat: original Chat backend experiment

**What this is:** a Chrome/Brave extension with its **own Chat interface**, mounted on `https://chatgpt.com`. It **does not invoke ChatGPT's original Chat composer or Send button**, and does **not** use the Work/Codex or public OpenAI Responses API. It makes an independent, authenticated, first-party browser request to the *observed regular Chat conversation service*.

**What this is not:** a guaranteed way to retain the Chat allowance if OpenAI removes its Chat user interface. OpenAI also controls the backend, authentication, quota policy, and Sentinel/anti-abuse requirements. The private conversation API is unsupported and can change or reject independent clients at any time. If a required verification challenge is returned, **this tool stops** rather than bypassing it.

## Install (Windows Chrome or Brave)

1. Clone the isolated branch:

   ```powershell
   git clone --single-branch --branch experiments/independent-classic-chat-20261124 https://github.com/orionflame/orionflame.github.io.git independent-classic-chat
   ```

2. In Chrome open `chrome://extensions`, or in Brave open `brave://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select `independent-classic-chat\tools\independent-classic-chat`.
4. Open `https://chatgpt.com/` and sign into your existing ChatGPT account through OpenAI.
5. Click **Independent Chat** (bottom left), or visit `https://chatgpt.com/?independent-chat=1`.
6. Click **Connect**. This checks the current browser session and tries to list first-party Chat models.
7. Choose the model slug shown by model discovery, or use `auto`. Enter a `thinking_effort` value only if you have observed a matching value in the official Chat interface. The web-facing values do **not** necessarily map 1:1 to Instant, High, Extra High, or Pro.
8. Send a short, harmless test prompt. **This is a real send attempt** and can create a conversation and consume an account allowance if accepted. There is no fallback to Work/Codex.
9. If the request fails, click **Copy diagnostics**. The report includes only endpoint, HTTP status, selected model and effort, and challenge outcome. Do not post session JSON, cookies, HAR files, or raw authorization headers.

**No `npm start`, local bridge, API key, or separately billed API key is needed for the extension itself.** The browser must still be signed in to `chatgpt.com` and the service must continue accepting the request.

If you already installed the earlier Chat Mode Observer or Classic Chat overlay extension, disable it temporarily while testing this one. They are separate extensions.

## Architecture

- Independent composer, conversation list, model text field, effort text field, Send, Stop, and SSE display.
- Entire interface is injected on `chatgpt.com`, but uses **zero DOM selectors or event controls from the site's own Chat UI**. The same extension UI still renders when the test webpage contains only a dummy Work panel and no original Chat composer.
- `GET /api/auth/session` is used only when you click **Connect**, to obtain the session access token **in memory**. The token isn't logged, stored, exported, or placed in GitHub. Requests stay on `https://chatgpt.com` and include browser cookies only through the browser's own credential handling.
- `GET /backend-api/models` is used for model discovery. If it fails, you can enter the model slug, but a slug cannot grant access by itself.
- When enabled, `POST /backend-api/sentinel/chat-requirements/prepare` and `finalize` attempt an ordinary requirements negotiation. If it requires Turnstile, proof-of-work, or another verification step, the client reports `challenge_required` instead of solving around it.
- Conversation requests target `POST /backend-api/f/conversation`. The older `/backend-api/conversation` is tried **only on 404/405 for a new conversation**. No third-party domains or Work endpoints are contacted.
- Streamed SSE messages are decoded, text is shown locally, and backend conversation/parent message IDs are retained only for valid follow-ups. A stream missing completion or lineage is reported as partial, not silently declared successful.
- While the original Chat UI is still present, the extension passively observes its outgoing Chat requests and stores **only model, effort, endpoint and an allowlist of harmless option values** in `localStorage`. This helps preserve model choices, not credentials or challenge tokens. It does not save prompt text or response bodies.
- The prompts and replies you enter in the extension exist in memory while the page is open. The extension does not store or export them automatically. If a server request is accepted, the server may still store the corresponding conversation.

## What a successful test proves

A **real HTTP 200** plus a decoded SSE assistant response in the independent UI would show that a user-signed-in browser can submit via this independent client **at that moment**, without the original Chat frontend. It would **not** prove that a future backend will stay open, the request will count against the old Chat allowance, or the client will survive server-side changes.

A **403 / challenge_required / 401** proves the real service did not accept the attempt. Don't mistake a working mock test for real access. No client can keep a service alive or force server-side quota entitlements.

## Tests

Run static checks and 13 unit/transport tests:

```powershell
cd independent-classic-chat\tools\independent-classic-chat
npm run check
```

An optional test for environments with Python Playwright and Chromium is `python test/browser-smoke.py`. It injects the released UI into a **blank, mocked browser page** containing no Chat composer, simulates authorization and SSE, and verifies one direct POST. It never contacts OpenAI. The test is not guaranteed to run on Windows without editing the Chromium executable path.

## Limitations and security

- **Unverified against an authorized live ChatGPT account:** this development environment cannot use your browser session. A local mock passing does **not** confirm production server acceptance.
- This uses an unofficial, undocumented Chat web protocol. OpenAI may block independent requests, change the format, or discontinue the route even if Work stays online.
- Authentication and anti-abuse gates remain fully controlled by OpenAI. The extension does not evade rate limits, anti-bot challenges, or access restrictions. If the main domain becomes unavailable, a `chatgpt.com` content script cannot run.
- The model name and `thinking_effort` field are low-level request settings; they are not guaranteed to match the plan's consumer UI semantics or allowance.
- This extension runs on pages served by `chatgpt.com` in the browser's main JavaScript world so it can perform first-party requests. As with the normal ChatGPT web interface, page JavaScript can access prompts you enter on the page. Install only source you trust.
- The project has no external dependencies, no analytics, no remote update service, and no credential export endpoint. It requires no `cookies`, `webRequest`, or remote host permission in its manifest.

## File map

- `native-core.js`: pure request and stream codecs.
- `native-transport.js`: same-origin session, models, server requirements and send handling.
- `native-ui.js` / `native-ui.css`: independent injected interface.
- `test/*.cjs`: codec/security/transport unit tests.
- `test/browser-smoke.py`: optional browser UI mock test.

The initial references for the observed protocol include public research as of mid/late 2026; none is an official stability contract:

- https://performance.dev/chatgpt
- https://github.com/paakjong/chatgpt-session-cli
- https://github.com/MartinezS8/chatgpt-web2api/blob/master/docs/protocol-reference.md

For the existing Work/Codex plan-sharing prototype, see `tools/classic-chat-bridge` on the repository's `master` branch. This independent-client experiment does not replace or modify it.
