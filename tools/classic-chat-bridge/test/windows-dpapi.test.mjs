import test from 'node:test';
import assert from 'node:assert/strict';
import { windowsEncryption } from '../windows-dpapi.mjs';

// An actual end-to-end protection test on Windows; never substitute plaintext.
test('DPAPI encrypts and decrypts under the current Windows account',
  { skip: process.platform !== 'win32' }, () => {
    assert.equal(windowsEncryption.isAvailable(), true, windowsEncryption.diagnostic());
    const text = 'Bridge roundtrip \u2603 \u{1F512}';
    const cipher = windowsEncryption.encrypt(text);
    assert.ok(cipher instanceof Uint8Array);
    assert.notEqual(cipher.toString('utf8'), text);
    assert.equal(windowsEncryption.decrypt(cipher), text);
  });

test('DPAPI is unavailable on non-Windows without insecure fallback',
  { skip: process.platform === 'win32' }, () => {
    assert.equal(windowsEncryption.isAvailable(), false);
  });
