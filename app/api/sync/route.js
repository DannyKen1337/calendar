async function fetchUVSEvents() {
  const events = [];
  const STORE_ID = "1b2d94ce-6b26-45de-b888-5ffc3106f678";

  // Format labels that appear as "name" fields in the JSON but are NOT real event titles
  const GENERIC_NAMES = new Set([
    "constructed", "limited", "sealed", "draft", "booster draft", "standard"
  ]);

  try {
    const response = await fetch(`${UVS_STORE_URL}?t=${Date.now()}`, { 
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    let html = await response.text();
    let cleaned = html.replace(/\\/g, '');

    const nameMatches = [...cleaned.matchAll(/"name":"([^"]+)"/g)];
    const seenIds = new Set();
    const seenNameDate = new Set();

    for (const match of nameMatches) {
      const eventName = match[1];
      const lowerEventName = eventName.trim().toLowerCase();

      if (
        eventName.length < 4 ||
        eventName.includes("Tavern Club") ||
        eventName.includes("Policy") ||
        eventName === "Riftbound" ||
        GENERIC_NAMES.has(lowerEventName) // <-- skip format-name noise
      ) continue;

      const start = Math.max(0, match.index - 1500);
      const end = Math.min(cleaned.length, match.index + 1500);
      const chunk = cleaned.substring(start, end);

      if (!chunk.includes("SCHEDULED") && !chunk.includes("ACCEPTING_SIGNUPS") && !chunk.includes("Debrecen") && !chunk.includes("Kossuth")) {
        continue;
      }

      const dateRegex = /"(202[4-9]-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}[^"]*)"/g;
      let dateMatch;
      let validDate = null;
      
      while ((dateMatch = dateRegex.exec(chunk)) !== null) {
        const dStr = dateMatch[1];
        if (!dStr.includes("2025-10-31") && !dStr.includes("2027-01-01") && !dStr.includes("2026-12-01")) {
          validDate = dStr;
          break; 
        }
      }

      if (!validDate) continue;

      const idRegex = /"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})"/g;
      let idMatch;
      let validId = null;
      
      while ((idMatch = idRegex.exec(chunk)) !== null) {
        const idStr = idMatch[1];
        if (idStr !== STORE_ID && idStr !== "cc8902bc-dba3-4435-aab2-e9e812482166" && idStr !== "c9b1ea79-ee44-440c-a70c-60dea20470ed") {
          validId = idStr;
          break; 
        }
      }

      // De-dupe: prefer ID (the true unique key). Fall back to name+date only if no ID found.
      const dedupeKey = validId ? `id:${validId}` : `nd:${eventName}|${validDate}`;
      if (validId) {
        if (seenIds.has(validId)) continue;
        seenIds.add(validId);
      } else {
        if (seenNameDate.has(dedupeKey)) continue;
        seenNameDate.add(dedupeKey);
      }

      events.push({
        id: validId,
        name: eventName,
        date: validDate,
        url: validId ? `https://locator.riftbound.uvsgames.com/events/${validId}` : UVS_STORE_URL
      });
    }
  } catch (error) {
  }
  return events;
}