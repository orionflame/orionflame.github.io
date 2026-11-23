export function validateRequest(body, modelCatalog) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid request.');
  }
  if (typeof body.model !== 'string' || !modelCatalog.some((model) => model.slug === body.model)) {
    throw new Error('Select a model from the available ChatGPT plan models.');
  }
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.requestId)) {
    throw new Error('Invalid request identifier.');
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 120) {
    throw new Error('Chat history must contain 1 to 120 messages.');
  }
  let total = 0;
  for (const message of body.messages) {
    if (!message || typeof message !== 'object' || !['user', 'assistant'].includes(message.role) ||
        typeof message.content !== 'string' || !message.content.trim() || message.content.length > 120_000) {
      throw new Error('Invalid chat message.');
    }
    total += message.content.length;
    if (total > 250_000) throw new Error('Chat history is too large. Start a new conversation.');
  }
  if (body.messages.at(-1).role !== 'user') throw new Error('The last message must be from you.');
  return {
    requestId: body.requestId,
    model: body.model,
    messages: body.messages.map(({ role, content }) => ({ role, content })),
  };
}

export function safeErrorMessage(error) {
  // Never pass arbitrary network errors to the renderer: they can contain tokens,
  // request data, or signed URLs. @siwc/local supplies sanitized ChatGPTError messages.
  if (error && typeof error === 'object' && error.name === 'ChatGPTError' && typeof error.message === 'string') {
    return error.message.slice(0, 600);
  }
  if (error && typeof error === 'object' && error.name === 'AbortError') return 'Request stopped.';
  return 'Request failed. Check your connection and try again.';
}
