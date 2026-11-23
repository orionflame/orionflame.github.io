## Classic Chat overlay (new in v0.2)

The extension now adds a **Classic Chat UI** launcher on the lower-left of your **existing, signed-in `https://chatgpt.com/` tab**. This is the closest safe test of the original Chat experience without claiming that an old private endpoint is still accessible to independent clients.

**How to use:** Open normal Chat in the original ChatGPT website, select your model and thinking level there, then click **Classic Chat UI** (lower left). Compose a message and press **Send** or Ctrl+Enter. The extension types into the *real ChatGPT composer* and clicks the site's *real Send button*. The resulting conversation is displayed by observing the current page's message elements. Use **Model / reasoning: official UI** to reveal the first-party controls, adjust them, and reopen the overlay.

**Why the official controls?** Their request format, authentication, protection and entitlement checks remain wholly owned by OpenAI's website. This extension neither copies your authorization headers, calls private endpoints, nor replays captured requests. It does not use Work/Codex plan-sharing APIs. If the original page is in Work mode, the overlay refuses to send when it detects that mode. If the mode cannot be reliably detected, you must confirm you selected Chat yourself.

**Important limitation:** If OpenAI eventually removes Chat from its *working frontend* or removes the backend/entitlement, this overlay cannot resurrect it. It is a first-party DOM companion, not a guaranteed future backend replacement. The separate observer remains useful to record current request metadata but does not prove post-removal viability.

**Privacy:** This feature runs entirely on your own ChatGPT page. No separate server, pairing code, API key or token export is involved. Message content is read from the DOM only to display locally in the overlay, not stored, sent elsewhere or exported. The unchanged observer logs only sanitized request metadata.

**Testing:** `npm run check` tests the DOM adapter and avoids backend calls, plus the existing observer tests. A live authenticated Chat test still requires your own browser and permission.
