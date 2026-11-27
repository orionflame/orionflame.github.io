/* Local backup format. No network or account data is required. */
(() => {
  'use strict';
  const MAX_IMPORT_BYTES = 16 * 1024 * 1024;
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const nonempty = value => typeof value === 'string' && value.length > 0;
  function normalize(value, requireVersion = false) {
    if (!record(value) || !Array.isArray(value.chats) ||
        (requireVersion && value.version !== 1) ||
        (value.version !== undefined && value.version !== 1)) {
      throw new Error('Expected a Classic Chat version 1 backup.');
    }
    const ids = new Set();
    const chats = value.chats.map(chat => {
      if (!record(chat) || !nonempty(chat.id) || ids.has(chat.id) ||
          typeof chat.title !== 'string' || !Array.isArray(chat.messages)) {
        throw new Error('Invalid or duplicate conversation in backup.');
      }
      ids.add(chat.id);
      const messageIds = new Set();
      const messages = chat.messages.map(message => {
        if (!record(message) || !nonempty(message.id) || messageIds.has(message.id) ||
            !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' ||
            (message.status !== undefined && !['done', 'error', 'streaming'].includes(message.status))) {
          throw new Error('Invalid or duplicate message in backup.');
        }
        messageIds.add(message.id);
        return {id: message.id, role: message.role, content: message.content,
          status: message.status === 'streaming' ? 'error' : message.status || 'done'};
      });
      return {id: chat.id, title: chat.title, messages};
    });
    return {chats, activeId: ids.has(value.activeId) ? value.activeId : chats[0]?.id ?? null};
  }
  function merge(current, incoming) {
    const chats = current.slice();
    const byId = new Map(chats.map(chat => [chat.id, chat]));
    let imported = 0, skipped = 0;
    const same = (a, b) => a.title === b.title && JSON.stringify(a.messages) === JSON.stringify(b.messages);
    for (const chat of incoming) {
      let id = chat.id, suffix = 0;
      while (byId.has(id) && !same(byId.get(id), chat)) id = `${chat.id}~import-${++suffix}`;
      if (byId.has(id)) { skipped++; continue; }
      const copy = {...chat, id};
      chats.push(copy);
      byId.set(id, copy);
      imported++;
    }
    return {chats, imported, skipped};
  }
  globalThis.ClassicArchive = Object.freeze({MAX_IMPORT_BYTES, normalize, merge});
})();
