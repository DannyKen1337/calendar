// Eldobott húszoldalú kocka (D20) a betöltő képernyőkhöz: valódi 3D ikozaéder vásznon (canvas), függőség nélkül.
// Egy dobás: oldalról berepül, pattog (egyre kisebbeket), közben több tengely körül bukfencezik és lassul, végül egy
// véletlen (1–20) lapjával felfelé megáll; kis szünet után a másik oldalról újra. A lapokon a számok (szemközti lapok
// összege 21). Ha 20-ast dob („natural 20”): arany szikraeső és fénygyűrű (a felirat a hívó dolga: onResult).
// createDice(canvas, { reduced, font, pick, onResult, onThrow, onSettled }) → stop(). Csökkentett mozgásnál egy álló kép.
// onSettled: a dobás „befejeződött” (megállt, és a szám / az ünneplés egy kicsit látszott): ekkor tűnhet el a betöltő.
const PHI = (1 + Math.sqrt(5)) / 2;
const GOLD = [229, 177, 93];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const mul = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const mmul = (a, b) => a.map(row => [0, 1, 2].map(j => row[0] * b[0][j] + row[1] * b[1][j] + row[2] * b[2][j]));
// forgatás tengely körül (Rodrigues)
function axisAngle(axis, ang) {
  const [x, y, z] = norm(axis); const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}

// Az ikozaéder: 12 csúcs, 20 lap (az élhossz 2: azok a hármasok, amelyek páronként 2 távolságra vannak)
function buildIcosahedron() {
  const v = [];
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) v.push([0, a, b], [a, b, 0], [b, 0, a]);
  const close = (i, j) => Math.abs(Math.hypot(...sub(v[i], v[j])) - 2) < 1e-6;
  const faces = [];
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
    if (!(close(i, j) && close(j, k) && close(i, k))) continue;
    let f = [i, j, k];
    const c = scale([0, 1, 2].reduce((s, n) => [s[0] + v[f[n]][0], s[1] + v[f[n]][1], s[2] + v[f[n]][2]], [0, 0, 0]), 1 / 3);
    if (dot(cross(sub(v[f[1]], v[f[0]]), sub(v[f[2]], v[f[0]])), c) < 0) f = [i, k, j]; // kifelé néző normális
    const n = norm(c);
    // a lap saját síkja: „fel” az első csúcs felé, „jobbra” arra merőlegesen (a szám így áll egyenesen)
    const up = norm(sub(v[f[0]], c));
    faces.push({ idx: f, c, n, up, right: cross(up, n) });
  }
  // számozás: szemközti lapok összege 21
  const used = new Set(); let next = 20;
  faces.forEach((f, i) => {
    if (used.has(i)) return;
    const j = faces.findIndex((g, gi) => !used.has(gi) && gi !== i && dot(g.n, f.n) < -0.999);
    f.num = next; faces[j].num = 21 - next; used.add(i); used.add(j); next--;
  });
  return { v, faces };
}

const { v: VERTS, faces: FACES } = buildIcosahedron();
// A végső helyzet egy laphoz: a lap a néző felé, a szám egyenesen (sorok: a lap jobbra / fel / normális iránya)
const finalFor = (num) => { const f = FACES.find(x => x.num === num); return [f.right, f.up, f.n]; };
const LIGHT = norm([-0.45, 0.6, 1]);
const CIRC = Math.hypot(1, PHI); // a csúcsok távolsága a középponttól: r ennyivel osztva a kocka „sugara” pontosan r

