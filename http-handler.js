import { spawn as nodeSpawn } from "node:child_process";

import { parse as parseSsh } from "./protocols/ssh.js";
import { parse as parsePostgres } from "./protocols/postgres.js";
import { parse as parseRedis } from "./protocols/redis.js";
import sshAdapters from "./clients/ssh/index.js";
import postgresAdapters from "./clients/postgres/index.js";
import redisAdapters from "./clients/redis/index.js";

export const PROTOCOLS = {
  ssh: { parse: parseSsh, adapters: sshAdapters },
  postgres: { parse: parsePostgres, adapters: postgresAdapters },
  redis: { parse: parseRedis, adapters: redisAdapters },
};

// Scheme aliases — secondary URL prefixes that route to the same canonical
// protocol. NOT keys in PROTOCOLS itself so Object.keys(PROTOCOLS) stays 3
// (preserves existing test + /status response shape). Caller chain:
//   detectScheme(url) → resolveScheme(s) → PROTOCOLS[canonical]
//
// rediss is significant: redis.parse() preserves it in the parsed result so
// the redis-cli adapter can emit --tls; only the *routing* needed the alias.
export const SCHEME_ALIASES = {
  postgresql: "postgres",
  rediss: "redis",
};

export function resolveScheme(scheme) {
  return SCHEME_ALIASES[scheme] ?? scheme;
}

export const DEFAULT_CORS_WHITELIST = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:5173",
  "http://map.den.dance",
  "http://map.den.dance:80",
  "https://map.den.dance",
];

export async function handleHttp(req, res, deps = {}) {
  const {
    token = null,
    corsWhitelist = DEFAULT_CORS_WHITELIST,
    spawn = nodeSpawn,
    platform = process.platform,
    detectDeps = {},
    getBrowserState = () => ({ connected: false }),
  } = deps;

  const origin = req.headers?.origin || null;
  const allowOrigin = origin && corsWhitelist.includes(origin) ? origin : null;

  if (req.method === "OPTIONS") {
    if (allowOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowOrigin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  if (allowOrigin) res.setHeader("Access-Control-Allow-Origin", allowOrigin);

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, "http://localhost");
  } catch {
    return sendJson(res, 400, { error: "invalid_url" });
  }
  const pathname = parsedUrl.pathname;

  if (req.method === "GET" && pathname === "/status") {
    return sendJson(res, 200, {
      mcp: getBrowserState(),
      protocols: Object.keys(PROTOCOLS),
    });
  }

  // Token handshake for whitelisted browser Origins. /exec requires Bearer
  // auth (token file under HOME, mode 0600) which a web page cannot read;
  // this endpoint mirrors the CORS gate already protecting /exec so the
  // local UI can fetch the token without weakening the auth model for
  // arbitrary callers. Off-whitelist Origins / no-Origin requests get 403.
  if (req.method === "GET" && pathname === "/auth/token") {
    if (!allowOrigin) {
      return sendJson(res, 403, { error: "origin_not_allowed" });
    }
    if (!token) {
      return sendJson(res, 503, { error: "token_unavailable" });
    }
    return sendJson(res, 200, { token });
  }

  if (req.method === "GET" && pathname === "/detect") {
    const scheme = parsedUrl.searchParams.get("scheme");
    const canonical = resolveScheme(scheme);
    if (!PROTOCOLS[canonical]) {
      return sendJson(res, 400, { error: "invalid_scheme" });
    }
    const clients = await Promise.all(
      PROTOCOLS[canonical].adapters.map(async (a) => {
        let status;
        try {
          status = await a.detect({ platform, ...detectDeps });
        } catch {
          status = { installed: false };
        }
        return {
          id: a.id,
          name: a.name,
          supportedOS: a.supportedOS,
          installed: !!status.installed,
          ...(status.version ? { version: status.version } : {}),
          ...(status.path ? { path: status.path } : {}),
        };
      })
    );
    return sendJson(res, 200, { clients });
  }

  if (req.method === "POST" && pathname === "/exec") {
    const provided = bearerToken(req.headers?.authorization);
    if (!token || !provided || provided !== token) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
    let body;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw);
    } catch {
      return sendJson(res, 400, { error: "invalid_json" });
    }
    const { scheme, url: targetUrl, client: clientId } = body || {};
    const canonical = resolveScheme(scheme);
    if (!PROTOCOLS[canonical]) {
      return sendJson(res, 400, { error: "invalid_scheme" });
    }
    const parsed = PROTOCOLS[canonical].parse(targetUrl);
    if (parsed.error) {
      return sendJson(res, 400, { error: parsed.error });
    }

    const adapters = PROTOCOLS[canonical].adapters;
    let adapter = null;
    if (clientId) {
      adapter = adapters.find((a) => a.id === clientId) ?? null;
      if (!adapter) return sendJson(res, 400, { error: "unknown_client" });
    } else {
      for (const a of adapters) {
        try {
          const status = await a.detect({ platform, ...detectDeps });
          if (status.installed) {
            adapter = a;
            break;
          }
        } catch {
          /* skip */
        }
      }
      if (!adapter) return sendJson(res, 404, { error: "no_client_installed" });
    }

    let cmd;
    let args;
    let env;
    try {
      const t = adapter.translate(parsed, { platform });
      cmd = t.cmd;
      args = t.args;
      env = t.env || {};
    } catch (e) {
      return sendJson(res, 400, { error: "translate_failed", message: e.message });
    }

    let pid;
    try {
      const child = spawn(cmd, args, {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, ...env },
      });
      if (typeof child.unref === "function") child.unref();
      pid = child.pid;
    } catch (e) {
      return sendJson(res, 500, { error: "spawn_failed", message: e.message });
    }

    return sendJson(res, 200, { status: "launched", pid, client: adapter.id });
  }

  return sendJson(res, 404, { error: "not_found" });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function bearerToken(authHeader) {
  if (typeof authHeader !== "string") return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
