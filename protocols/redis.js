export const SCHEME = "redis";
export const SCHEME_TLS = "rediss";
export const DEFAULT_PORT = 6379;
export const DEFAULT_DB = 0;

const ACCEPTED_PROTOCOLS = new Map([
  ["redis:", "redis"],
  ["rediss:", "rediss"],
]);

function dbFromPathname(pathname) {
  if (!pathname || pathname === "/") return { db: DEFAULT_DB };
  const seg = pathname.slice(1);
  if (!seg) return { db: DEFAULT_DB };
  const slashIdx = seg.indexOf("/");
  const raw = slashIdx === -1 ? seg : seg.slice(0, slashIdx);
  if (!/^\d+$/.test(raw)) return { error: "invalid_db" };
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 65535) return { error: "invalid_db" };
  return { db: n };
}

export function parse(input) {
  if (typeof input !== "string" || input.length === 0) {
    return { error: "invalid_input" };
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    return { error: "invalid_url" };
  }
  const normalizedScheme = ACCEPTED_PROTOCOLS.get(url.protocol);
  if (!normalizedScheme) {
    return { error: "scheme_mismatch" };
  }
  if (!url.hostname) {
    return { error: "missing_host" };
  }

  let port = DEFAULT_PORT;
  if (url.port) {
    const parsed = Number.parseInt(url.port, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      return { error: "invalid_port" };
    }
    port = parsed;
  }

  const dbResult = dbFromPathname(url.pathname);
  if (dbResult.error) return { error: dbResult.error };

  let host = url.hostname;
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  return {
    scheme: normalizedScheme,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    host,
    port,
    db: dbResult.db,
  };
}

export function format(parsed) {
  if (!parsed || typeof parsed.host !== "string" || parsed.host.length === 0) {
    throw new Error("redis.format: parsed must include non-empty host");
  }
  const scheme = parsed.scheme === SCHEME_TLS ? SCHEME_TLS : SCHEME;
  let s = `${scheme}://`;
  if (parsed.user) {
    s += encodeURIComponent(parsed.user);
    if (parsed.password) s += ":" + encodeURIComponent(parsed.password);
    s += "@";
  } else if (parsed.password) {
    s += ":" + encodeURIComponent(parsed.password) + "@";
  }
  s += parsed.host.includes(":") ? `[${parsed.host}]` : parsed.host;
  if (parsed.port && parsed.port !== DEFAULT_PORT) s += ":" + parsed.port;
  if (parsed.db !== undefined && parsed.db !== DEFAULT_DB) s += "/" + parsed.db;
  return s;
}
