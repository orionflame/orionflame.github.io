/*
 * Passive network metadata observer for your own chatgpt.com page.
 * No network requests are made by this script. No prompt/response content,
 * cookies, tokens, query strings or header values are recorded.
 * Never synthesize, replay, or modify ChatGPT requests.
 */
(() => {
  "use strict";
  if (location.origin !== "https://chatgpt.com" || window.__chatModeWireObserverV1) return;
  Object.defineProperty(window, "__chatModeWireObserverV1", { value: true });
  const CHANNEL = "chat-mode-wire-observer-v1";

  function endpoint(rawUrl, method) {
    if (String(method).toUpperCase() !== "POST") return null;
    try {
      const url = new URL(rawUrl, location.href);
      if (url.origin !== "https://chatgpt.com") return null;
      if (!/^\/backend-api\/(?:f\/)?conversation\/?$/.test(url.pathname)) return null;
      return url.pathname;
    } catch { return null; }
  }

  function safeLabel(value) {
    return typeof value === "string" && value.length <= 120 ? value : null;
  }

  function metadata(raw) {
    let data;
    try {
      if (typeof raw !== "string" || raw.length > 1024 * 1024) return {};
      data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    } catch { return {}; }
    const safe = {};
    for (const [field, key] of [
      ["model", "model"],
      ["model_slug", "modelSlug"],
      ["thinking_effort", "thinkingEffort"],
      ["action", "action"],
      ["conversation_mode", "conversationMode"],
    ]) {
      const v = data[field];
      if (field === "conversation_mode") {
        const kind = safeLabel(v && v.kind);
        if (kind) safe.conversationMode = kind;
      } else {
        const value = safeLabel(v);
        if (value) safe[key] = value;
      }
    }
    safe.topLevelKeys = Object.keys(data).filter(k => typeof k === "string").sort().slice(0, 70);
    return safe;
  }

  function headerNames(input, init) {
    try {
      const provided = init && init.headers !== undefined ? init.headers
        : input && input.headers !== undefined ? input.headers : undefined;
      if (!provided) return [];
      return Array.from(new Headers(provided).keys()).sort().slice(0, 50);
    } catch { return []; }
  }

  function publish(target, transport, started, status, rawBody, headers) {
    const details = metadata(rawBody);
    const record = {
      at: new Date().toISOString(),
      endpoint: target,
      method: "POST",
      transport,
      status: Number.isInteger(status) ? status : null,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      headerNames: Array.isArray(headers) ? headers : [],
      ...details,
    };
    window.postMessage({ channel: CHANNEL, type: "request-metadata", record }, location.origin);
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === "function") {
    window.fetch = function (input, init) {
      const method = (init && init.method) || (input && input.method) || "GET";
      const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input && input.url;
      const target = endpoint(rawUrl, method);
      const started = performance.now();
      let bodyPromise = Promise.resolve("");
      let names = [];
      if (target) {
        names = headerNames(input, init);
        if (init && typeof init.body === "string") bodyPromise = Promise.resolve(init.body);
        else if (typeof Request !== "undefined" && input instanceof Request) {
          try { bodyPromise = input.clone().text().catch(() => ""); } catch { /* No request body capture */ }
        }
      }
      let result;
      try {
        result = Reflect.apply(originalFetch, this, arguments);
      } catch (error) {
        if (target) void bodyPromise.then(body => publish(target, "fetch", started, null, body, names));
        throw error;
      }
      if (target) {
        void Promise.resolve(result).then(
          response => bodyPromise.then(body => publish(target, "fetch", started, response.status, body, names)),
          () => bodyPromise.then(body => publish(target, "fetch", started, null, body, names)),
        ).catch(() => undefined);
      }
      return result;
    };
  }

  if (typeof XMLHttpRequest !== "undefined") {
    const proto = XMLHttpRequest.prototype;
    const originalOpen = proto.open;
    const originalSend = proto.send;
    const marker = Symbol("chat-mode-observer");
    proto.open = function (method, rawUrl) {
      this[marker] = endpoint(rawUrl, method);
      return Reflect.apply(originalOpen, this, arguments);
    };
    proto.send = function (body) {
      const target = this[marker];
      if (target) {
        const started = performance.now();
        const rawBody = typeof body === "string" ? body : "";
        this.addEventListener("loadend", () => {
          publish(target, "xhr", started, this.status || null, rawBody, []);
        }, { once: true });
      }
      return Reflect.apply(originalSend, this, arguments);
    };
  }
})();