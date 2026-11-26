// A böngészők CSP-jelentéseinek feldolgozása (/api/csp-report). Kétféle formátum jöhet:
// - régi (report-uri): { "csp-report": { "document-uri", "violated-directive", "blocked-uri", ... } }
// - új (Reporting API): [{ type: "csp-violation", body: { documentURL, effectiveDirective, blockedURL, ... } }]
// A bővítmények (chrome-extension:// stb.) által okozott jelentések kimaradnak: azokhoz nincs közünk.
const EXTENSION = /^(chrome|moz|safari-web|ms-browser)-extension:/i;
const clip = (v, n) => String(v ?? '').slice(0, n);

// A címből csak az útvonal marad (a lekérdezésben lehet személyes adat, pl. leiratkozási token)
function pathOf(url) {
  try { return new URL(url).pathname; } catch { return clip(url, 200); }
}

export function parseCspReports(text) {
  let data;
  try { data = JSON.parse(text); } catch { return []; }
  const raw = Array.isArray(data)
    ? data.filter(r => r?.type === 'csp-violation').map(r => r.body || {})
    : data?.['csp-report'] ? [data['csp-report']] : [];
  return raw.map(r => {
    const blocked = clip(r.blockedURL ?? r['blocked-uri'], 300);
    const source = clip(r.sourceFile ?? r['source-file'], 300);
    return {
      directive: clip(r.effectiveDirective ?? r['effective-directive'] ?? r['violated-directive'], 60),
      blocked: /^https?:/i.test(blocked) ? `${(() => { try { const u = new URL(blocked); return u.origin + u.pathname; } catch { return blocked; } })()}` : blocked || 'inline',
      page: pathOf(r.documentURL ?? r['document-uri']),
      source: source && !EXTENSION.test(source) ? pathOf(source) : '',
      line: Number(r.lineNumber ?? r['line-number']) || null,
      sample: clip(r.sample ?? r['script-sample'], 80),
      disposition: clip(r.disposition, 20),
      fromExtension: EXTENSION.test(blocked) || EXTENSION.test(source),
    };
  }).filter(r => r.directive && !r.fromExtension).map(r => { delete r.fromExtension; return r; });
}
