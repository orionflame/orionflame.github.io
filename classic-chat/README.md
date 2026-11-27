# Classic Chat backup

**Direct browser preview:** https://raw.githack.com/orionflame/orionflame.github.io/classic-chat-backup-20261127/classic-chat/index.html

This is the standalone Classic Chat interface stored in this repository. Use the direct preview above when the custom-domain URL displays the main Pragmatic VEX website instead. The preview is served from the GitHub source through RawGitHack, not from `pragmatic-vfx.com`.

This is an original personal browser UI inspired by a familiar chat layout. It is not OpenAI's ChatGPT website, does not contain OpenAI website source code, and does not read or reuse a ChatGPT browser session or cookie.

## What the direct preview does

- Displays the full chat-style interface with a conversation sidebar and composer.
- Keeps conversations in memory for the current page only; the hosted preview never reads or writes browser storage.
- Supports separate chats, search, copy, and version 1 JSON import/export.
- Links to the official ChatGPT website for normal subscription use.

**Important:** the raw preview is a static browser copy. It can manage synthetic chat text and export it, but it does not generate AI replies by itself. Do not enter private conversation text or credentials into a third-party hosted preview. It intentionally cannot connect to the local AI bridge because the third-party preview origin is not trusted by that service.

## Offline archive recovery

Extract the ZIP and open `classic-chat/index.html` directly, or open the local bridge UI. Use **Import conversations** to restore a version 1 JSON export of up to 16 MiB. Imports preserve existing chats, create a separate copy on ID conflict, and skip identical copies. Browser storage is best-effort: export explicitly to retain your data. Unreadable original storage is left intact. Long saved messages and full chat histories are not silently truncated on reload.

## Run the full local application on Windows 11

For AI replies, run the companion service and open the interface it serves locally. This is the recommended full application path:

1. Install Node.js **22.12 or newer** and Git.
2. Clone this repository and check out the backup branch:

   ```powershell
   git clone --single-branch --branch classic-chat-backup-20261127 https://github.com/orionflame/orionflame.github.io.git classic-chat-backup
   cd classic-chat-backup
   ```

3. Start the local application:

   ```powershell
   .\START-CLASSIC-CHAT.cmd
   ```

   On first run, the launcher installs the pinned OpenAI Sign in with ChatGPT DevKit and dependencies. This requires internet access. Later runs skip setup.

4. Open **http://127.0.0.1:17879/** in your browser after the service starts.
5. In the app, open the connection panel, enter the one-time pairing code printed in the terminal, and click **Pair**.
6. Click **Sign in with ChatGPT**. Complete OpenAI's official browser authorization and grant plan-sharing if offered.
7. Select an available model and use **Test subscription** before sending a message.

The bridge serves the same local UI and keeps its listener bound to `127.0.0.1`. The pairing code is regenerated for each run. Keep the terminal open while using the app and stop the service with **Ctrl+C**.

Full details: [Local bridge README](../tools/classic-chat-bridge/README.md).

## Usage and feature limits

- Official plan-sharing is a separate authorized product surface. It is not ordinary ChatGPT Chat quota and may use Work/Codex allowance or credits. Eligibility and limits are controlled by OpenAI.
- This prototype is text-only. It does not provide ChatGPT history, memories, Projects, attachments, voice, web search, image generation, or Work mode.
- The locally opened file and local bridge UI use browser storage when available. Hosted previews are memory-only. Export conversations to retain a separate backup.
- No private ChatGPT endpoints, cookie scraping, API-key fallback, or quota bypass are used.

## Source locations

- Browser UI: `classic-chat/`
- Windows local bridge: `tools/classic-chat-bridge/`
- Direct preview: https://raw.githack.com/orionflame/orionflame.github.io/classic-chat-backup-20261127/classic-chat/index.html
- Official integration: [OpenAI Sign in with ChatGPT DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit)
