import "server-only";
import fs from "fs";
import path from "path";

/**
 * Shared-state store.
 * - Production: Upstash Redis over its REST API (works on Vercel serverless).
 * - Development only: a JSON file on disk, so four browsers on one machine/LAN can be tested
 *   without credentials. Never used on Vercel unless MT_DEV_FILE_STORE=1 is set explicitly.
 */

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

export type Backend = "redis" | "dev-file" | "none";
export const backend: Backend =
  URL_ && TOKEN ? "redis" : process.env.NODE_ENV !== "production" || process.env.MT_DEV_FILE_STORE === "1" ? "dev-file" : "none";

export class ConfigError extends Error {}

const CAS_LUA = `
local cur = redis.call('GET', KEYS[1])
if cur then
  local ok, obj = pcall(cjson.decode, cur)
  if (not ok) or tonumber(obj.v) ~= tonumber(ARGV[1]) then return 0 end
elseif tonumber(ARGV[1]) ~= -1 then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
return 1`;

async function redis<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error("Redis error: " + (j.error || r.status));
  return j.result as T;
}

// ---------- dev file store ----------
const FILE = path.join(process.cwd(), ".data", "store.json");
type FileDB = { kv: Record<string, { value: string; exp: number }>; h: Record<string, Record<string, string>> };
function load(): FileDB {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { kv: {}, h: {} };
  }
}
function save(db: FileDB) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
}
function fileGet(db: FileDB, key: string) {
  const e = db.kv[key];
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) return null;
  return e.value;
}

function ensure() {
  if (backend === "none") throw new ConfigError("Shared room backend is not configured. Add Upstash Redis credentials (see README).");
}

export const kv = {
  async get(key: string): Promise<string | null> {
    ensure();
    if (backend === "redis") return redis<string | null>(["GET", key]);
    return fileGet(load(), key);
  },
  /** Atomic compare-and-set on the JSON field `v`. expected = -1 means "must not exist". */
  async cas(key: string, expected: number, value: string, ttlSec: number): Promise<boolean> {
    ensure();
    if (backend === "redis") return (await redis<number>(["EVAL", CAS_LUA, 1, key, expected, value, ttlSec])) === 1;
    // Sync read-modify-write: atomic within the single dev server process.
    const db = load();
    const cur = fileGet(db, key);
    if (cur) {
      if (JSON.parse(cur).v !== expected) return false;
    } else if (expected !== -1) return false;
    db.kv[key] = { value, exp: Date.now() + ttlSec * 1000 };
    save(db);
    return true;
  },
  async set(key: string, value: string, ttlSec: number) {
    ensure();
    if (backend === "redis") return void (await redis(["SET", key, value, "EX", ttlSec]));
    const db = load();
    db.kv[key] = { value, exp: Date.now() + ttlSec * 1000 };
    save(db);
  },
  async del(key: string) {
    ensure();
    if (backend === "redis") return void (await redis(["DEL", key]));
    const db = load();
    delete db.kv[key];
    save(db);
  },
  async hset(key: string, field: string, value: string, ttlSec: number) {
    ensure();
    if (backend === "redis") {
      await redis(["HSET", key, field, value]);
      await redis(["EXPIRE", key, ttlSec]);
      return;
    }
    const db = load();
    (db.h[key] ||= {})[field] = value;
    save(db);
  },
  async hgetall(key: string): Promise<Record<string, string>> {
    ensure();
    if (backend === "redis") {
      const arr = (await redis<string[] | null>(["HGETALL", key])) || [];
      const o: Record<string, string> = {};
      for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
      return o;
    }
    return load().h[key] || {};
  },
};
