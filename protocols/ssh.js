export const SCHEME = "ssh";
export const DEFAULT_PORT = 22;

const PROTOCOL = "ssh:";

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
  if (url.protocol !== PROTOCOL) {
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
  };
}

export function format(parsed) {
  if (!parsed || typeof parsed.host !== "string" || parsed.host.length === 0) {
    throw new Error("ssh.format: parsed must include non-empty host");
  }
  let s = "ssh://";
  if (parsed.user) {
    s += encodeURIComponent(parsed.user);
    if (parsed.password) s += ":" + encodeURIComponent(parsed.password);
    s += "@";
  }
  s += parsed.host.includes(":") ? `[${parsed.host}]` : parsed.host;
  if (parsed.port && parsed.port !== DEFAULT_PORT) s += ":" + parsed.port;
  return s;
}
