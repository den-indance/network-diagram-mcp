export const SCHEME = "postgres";
export const DEFAULT_PORT = 5432;

const ACCEPTED_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

function databaseFromPathname(pathname) {
  if (!pathname || pathname === "/") return undefined;
  const seg = pathname.slice(1);
  if (!seg) return undefined;
  const slashIdx = seg.indexOf("/");
  const raw = slashIdx === -1 ? seg : seg.slice(0, slashIdx);
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
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
  if (!ACCEPTED_PROTOCOLS.has(url.protocol)) {
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

  let host = url.hostname;
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }

  return {
    scheme: SCHEME,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    host,
    port,
    database: databaseFromPathname(url.pathname),
  };
}

export function format(parsed) {
  if (!parsed || typeof parsed.host !== "string" || parsed.host.length === 0) {
    throw new Error("postgres.format: parsed must include non-empty host");
  }
  let s = "postgres://";
  if (parsed.user) {
    s += encodeURIComponent(parsed.user);
    if (parsed.password) s += ":" + encodeURIComponent(parsed.password);
    s += "@";
  }
  s += parsed.host.includes(":") ? `[${parsed.host}]` : parsed.host;
  if (parsed.port && parsed.port !== DEFAULT_PORT) s += ":" + parsed.port;
  if (parsed.database) s += "/" + encodeURIComponent(parsed.database);
  return s;
}
