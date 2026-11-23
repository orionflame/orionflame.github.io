# Classic Chat on pragmatic-vfx.com

**Live interface:** https://pragmatic-vfx.com/classic-chat/

This is a standalone, original browser UI modeled after a familiar chat composer. It is not the ChatGPT website and does not impersonate OpenAI or use a ChatGPT website session cookie.

## What works in GitHub Pages alone

- A full-size chat-style editor; paste long messages, use Shift+Enter for multiline input, copy them back, and keep separate conversations.
- Local browser history via localStorage; delete chats or export the conversations as JSON.
- An official ChatGPT link for normal subscription use.

**GitHub Pages alone has no AI backend.** Without the local bridge, the Send button saves your message locally but **does not** send it to OpenAI or generate AI replies. The page shows an explicit warning.

## Optional real AI replies using your plan

The companion bridge in [`tools/classic-chat-bridge`](../tools/classic-chat-bridge/) is a small Windows Node.js service that uses OpenAI's public, supported [Sign in with ChatGPT DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit). It runs on `127.0.0.1:17879` and uses a per-run pairing code. You authorize plan-sharing in the official OpenAI browser flow. The bridge stores credentials encrypted under the Windows user account via DPAPI, never in GitHub Pages.

Setup instructions: [Bridge README](../tools/classic-chat-bridge/README.md).

**Usage limitation:** It is not the same as ordinary ChatGPT Chat. Plan-sharing is gated by eligibility and may count against Work/Codex usage instead of the usual Chat quota. There is no way to force old Chat quota through GitHub Pages.
