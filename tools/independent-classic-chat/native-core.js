/* Independent Chat wire codec. No network, credentials, DOM or storage. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.NativeChatWireCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function () {
  'use strict';
  const EFFORTS = Object.freeze(['', 'standard', 'extended', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
  const ENDPOINTS = Object.freeze(['/backend-api/f/conversation', '/backend-api/conversation']);
  function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    throw new Error('Secure UUID generation unavailable.');
  }
  function modelSlug(x) {
    if (typeof x !== 'string' || x.length > 128 || !/^[a-zA-Z0-9._-]+$/.test(x)) throw new Error('Invalid model slug.');
    return x;
  }
  function buildPayload({prompt, model = 'auto', effort = '', conversationId = '', parentMessageId = '', idFactory = uuid,
    timezone = '', timezoneOffsetMinutes = 0, capturedOptions = {}}) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000) throw new Error('Enter a message between 1 and 30,000 characters.');
    model = modelSlug(model);
    if (typeof effort !== 'string' || (effort && !/^[a-zA-Z0-9_-]{1,32}$/.test(effort))) throw new Error('Invalid effort value.');
    if (conversationId && (typeof conversationId !== 'string' || !/^[a-zA-Z0-9_-]{8,150}$/.test(conversationId))) throw new Error('Invalid conversation ID.');
    if (parentMessageId && (typeof parentMessageId !== 'string' || !/^[a-zA-Z0-9_-]{8,150}$/.test(parentMessageId))) throw new Error('Invalid parent message ID.');
    const generatedId = idFactory();
    const now = Date.now() / 1000;
    const message = {
      id: generatedId,
      author: { role: 'user' },
      create_time: now,
      content: { content_type: 'text', parts: [prompt.trim()] },
      metadata: { serialization_metadata: { custom_symbol_offsets: [] } },
    };
    const payload = {
      action: 'next', messages: [message],
      parent_message_id: parentMessageId || 'client-created-root',
      model,
      timezone_offset_min: Number.isFinite(timezoneOffsetMinutes) ? Math.trunc(timezoneOffsetMinutes) : 0,
      ...(timezone ? { timezone } : {}),
      conversation_mode: { kind: 'primary_assistant' },
      supports_buffering: true,
      supported_encodings: ['v1'],
    };
    if (conversationId) payload.conversation_id = conversationId;
    if (effort) payload.thinking_effort = effort;
    // Allowlist ONLY these noncredential, non-user-content values from an observed request.
    const observed = capturedOptions && typeof capturedOptions === 'object' ? capturedOptions : {};
    if (typeof observed.enable_message_followups === 'boolean') payload.enable_message_followups = observed.enable_message_followups;
    if (typeof observed.force_parallel_switch === 'string' && /^(auto|on|off)$/.test(observed.force_parallel_switch)) payload.force_parallel_switch = observed.force_parallel_switch;
    if (typeof observed.paragen_cot_summary_display_override === 'string' && /^(allow|block)$/.test(observed.paragen_cot_summary_display_override)) {
      payload.paragen_cot_summary_display_override = observed.paragen_cot_summary_display_override;
    }
    return { payload, userMessageId: generatedId };
  }
  function parseCatalog(raw) {
    const source = Array.isArray(raw) ? raw : raw && Array.isArray(raw.models) ? raw.models : [];
    return source.map(x => {
      const slug = x && (x.slug || x.id || x.model);
      const name = x && (x.title || x.display_name || x.displayName || x.name || slug);
      if (typeof slug !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(slug)) return null;
      return { slug, name: typeof name === 'string' ? name.slice(0,140) : slug };
    }).filter(Boolean).slice(0,200);
  }
  function partsText(parts) {
    if (!Array.isArray(parts)) return '';
    return parts.filter(x=>typeof x === 'string').join('\n');
  }
  function parseEvent(raw, previous = {}) {
    const current = { ...previous };
    if (raw === '[DONE]') { current.done = true; return current; }
    let ev;
    try { ev = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return current; }
    if (!ev || typeof ev !== 'object') return current;
    if (typeof ev.conversation_id === 'string' && ev.conversation_id.length < 160) current.conversationId = ev.conversation_id;
    if (ev.type === 'error' || ev.error) {
      const e = ev.error && typeof ev.error === 'object' ? ev.error : ev;
      current.errorCode = typeof e.code === 'string' ? e.code.slice(0,80) : 'backend_error';
      current.error = 'The Chat backend returned an error.';
      return current;
    }
    const message = ev.message || (ev.type === 'message' ? ev : null);
    if (message && typeof message === 'object') {
      if (message.author?.role === 'assistant' || message.role === 'assistant') {
        const text = partsText(message.content?.parts);
        if (typeof message.id === 'string' && message.id.length < 160) current.lastAssistantMessageId = message.id;
        if (text) current.text = text.slice(0,150000);
      }
    }
    const patches = Array.isArray(ev.v) ? ev.v : [];
    for (const patch of patches) {
      if (!patch || typeof patch !== 'object') continue;
      const path = typeof patch.p === 'string' ? patch.p : '';
      const op = patch.o;
      const val = typeof patch.v === 'string' ? patch.v : '';
      if (/^\/(?:message\/)?content\/parts\/0$/.test(path) || path === '/message/content/parts/0') {
        if (op === 'append') current.text = String(current.text || '') + val;
        if (op === 'replace') current.text = val;
      }
      if (path === '/conversation_id' && typeof patch.v === 'string') current.conversationId = patch.v;
    }
    // Some current events use an explicit text delta.
    if (ev.type === 'response.output_text.delta' && typeof ev.delta === 'string') current.text = String(current.text || '') + ev.delta;
    return current;
  }
  function sseAccumulator(onEvent) {
    let buffer = '';
    let eventLines = [];
    function dispatch() {
      const data = eventLines.filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      eventLines = [];
      if (data) onEvent(data);
    }
    return {
      feed(chunk) {
        buffer += chunk;
        if (buffer.length > 1_000_000) throw new Error('SSE event too large.');
        let i;
        while ((i=buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0,i).replace(/\r$/, ''); buffer=buffer.slice(i+1);
          if (line === '') dispatch();
          else eventLines.push(line);
          if (eventLines.length > 12000) throw new Error('SSE event too large.');
        }
      },
      finish() {
        if (buffer) eventLines.push(buffer.replace(/\r$/, ''));
        if (eventLines.length) dispatch();
        buffer='';
      },
    };
  }
  function backendError(status, detail = '') {
    const code = Number(status);
    if (code === 401) return 'Chat session not authorized (HTTP 401). Sign in through chatgpt.com.';
    if (code === 403) return 'Chat request rejected (HTTP 403). Authentication or Sentinel requirements may block independent clients. No bypass was attempted.';
    if (code === 429) return 'Chat backend rate limit or allowance reached (HTTP 429).';
    if (code === 404 || code === 405) return 'Chat endpoint unavailable (HTTP '+code+').';
    return 'Chat request failed (HTTP '+(code||'unknown')+').'+ (detail ? ' '+String(detail).slice(0,100):'');
  }
  return Object.freeze({ EFFORTS, ENDPOINTS, buildPayload, modelSlug, parseCatalog, parseEvent, sseAccumulator, backendError });
});
