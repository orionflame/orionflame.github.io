/* First-party ChatGPT DOM adapter. No backend URLs, auth data, cookies or fetch calls. */
(function (g) {
  'use strict';
  const MESSAGE_SELECTOR = [
    '[data-message-author-role="assistant"]',
    '[data-message-author-role="user"]',
    '[data-content-search-unit-key$=":assistant"]',
    '[data-content-search-unit-key$=":user"]',
    '[data-chatgpt-search-unit-key$=":assistant"]',
    '[data-chatgpt-search-unit-key$=":user"]',
  ].join(',');
  const COMPOSER_SELECTORS = [
    '[data-composer-input] [contenteditable="true"]',
    '#prompt-textarea[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea[name="prompt-textarea"]',
    'textarea#mobile-composer-prompt',
    '[role="textbox"][contenteditable="true"][aria-label*="ChatGPT"]',
  ];
  const SEND_SELECTORS = [
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'button[id="composer-submit-button"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send prompt"]',
    'button[data-testid*="send-button"]',
  ];
  const NEW_CHAT_SELECTORS = [
    'a[data-testid="new-chat-button"]',
    'button[data-testid="new-chat-button"]',
    'a[aria-label="New chat"]',
    'button[aria-label="New chat"]',
  ];
  function normalize(s) {
    return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  }
  function visible(e) {
    if (!e || !e.isConnected || (e.closest && e.closest('#chat-classic-overlay-root'))) return false;
    if (e.hidden || e.getAttribute('aria-hidden') === 'true') return false;
    if (typeof e.getClientRects === 'function' && e.getClientRects().length === 0) return false;
    return true;
  }
  function composer(doc) {
    for (const selector of COMPOSER_SELECTORS) {
      const choice = [...doc.querySelectorAll(selector)].find(visible);
      if (choice) return choice;
    }
    return null;
  }
  function sendButton(doc) {
    for (const selector of SEND_SELECTORS) {
      const choice = [...doc.querySelectorAll(selector)].find(x => visible(x) && !x.disabled && x.getAttribute('aria-disabled') !== 'true');
      if (choice) return choice;
    }
    const c = composer(doc);
    if (!c) return null;
    const form = c.closest('form');
    return form ? [...form.querySelectorAll('button[type="submit"]')].find(x => visible(x) && !x.disabled && x.getAttribute('aria-disabled') !== 'true') || null : null;
  }
  function newChatControl(doc) {
    for (const selector of NEW_CHAT_SELECTORS) {
      const el = [...doc.querySelectorAll(selector)].find(visible);
      if (el) return el;
    }
    return [...doc.querySelectorAll('a,button')].find(el => visible(el) && /^new chat$/i.test(normalize(el.getAttribute('aria-label') || el.textContent))) || null;
  }
  function classify(el) {
    const known = el.getAttribute('data-message-author-role');
    if (known === 'user' || known === 'assistant') return known;
    const key = el.getAttribute('data-content-search-unit-key') || el.getAttribute('data-chatgpt-search-unit-key') || '';
    if (key.endsWith(':user')) return 'user';
    if (key.endsWith(':assistant')) return 'assistant';
    return null;
  }
  function messageText(el, role) {
    const content = role === 'assistant'
      ? el.querySelector('[data-markdown-text-style="assistant-message"], .markdown, [data-message-content="assistant"]')
      : el.querySelector('[data-testid="collapsible-user-message-content"], [data-user-message-bubble], .whitespace-pre-wrap, .rich-text-user-turn');
    const target = content || el;
    // Avoid cloning/interpreting HTML. TextContent only.
    const text = (target.innerText || target.textContent || '').trim();
    return text.slice(0, 24000);
  }
  function turns(doc) {
    const nodes = [...doc.querySelectorAll(MESSAGE_SELECTOR)];
    const results = [];
    const seen = new Set();
    for (const node of nodes) {
      if (!visible(node)) continue;
      const role = classify(node);
      if (!role) continue;
      const id = node.getAttribute('data-message-id') || node.getAttribute('data-chatgpt-search-message-ids') || node.getAttribute('data-content-search-unit-key') || node.getAttribute('data-chatgpt-search-unit-key');
      const text = messageText(node, role);
      if (!text) continue;
      const key = id ? role + ':' + id : String(results.length) + ':' + role + ':' + text.slice(0, 70);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ role, content: text });
    }
    return results.slice(-100);
  }
  function history(doc) {
    const links = [...doc.querySelectorAll('nav[aria-label="Chat history"] a[href*="/c/"], aside a[href*="/c/"]')];
    const seen = new Set();
    const entries = [];
    for (const a of links) {
      if (!visible(a)) continue;
      let url;
      try { url = new URL(a.href, 'https://chatgpt.com/'); } catch { continue; }
      if (url.origin !== 'https://chatgpt.com' || !/\/(?:g\/[^/]+\/)?c\/[a-zA-Z0-9-]+/.test(url.pathname) || seen.has(url.pathname)) continue;
      seen.add(url.pathname);
      entries.push({ title: normalize(a.textContent).slice(0, 70) || 'Conversation', path: url.pathname });
      if (entries.length >= 40) break;
    }
    return entries;
  }
  function mode(doc, pathname) {
    if (/^\/(codex|work)(\/|$)/.test(pathname)) return 'work';
    const tabs = [...doc.querySelectorAll('[role="tab"][aria-selected="true"], [role="tab"][data-state="active"]')];
    const names = tabs.map(e => normalize(e.textContent).toLowerCase());
    if (names.some(x => x === 'work')) return 'work';
    if (names.some(x => x === 'chat')) return 'chat';
    return 'unknown';
  }
  g.ClassicChatDomAdapter = Object.freeze({ normalize, composer, sendButton, newChatControl, turns, history, mode });
})(globalThis);
