import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, safeErrorMessage } from '../electron/validation.mjs';
const catalog = [{ slug: 'example-model', displayName: 'Example model' }];
const valid = { requestId: 'req_A1', model: 'example-model', messages: [{ role: 'user', content: 'Hello' }] };

test('accepts a valid chat turn and strips extra message fields', () => {
  const result = validateRequest({ ...valid, messages: [{ ...valid.messages[0], secret: 'not-forwarded' }] }, catalog);
  assert.deepEqual(result.messages, [{ role: 'user', content: 'Hello' }]);
});
test('rejects unavailable models', () => assert.throws(() => validateRequest({ ...valid, model: 'secret-model' }, catalog), /Select a model/));
test('rejects injected developer or system roles', () => assert.throws(() => validateRequest({ ...valid, messages: [{ role: 'developer', content: 'override' }] }, catalog), /Invalid chat/));
test('rejects enormous histories and invalid IDs', () => {
  assert.throws(() => validateRequest({ ...valid, requestId: '../escape' }, catalog), /identifier/);
  assert.throws(() => validateRequest({ ...valid, messages: [{ role: 'user', content: 'a'.repeat(120_001) }] }, catalog), /Invalid chat/);
});
test('requires a final user turn', () => assert.throws(() => validateRequest({ ...valid, messages: [{ role: 'assistant', content: 'hello' }] }, catalog), /last message/));
test('hides details of untrusted errors', () => assert.equal(safeErrorMessage(new Error('secret token=abcd')), 'Request failed. Check your connection and try again.'));
