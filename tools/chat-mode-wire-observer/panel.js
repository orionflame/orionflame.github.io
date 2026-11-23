/*
 * Chrome/Brave isolated content script.
 * Displays and exports only sanitized network metadata.
 * No response bodies, prompt text, token values or credentials are collected.
 */
(() => {
  "use strict";
  if (location.origin !== "https://chatgpt.com") return;
  const CHANNEL = "chat-mode-wire-observer-v1";
  const KEY = "chat-mode-wire-metadata-v1";
  const MAX = 100;
  const records = [];
  let ui = null;
  let opened = false;

  function clean(raw) {
    if (!raw || typeof raw !== "object") return null;
    const allowedEndpoint = ["/backend-api/conversation", "/backend-api/f/conversation"];
    if (!allowedEndpoint.includes(raw.endpoint)) return null;
    const safe = {
      at: typeof raw.at === "string" ? raw.at.slice(0, 40) : "",
      endpoint: raw.endpoint,
      method: "POST",
      transport: raw.transport === "xhr" ? "xhr" : "fetch",
      status: Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599 ? raw.status : null,
      latencyMs: Number.isInteger(raw.latencyMs) ? Math.max(0, Math.min(raw.latencyMs, 999999)) : null,
    };
    for (const key of ["model", "modelSlug", "thinkingEffort", "action", "conversationMode"]) {
      if (typeof raw[key] === "string") safe[key] = raw[key].slice(0, 120);
    }
    for (const key of ["topLevelKeys", "headerNames"]) {
      safe[key] = Array.isArray(raw[key])
        ? raw[key].filter(x => typeof x === "string" && x.length <= 80).slice(0, 70)
        : [];
    }
    return safe;
  }

  function save() {
    chrome.storage.local.set({ [KEY]: records.slice(-MAX) }).catch(() => undefined);
  }

  function add(value) {
    const record = clean(value);
    if (!record) return;
    records.push(record);
    if (records.length > MAX) records.shift();
    save();
    render();
  }

  function report() {
    return JSON.stringify({
      title: "Chat Mode request metadata (no prompts, response bodies, cookies or tokens)",
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent.includes("Chrome") ? "Chromium-family" : "other",
      count: records.length,
      records,
    }, null, 2);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(report());
      setMessage("Metadata copied. Check it before sharing.");
    } catch {
      download();
      setMessage("Clipboard blocked; downloaded JSON instead.");
    }
  }

  function download() {
    const blob = new Blob([report()], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "chat-mode-wire-metadata.json";
    document.documentElement.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setMessage(message) {
    if (ui) ui.message.textContent = message;
  }

  function render() {
    if (!ui) return;
    ui.toggle.textContent = "Chat endpoint observer · " + records.length;
    ui.list.replaceChildren();
    for (const record of records.slice(-12).reverse()) {
      const row = document.createElement("div");
      row.className = "record";
      const first = document.createElement("div");
      first.className = "mono";
      first.textContent = (record.status || "ERR") + " · " + record.endpoint;
      const second = document.createElement("div");
      second.textContent = [
        record.model || record.modelSlug || "unknown model",
        record.thinkingEffort || "unspecified effort",
        record.conversationMode || "unspecified mode",
      ].join(" · ");
      row.append(first, second);
      ui.list.append(row);
    }
    if (!records.length) {
      const hint = document.createElement("p");
      hint.textContent = "Select regular Chat on this website and send a harmless test message. This monitor will show the request path and model if it matches the observed conversation endpoints.";
      ui.list.append(hint);
    }
    ui.panel.hidden = !opened;
  }

  function element(tag, label, parent) {
    const item = document.createElement(tag);
    item.textContent = label;
    parent.append(item);
    return item;
  }

  function mount() {
    if (ui || !document.documentElement) return;
    const host = document.createElement("div");
    host.id = "chat-mode-wire-observer-root";
    host.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483646;pointer-events:auto";
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = [
      ":host{font:13px/1.5 system-ui,sans-serif;color:#fff}",
      "button{cursor:pointer;font:inherit;color:inherit;background:#242424;border:1px solid #555;border-radius:8px;padding:7px 10px}",
      ".shell{width:min(420px,calc(100vw - 24px));color:#f3f3f3}",
      ".toggle{display:block;margin-left:auto;background:#263b46;border-color:#517b94}",
      ".panel{background:#171717;border:1px solid #444;border-radius:12px;margin-bottom:8px;padding:13px;max-height:56vh;overflow:auto;box-shadow:0 8px 40px #000a}",
      ".panel[hidden]{display:none!important}",
      ".heading{font-weight:700;font-size:15px;margin:0 0 7px}",
      ".hint{color:#bbb;margin:0 0 12px;font-size:12px}",
      ".actions{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}",
      ".record{border-bottom:1px solid #333;padding:7px 0;font-size:12px}",
      ".mono{font-family:Consolas,monospace;overflow-wrap:anywhere}",
      ".list{max-height:170px;overflow:auto}",
      ".status{min-height:18px;color:#a6d4ff;font-size:11px}",
    ].join("");
    const shell = document.createElement("div"); shell.className = "shell";
    const panel = document.createElement("section"); panel.className = "panel"; panel.hidden = true;
    const title = element("h2", "Regular Chat request observer", panel); title.className = "heading";
    const hint = element("p", "Read-only. Captures endpoint, status, model and effort, but never prompts, replies or credentials. No requests are sent by this extension.", panel); hint.className = "hint";
    const actions = document.createElement("div"); actions.className = "actions"; panel.append(actions);
    const copyButton = element("button", "Copy report", actions);
    const saveButton = element("button", "Download JSON", actions);
    const clearButton = element("button", "Clear", actions);
    const list = document.createElement("div"); list.className = "list"; panel.append(list);
    const message = document.createElement("p"); message.className = "status"; panel.append(message);
    const toggle = element("button", "Chat endpoint observer · 0", shell); toggle.className = "toggle";
    shell.prepend(panel);
    shadow.append(style, shell);
    document.documentElement.append(host);
    ui = { host, toggle, panel, list, message };
    toggle.addEventListener("click", () => { opened = !opened; render(); });
    copyButton.addEventListener("click", copy);
    saveButton.addEventListener("click", download);
    clearButton.addEventListener("click", () => { records.splice(0); save(); render(); });
    render();
  }

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== "https://chatgpt.com") return;
    if (!event.data || event.data.channel !== CHANNEL || event.data.type !== "request-metadata") return;
    add(event.data.record);
  });

  chrome.storage.local.get(KEY).then(saved => {
    const old = saved && saved[KEY];
    if (Array.isArray(old)) {
      for (const entry of old.slice(-MAX)) {
        const cleanEntry = clean(entry);
        if (cleanEntry) records.push(cleanEntry);
      }
    }
    render();
  }).catch(() => undefined);

  if (document.documentElement) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
})();