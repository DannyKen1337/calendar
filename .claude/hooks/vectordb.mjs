#!/usr/bin/env node
// Kis helyi vektoros index a projekt tudásából (kód, jegyzetek, memória, commitok, korábbi sessionök).
// Használat:
//   node .claude/hooks/vectordb.mjs build
//   node .claude/hooks/vectordb.mjs search "hol állítom be a férőhelyet?" [találatok száma]
// Az adatbázis a repón kívül van, mert a sessionök szövegét is tartalmazza.
// A vektorok szó- és szótő-hash alapúak (TF-IDF): pontos kifejezésekre és rokon szavakra jók,
// szinonimákat viszont nem ismernek fel.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT_DIR = join(homedir(), ".claude/projects", ROOT.replace(/[^a-zA-Z0-9]/g, "-"));
const DB_DIR = join(PROJECT_DIR, "vectordb");
const DB_PATH = join(DB_DIR, "index.sqlite");

// Ritka vektorok: csak a nem nulla elemek tárolódnak, ezért a nagy tér nem foglal több helyet.
const DIMS = 2 ** 20;
const CHUNK_LINES = 40;
const CHUNK_OVERLAP = 8;
const CHUNK_CHARS = 1500;
const PREVIEW_CHARS = 240;
const MAX_FILE_BYTES = 200 * 1024;
const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json", ".md", ".css", ".html", ".webmanifest"]);
const SKIPPED_FILES = /^\.claude\/|(^|\/)(package-lock\.json|next-env\.d\.ts|\.env[^/]*)$|\.pem$/;
const INJECTED_TAGS = /<(system-reminder|ide_selection|ide_opened_file|pasted_content|command-[a-z]+|local-command-[a-z]+)\b[^>]*>[\s\S]*?<\/\1>/g;
const SECRETS = [
  [/mongodb(\+srv)?:\/\/[^\s"'`]+/g, "mongodb://[törölve]"],
  [/\b(sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g, "[törölve]"],
  [/\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY)[A-Z0-9_]*\s*[=:]\s*)\S+/g, "$1[törölve]"],
];

function redact(text) {
  return SECRETS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

// Az azonosítók egészben és szavanként is bekerülnek (SET_OCCUPANCY -> set_occupancy, set, occupancy).
// A magyar toldalékok miatt a szavak mellé az első 5 betűjük is jellemző lesz.
function features(text) {
  const identifiers = text.normalize("NFKD").replace(/\p{M}/gu, "").match(/[a-zA-Z0-9_]{2,}/g) ?? [];
  const out = [];
  for (const identifier of identifiers) {
    const words = identifier.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().split("_").filter((word) => word.length > 1);
    if (words.length > 1) out.push(identifier.toLowerCase());
    for (const word of words) {
      out.push(word);
      if (word.length > 5) out.push(`~${word.slice(0, 5)}`);
    }
  }
  return out;
}

function hash(feature) {
  let h = 0x811c9dc5;
  for (let i = 0; i < feature.length; i++) {
    h ^= feature.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function vectorize(tokens, idf, defaultIdf) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const vector = new Map();
  for (const [token, count] of counts) {
    const index = hash(token) % DIMS;
    vector.set(index, (vector.get(index) ?? 0) + (1 + Math.log(count)) * (idf[token] ?? defaultIdf));
  }
  const norm = Math.hypot(...vector.values()) || 1;
  for (const [index, value] of vector) vector.set(index, value / norm);
  return vector;
}

// Tárolás: [n darab Uint32 index][n darab Float32 érték]
function encodeVector(vector) {
  const buffer = new ArrayBuffer(vector.size * 8);
  const indexes = new Uint32Array(buffer, 0, vector.size);
  const values = new Float32Array(buffer, vector.size * 4, vector.size);
  let i = 0;
  for (const [index, value] of vector) {
    indexes[i] = index;
    values[i++] = value;
  }
  return new Uint8Array(buffer);
}

function dotProduct(blob, queryVector) {
  const size = blob.byteLength / 8;
  const bytes = blob.slice().buffer;
  const indexes = new Uint32Array(bytes, 0, size);
  const values = new Float32Array(bytes, size * 4, size);
  let score = 0;
  for (let i = 0; i < size; i++) score += values[i] * (queryVector.get(indexes[i]) ?? 0);
  return score;
}

function chunkLines(text) {
  const lines = text.split("\n");
  const chunks = [];
  for (let start = 0; start < lines.length; start += CHUNK_LINES - CHUNK_OVERLAP) {
    const end = Math.min(start + CHUNK_LINES, lines.length);
    chunks.push({ start: start + 1, end, text: lines.slice(start, end).join("\n") });
    if (end === lines.length) break;
  }
  return chunks;
}

function chunkChars(text) {
  const chunks = [];
  for (let start = 0; start < text.length; start += CHUNK_CHARS) {
    chunks.push(text.slice(start, start + CHUNK_CHARS));
  }
  return chunks;
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function repoChunks() {
  const chunks = [];
  for (const path of git("ls-files", "-co", "--exclude-standard").split("\n")) {
    if (!path || SKIPPED_FILES.test(path) || !TEXT_EXTENSIONS.has(extname(path))) continue;
    const full = join(ROOT, path);
    if (!existsSync(full) || statSync(full).size > MAX_FILE_BYTES) continue;
    for (const chunk of chunkLines(readFileSync(full, "utf8"))) {
      chunks.push({
        source: path.endsWith(".md") ? "note" : "code",
        path,
        startLine: chunk.start,
        endLine: chunk.end,
        // A kódrészletek szövege a fájlban van, ide csak előnézet kerül.
        text: chunk.text,
        stored: redact(chunk.text).slice(0, PREVIEW_CHARS),
      });
    }
  }
  return chunks;
}

function memoryChunks() {
  const dir = join(PROJECT_DIR, "memory");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const text = readFileSync(join(dir, name), "utf8");
      return { source: "memory", path: `memory/${name}`, text, stored: redact(text) };
    });
}

function commitChunks() {
  return git("log", "-300", "--format=%h %ad %s%x00", "--date=short")
    .split("\0")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({ source: "commit", path: text.split(" ")[0], text, stored: redact(text) }));
}

function messageText(entry) {
  const { content } = entry.message ?? {};
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
}

// Csak a beszélgetés szövege kerül be, az eszközök kimenete és a gondolatmenet nem.
function sessionChunks() {
  if (!existsSync(PROJECT_DIR)) return [];
  const chunks = [];
  for (const name of readdirSync(PROJECT_DIR)) {
    if (!name.endsWith(".jsonl")) continue;
    const parts = [];
    let date = "";
    for (const line of readFileSync(join(PROJECT_DIR, name), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (!["user", "assistant"].includes(entry.type) || entry.isMeta || entry.isSidechain) continue;
      const text = messageText(entry).replace(INJECTED_TAGS, "").trim();
      if (!text) continue;
      date ||= entry.timestamp?.slice(0, 10) ?? "";
      parts.push(`${entry.type === "user" ? "Felhasználó" : "Claude"}: ${text}`);
    }
    chunkChars(redact(parts.join("\n\n"))).forEach((text) => {
      chunks.push({ source: "session", path: `${date} ${name.slice(0, 8)}`, text, stored: text });
    });
  }
  return chunks;
}

function build() {
  const startedAt = Date.now();
  const chunks = [...repoChunks(), ...memoryChunks(), ...commitChunks(), ...sessionChunks()];
  const tokenized = chunks.map((chunk) => features(`${chunk.path} ${chunk.text}`));

  const documentFrequency = new Map();
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
  }
  const idf = {};
  for (const [token, count] of documentFrequency) idf[token] = Math.log((1 + chunks.length) / (1 + count)) + 1;
  const defaultIdf = Math.log(1 + chunks.length) + 1;

  mkdirSync(DB_DIR, { recursive: true });
  // Mindig teljes újraépítés ideiglenes fájlba, így a törölt fájlok is kiesnek, és a keresés sosem lát félkész indexet.
  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  const db = new DatabaseSync(tempPath);
  db.exec(`
    CREATE TABLE chunks (id INTEGER PRIMARY KEY, source TEXT, path TEXT, start_line INT, end_line INT, text TEXT, vector BLOB);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    BEGIN;
  `);
  const insert = db.prepare("INSERT INTO chunks (source, path, start_line, end_line, text, vector) VALUES (?, ?, ?, ?, ?, ?)");
  chunks.forEach((chunk, i) => {
    const vector = vectorize(tokenized[i], idf, defaultIdf);
    insert.run(chunk.source, chunk.path, chunk.startLine ?? null, chunk.endLine ?? null, chunk.stored, encodeVector(vector));
  });
  const setMeta = db.prepare("INSERT INTO meta VALUES (?, ?)");
  setMeta.run("idf", JSON.stringify(idf));
  setMeta.run("defaultIdf", String(defaultIdf));
  setMeta.run("builtAt", new Date().toISOString());
  db.exec("COMMIT");
  db.close();
  renameSync(tempPath, DB_PATH);

  const counts = {};
  for (const chunk of chunks) counts[chunk.source] = (counts[chunk.source] ?? 0) + 1;
  const sizeKb = Math.round(statSync(DB_PATH).size / 1024);
  console.log(`Index kész: ${chunks.length} részlet ${JSON.stringify(counts)}, ${sizeKb} KB, ${Date.now() - startedAt} ms -> ${DB_PATH}`);
}

function search(query, limit) {
  if (!existsSync(DB_PATH)) {
    console.error(`Még nincs index: ${DB_PATH}. Futtasd: node .claude/hooks/vectordb.mjs build`);
    process.exit(1);
  }
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const meta = Object.fromEntries(db.prepare("SELECT key, value FROM meta").all().map((row) => [row.key, row.value]));
  const queryVector = vectorize(features(query), JSON.parse(meta.idf), Number(meta.defaultIdf));

  const results = db.prepare("SELECT * FROM chunks").all().map((row) => ({ ...row, score: dotProduct(row.vector, queryVector) }));
  results.sort((a, b) => b.score - a.score);

  console.log(`Index: ${meta.builtAt}`);
  for (const row of results.slice(0, limit)) {
    const location = row.start_line ? `${row.path}:${row.start_line}-${row.end_line}` : row.path;
    console.log(`\n[${row.score.toFixed(3)}] ${row.source} ${location}\n${row.text}`);
  }
  db.close();
}

const [command, query, limit] = process.argv.slice(2);
if (command === "build") build();
else if (command === "search" && query) search(query, Number(limit) || 5);
else {
  console.error('Használat: vectordb.mjs build | vectordb.mjs search "kérdés" [találatok száma]');
  process.exit(1);
}
