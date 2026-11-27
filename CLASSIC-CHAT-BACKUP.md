# Classic Chat backup

**Direct browser preview:** https://raw.githack.com/orionflame/orionflame.github.io/master/classic-chat/index.html

This is a standalone, original Chat-style browser interface. It is not the ChatGPT website or a copy of OpenAI's website source. Use the direct preview if the Pragmatic VEX custom-domain path displays your main website instead.

## Windows 11: run the full local app

Requirements: Node.js 22.12+, Git, and internet access for first-time setup.

```powershell
git clone --single-branch --branch classic-chat-backup-20261127 https://github.com/orionflame/orionflame.github.io.git classic-chat-backup
cd classic-chat-backup
.\START-CLASSIC-CHAT.cmd
```

When the terminal says the bridge is listening, open **http://127.0.0.1:17879/**. Enter the one-time pairing code shown in the terminal, choose **Pair**, then **Sign in with ChatGPT**. Complete OpenAI's official authorization and grant plan-sharing if offered. Choose an available model and use **Test subscription**.

Keep the terminal open while using the local app. Press Ctrl+C to stop it.

## Preview versus local app

- RawGitHack preview: static interface only. It can save chats locally in the browser, but it cannot generate AI replies.
- Local app at `http://127.0.0.1:17879/`: serves the same UI and connects to the local bridge for authorized plan-sharing requests.

The raw preview host is deliberately not trusted by the local bridge. Do not add third-party preview domains to the bridge allowlist.

## Features and limitations

The UI supports separate local conversations, search, copy, and JSON export. The bridge supports text requests and model selection through OpenAI's official Sign in with ChatGPT DevKit. It does not provide ordinary ChatGPT Chat quota, history, memories, Projects, attachments, voice, web search, image generation, or Work mode. Plan-sharing eligibility and usage accounting are controlled by OpenAI and may involve Work/Codex allowance or credits.

The bridge binds only to `127.0.0.1`, requires a fresh 128-bit pairing code, and stores OAuth credentials using Windows DPAPI. No private endpoints, cookie scraping, API-key fallback, or quota bypass are used. Review the DevKit's noncommercial license before use.

More detail:
- [Browser UI README](classic-chat/README.md)
- [Local bridge README](tools/classic-chat-bridge/README.md)
- [Windows launcher](START-CLASSIC-CHAT.cmd)
- [Windows host verification checklist](HOST_RUN_REQUEST.md)
