# Normal Chat mode observer and Classic UI overlay

This Chrome/Brave extension includes a **read-only metadata observer** and an optional **first-party Classic Chat overlay**. The observer is to verify what the **existing regular ChatGPT Chat interface** actually sends. It is independent of the Work/Codex bridge. For the new interface, see [Classic UI overlay](README-addon.md).

It listens **only** for the original `chatgpt.com` page making a `POST /backend-api/f/conversation` or `POST /backend-api/conversation` request. It records the endpoint pathname, response status, model, thinking effort, conversation kind, top-level request field names, and header names. It never records prompt text, responses, cookies, authorization values, CSRF values, Turnstile tokens, device identifiers or URL query strings. It makes no network calls and cannot bypass any access or usage restrictions.

## Install in Chrome / Brave

From PowerShell:

```powershell
git clone --single-branch --branch experiments/chat-mode-wire-observer-20261123 https://github.com/orionflame/orionflame.github.io.git chat-mode-wire-observer
```

In Chrome open `chrome://extensions`, or in Brave `brave://extensions`. Enable **Developer mode**, choose **Load unpacked**, and select the folder:

```text
chat-mode-wire-observer\tools\chat-mode-wire-observer
```

Open `https://chatgpt.com/`, choose **regular Chat** (not Work), and send a short, harmless test prompt. You should see a small **Chat endpoint observer** button near the bottom right. Click it to see the endpoint, model and thinking setting. Try another effort setting through the *official* UI and compare. Click **Copy report** or **Download JSON** when you want to save the sanitized findings.

Before sharing the report, review it yourself. Model identifiers, request path names, field names, and metadata still describe how your account's Chat interface behaves.

## Interpretation

- **Observed normal Chat request:** confirms which endpoint and model fields the current website used for that test. It does **not** confirm a custom client could reuse it later.
- **No record:** the website may use a different endpoint or transport, or injection may have been blocked. This isn't proof Chat was shut down.
- **401 or 403 response:** the website request was not accepted. The extension will not attempt any bypass.
- **Work-only model data:** means the original UI may have been in Work, not Chat.

This extension does **not** replay requests, re-create authentication, handle anti-abuse challenges, access conversations, or send AI prompts. An actual alternative client would require a separately supported request mechanism and live verification. OpenAI can remove server-side support independently of the UI; an old request body cannot override account authorization.

## Privacy

The extension is installed locally, has no background service, and uses no external libraries or web endpoints. Its content scripts only execute on `https://chatgpt.com/*`. Captured metadata is kept in `chrome.storage.local` (up to 100 records) and exported only when you click Copy or Download. Uninstalling the extension removes its storage. The on-page UI is owned by the extension, not GitHub Pages or a third-party site.

The report intentionally excludes raw request bodies and any header values, to avoid leaking login details.

## Tests

```powershell
cd chat-mode-wire-observer\tools\chat-mode-wire-observer
npm run check
```

The tests use a simulated fetch and cannot prove the current production website will call either observed path.

## Notes

The official [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source) integration uses the Responses API and Work/Codex allowance; it is not the normal Chat route. OpenAI's [Terms of Use](https://openai.com/policies/terms-of-use/) restrict reverse engineering and bypassing access controls or limits. Do not use this experiment to evade server-side restrictions.

For the earlier Work/Codex prototype, see `tools/classic-chat-bridge` on the repository's `master` branch. This observer is independent and does not change that project or your website.
\n\nFor the overlay installation and important limitations, see [README-addon.md](README-addon.md).\n