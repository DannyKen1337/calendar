import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanFullName, displayName } from './displayName.js';

test('teljes név: tisztítás és megjelenítés', () => {
  assert.equal(cleanFullName('  Kovács   Kata '), 'Kovács Kata');
  assert.equal(cleanFullName(''), '');
  assert.equal(cleanFullName(undefined), '');
  assert.equal(cleanFullName('Kata\r\nBcc: x@y.hu'), 'KataBcc: x@y.hu'); // sortörés nem maradhat (levélfejléc)
  assert.equal(cleanFullName('<b>Kata</b>'), 'bKata/b');
  assert.equal(cleanFullName('x'.repeat(81)), null);
  assert.equal(displayName({ username: 'kata99', fullName: 'Kovács Kata' }), 'Kovács Kata');
  assert.equal(displayName({ username: 'kata99', fullName: '  ' }), 'kata99');
  assert.equal(displayName({ username: 'kata99' }), 'kata99');
});
