import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCronAuthorized } from './cronAuth.js';

const req = (auth) => ({ headers: { get: (h) => (h === 'authorization' ? auth : null) } });

test('csak a pontos kulccsal enged át, kulcs nélkül soha', () => {
  assert.equal(isCronAuthorized(req('Bearer titok123'), 'titok123'), true);
  assert.equal(isCronAuthorized(req('Bearer titok12'), 'titok123'), false);
  assert.equal(isCronAuthorized(req('titok123'), 'titok123'), false);
  assert.equal(isCronAuthorized(req(null), 'titok123'), false);
  assert.equal(isCronAuthorized(req('Bearer '), ''), false);
  assert.equal(isCronAuthorized(req('Bearer undefined'), undefined), false);
});
