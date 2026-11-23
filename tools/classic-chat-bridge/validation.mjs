export const PORT = 17879;
export const ORIGINS = new Set([
  'https://pragmatic-vfx.com',
  'https://www.pragmatic-vfx.com',
  'https://orionflame.github.io',
  'http://127.0.0.1:17879',
  'http://localhost:17879',
]);
export function allowedOrigin(origin) { return !origin || ORIGINS.has(origin); }
export function allowedHost(host) { return host === `127.0.0.1:${PORT}` || host === `localhost:${PORT}`; }
export function validateModel(model, available) {
  if (typeof model !== 'string' || !model || model.length > 200 || !available.some(m=>m.slug===model)) {
    throw new Error('Select a model available to your connected ChatGPT account.');
  }
  return model;
}
export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) throw new Error('Submit 1 to 30 messages.');
  let n = 0;
  const safe = messages.map(m => {
    if (!m || typeof m !== 'object' || !['user','assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 24000) throw new Error('Messages must contain user or assistant text.');
    n += m.content.length;
    if (n > 120000) throw new Error('The conversation is too long for this prototype.');
    return { role:m.role, content:m.content };
  });
  if (safe[safe.length-1].role!=='user') throw new Error('The final message must be from the user.');
  return safe;
}
export function safeError(error) {
  if (!error || typeof error !== 'object') return 'The request could not be completed.';
  // Official SIWC errors are intended to be safe for display; arbitrary runtime/SDK errors aren't.
  const safe = ['sign_in_required','sharing_not_enabled','refresh_not_ready','network_error','cancelled','invalid_config','invalid_request','invalid_model_catalog','response_incomplete','stream_interrupted','storage_error','storage_encryption_unavailable','callback_port_unavailable','revocation_failed','invalid_grant','registration_incomplete','invalid_id_token','identity_verification_unavailable'];
  if (safe.includes(error.code) && typeof error.message==='string') return error.message.slice(0,450);
  return 'The local bridge could not complete this request. See the terminal for a non-secret error code.';
}
export function checkPair(received, expected) {
  // Pairing tokens are random and compared without string shortcut timing leaks.
  if(typeof received!=='string' || typeof expected!=='string' || received.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(received),Buffer.from(expected));
}
import { timingSafeEqual } from 'node:crypto';