function drawDie(ctx, cx, cy, r, m, font, glow = 0) {
  const k = r / CIRC;
  const P = (p) => { const q = mul(m, p); return [cx + q[0] * k, cy - q[1] * k]; };
  let top = null; let topZ = -1;
  for (const f of FACES) {
    const n = mul(m, f.n);
    if (n[2] > topZ) { topZ = n[2]; top = f.num; }
    if (n[2] <= 0.02) continue; // hátsó lap
    const light = Math.min(1, 0.28 + 0.72 * Math.max(0, dot(n, LIGHT)) + glow * 0.25);
    const pts = f.idx.map(i => P(VERTS[i]));
    ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.lineTo(...pts[1]); ctx.lineTo(...pts[2]); ctx.closePath();
    const base = [34 + 70 * light, 25 + 50 * light, 27 + 24 * light];
    ctx.fillStyle = `rgb(${base.map(Math.round).join(',')})`;
    ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.strokeStyle = `rgba(${GOLD.join(',')},${0.45 + 0.55 * light})`;
    ctx.stroke();
    // a szám a lap síkjában (affin vetítés: a lap saját jobbra / fel iránya a képernyőn)
    if (n[2] > 0.25) {
      const o = P(f.c), a = sub([...P([f.c[0] + f.right[0], f.c[1] + f.right[1], f.c[2] + f.right[2]]), 0], [...o, 0]);
      const b = sub([...P([f.c[0] + f.up[0], f.c[1] + f.up[1], f.c[2] + f.up[2]]), 0], [...o, 0]);
      ctx.save();
      ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([a[0] / k, a[1] / k, -b[0] / k, -b[1] / k, o[0], o[1]])));
      ctx.fillStyle = `rgba(${GOLD.join(',')},${n[2] > 0.97 ? 1 : 0.35 + 0.6 * light})`;
      ctx.font = `700 ${k * 0.62}px ${font}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f.num === 6 || f.num === 9 ? `${f.num}.` : String(f.num), 0, k * 0.04);
      ctx.restore();
    }
  }
  return top;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const rollD20 = () => 1 + Math.floor(Math.random() * 20);

// font: a számok betűcsaládja (a Next a Cinzelt generált néven tölti be: a --font-cinzel változó értéke)
// pick: a következő dobás eredménye (alapból véletlen 1–20); onResult(n): megállt a kocka; onThrow(): új dobás indul
export function createDice(canvas, { reduced = false, font = 'Cinzel, Georgia, serif', pick = rollD20, onResult, onThrow, onSettled } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  let raf = 0; let stopped = false;
  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 260, h = canvas.clientHeight || 130;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  };
  const radius = (h) => Math.min(h * 0.24, 40);
  const groundOf = (h, r) => h - r * 0.95 - 6;

  // egy dobás: honnan jön, milyen tengely körül bukfencezik, mennyit fordul, mit dob
  let throwNo = 0; let start = 0; let plan = null;
  const FLIGHT = 1.3; // a dobás (berepülés, pattogás) ideje
  const SETTLE = 0.45, SETTLE_CRIT = 1.7; // megállás után ennyi ideig látszik a szám / az ünneplés, mielőtt a betöltő eltűnhet
  const newThrow = (t) => {
    const side = throwNo++ % 2 === 0 ? -1 : 1;
    let axis; do { axis = norm([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1]); } while (Math.abs(axis[2]) > 0.55);
    const axis2 = norm(cross(axis, [0, 0, 1]));
    const result = Math.min(20, Math.max(1, Math.round(Number(pick()) || rollD20())));
    plan = { side, axis, axis2, turns: 2.6 + Math.random() * 1.2, wobble: 0.5 + Math.random() * 0.5, result, final: finalFor(result), hold: result === 20 ? 2.2 : 0.9, landed: false, settled: false, sparks: [] };
    start = t;
    onThrow?.();
  };

  const frame = (now) => {
    if (stopped) return;
    const t = now / 1000;
    if (!plan || t - start > FLIGHT + plan.hold) newThrow(t);
    const { w, h } = size();
    const r = radius(h);
    const ground = groundOf(h, r);
    const e = t - start; const p = Math.min(1, e / FLIGHT);

    // vízszintesen: oldalról középre, lassulva
    const x = w / 2 + plan.side * (w / 2 + r) * (1 - easeOut(p));
    // függőlegesen: egy leeső ív, utána három egyre kisebb pattanás
    const arcs = [0.38, 0.27, 0.19, 0.13]; const heights = [h * 0.4, h * 0.2, h * 0.09, h * 0.03];
    let y = ground; let acc = 0;
    for (let k = 0; k < arcs.length; k++) {
      const d = arcs[k] * FLIGHT;
      if (e < acc + d) {
        const s = (e - acc) / d;
        y = ground - heights[k] * (k === 0 ? 1 - s * s : 4 * s * (1 - s));
        break;
      }
      acc += d;
    }
    // forgás: két tengely körül, a végére megáll a kidobott számon
    const left = 1 - easeOut(Math.min(1, e / (FLIGHT * 0.95)));
    const rot = mmul(plan.final, mmul(axisAngle(plan.axis, left * plan.turns * Math.PI * 2), axisAngle(plan.axis2, left * plan.wobble * Math.PI)));

    // megállt: eredmény, és 20-asnál szikraeső
    if (!plan.landed && e >= FLIGHT) {
      plan.landed = true;
      if (plan.result === 20) {
        for (let i = 0; i < 46; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
          const v = 70 + Math.random() * 150;
          plan.sparks.push({ x: w / 2, y: ground - r * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: t, life: 0.8 + Math.random() * 0.8, size: 1.5 + Math.random() * 2.5, cream: Math.random() < 0.35 });
        }
      }
      onResult?.(plan.result);
    }
    const sinceLand = plan.landed ? t - start - FLIGHT : 0;
    if (plan.landed && !plan.settled && sinceLand >= (plan.result === 20 ? SETTLE_CRIT : SETTLE)) { plan.settled = true; onSettled?.(plan.result); }
    const crit = plan.result === 20 && plan.landed;

    ctx.clearRect(0, 0, w, h);
    // 20-as: táguló fénygyűrű a kocka mögött
    if (crit && sinceLand < 1.2) {
      const q = sinceLand / 1.2;
      ctx.beginPath();
      ctx.arc(w / 2, y, r * (1 + q * 1.8), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${GOLD.join(',')},${0.7 * (1 - q)})`;
      ctx.lineWidth = 3 * (1 - q) + 1;
      ctx.stroke();
    }
    // árnyék: magasabban kisebb és halványabb
    const lift = Math.max(0, ground - y) / (h * 0.4);
    ctx.beginPath();
    ctx.ellipse(x, ground + r * 0.92, r * (0.95 - 0.45 * lift), r * (0.22 - 0.1 * lift), 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,0,0,${0.5 - 0.3 * lift})`;
    ctx.fill();
    // 20-as: a kocka megemelkedik és felragyog
    const pop = crit ? Math.sin(Math.min(1, sinceLand / 0.5) * Math.PI) : 0;
    drawDie(ctx, x, y - pop * r * 0.35, r * (1 + pop * 0.12), rot, font, crit ? Math.max(0, 1 - sinceLand / 1.6) : 0);
    // szikrák
    for (const sp of plan.sparks) {
      const age = t - sp.born; if (age > sp.life) continue;
      const fade = 1 - age / sp.life;
      const px = sp.x + sp.vx * age, py = sp.y + sp.vy * age + 160 * age * age;
      ctx.beginPath(); ctx.arc(px, py, sp.size * fade + 0.4, 0, Math.PI * 2);
      ctx.fillStyle = sp.cream ? `rgba(255,240,210,${fade})` : `rgba(${GOLD.join(',')},${fade})`;
      ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  };

  if (reduced) {
    const { w, h } = size();
    const r = radius(h);
    const result = Math.min(20, Math.max(1, Math.round(Number(pick()) || rollD20())));
    ctx.clearRect(0, 0, w, h);
    drawDie(ctx, w / 2, groundOf(h, r), r, finalFor(result), font);
    onResult?.(result);
    onSettled?.(result);
    return () => {};
  }
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); };
}

// a teszthez: a geometria ellenőrzése, és hogy a végső helyzetben a kidobott szám néz felfelé
export const D20_FACES = FACES.map(f => ({ num: f.num, n: f.n }));
export function topFaceFor(num) {
  const m = finalFor(num); let best = null; let z = -2;
  for (const f of FACES) { const n = mul(m, f.n); if (n[2] > z) { z = n[2]; best = f.num; } }
  return best;
}
