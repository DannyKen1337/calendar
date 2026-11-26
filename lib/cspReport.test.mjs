import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCspReports } from './cspReport.js';

test('régi formátum (report-uri)', () => {
  const r = parseCspReports(JSON.stringify({ 'csp-report': { 'document-uri': 'https://x.hu/leiratkozas?token=titok', 'effective-directive': 'script-src-elem', 'blocked-uri': 'inline', 'line-number': 3 } }));
  assert.deepEqual(r, [{ directive: 'script-src-elem', blocked: 'inline', page: '/leiratkozas', source: '', line: 3, sample: '', disposition: '' }]);
});

test('új formátum (Reporting API), a címből csak az útvonal marad', () => {
  const r = parseCspReports(JSON.stringify([
    { type: 'csp-violation', body: { documentURL: 'https://x.hu/esemeny/1', effectiveDirective: 'script-src-elem', blockedURL: 'https://gonosz.example/a.js?x=1', disposition: 'enforce' } },
    { type: 'deprecation', body: {} },
  ]));
  assert.equal(r.length, 1);
  assert.equal(r[0].blocked, 'https://gonosz.example/a.js');
  assert.equal(r[0].page, '/esemeny/1');
});

test('bővítmények és hibás adat kimarad', () => {
  assert.deepEqual(parseCspReports(JSON.stringify({ 'csp-report': { 'effective-directive': 'script-src', 'blocked-uri': 'chrome-extension://abc' } })), []);
  assert.deepEqual(parseCspReports('nem json'), []);
  assert.deepEqual(parseCspReports(JSON.stringify({ valami: 1 })), []);
});
