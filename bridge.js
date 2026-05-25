import http from "node:http";
import { WebSocketServer } from "ws";
import { handleHttp } from "./http-handler.js";

export const CMD_TIMEOUT_MS = 5000;

/**
 * Create a bridge that:
 *   1. Serves the WS protocol the NetMap browser uses (existing tools API)
 *   2. Serves the HTTP endpoints used by the agent-bundle URL handlers
 *      (/status, /detect, /exec) — see http-handler.js
 *
 * Both share the same http.Server on the same port.
 *
 * @param {object} opts
 * @param {number} opts.port
 * @param {number} [opts.timeoutMs=5000]
 * @param {string | (() => string|null) | null} [opts.token=null] — string,
 *   thunk (called lazily on first /exec, allows catalog scanners to introspect
 *   without HOME write access), or null (disables /exec auth → all 401)
 * @param {string[]} [opts.corsWhitelist] — overrides DEFAULT_CORS_WHITELIST
 * @param {Function} [opts.spawn] — for tests, override child_process.spawn
 * @param {string} [opts.platform] — for tests, override process.platform
 * @param {object} [opts.detectDeps] — passed to adapter.detect() (e.g. mocked exec/fs)
 */
export function createBridge({
  port,
  timeoutMs = CMD_TIMEOUT_MS,
  token = null,
  corsWhitelist,
  spawn,
  platform,
  detectDeps,
} = {}) {
  let browserWs = null;
  let unavailableReason = null;
  const pending = new Map();

  const httpServer = http.createServer(async (req, res) => {
    let resolvedToken = token;
    if (typeof resolvedToken === "function") {
      try {
        resolvedToken = resolvedToken();
      } catch {
        resolvedToken = null;
      }
    }
    await handleHttp(req, res, {
      token: resolvedToken,
      corsWhitelist,
      spawn,
      platform,
      detectDeps,
      getBrowserState: () => ({ connected: browserWs !== null }),
    });
  });

  const wss = new WebSocketServer({ server: httpServer });

  // Defensive: bind failures (EADDRINUSE etc.) and other server errors
  // must NOT crash the MCP process. Tools introspection by sandboxed registries
  // (Smithery, Claude Desktop probes) starts the server with port 47821 already
  // taken; without this handler the unhandled 'error' / rejected `ready` aborts
  // the whole stdio session before tools/list can run.
  const onError = (err) => {
    if (!unavailableReason) unavailableReason = err.message || String(err);
    try {
      console.error(`[netmap-mcp] bridge unavailable: ${unavailableReason}`);
    } catch {}
  };
  httpServer.on("error", onError);
  wss.on("error", onError);

  const ready = new Promise((resolve, reject) => {
    httpServer.once("listening", resolve);
    httpServer.once("error", reject);
  });
  // No-op catch so callers that don't await `ready` (production index.js)
  // don't trip Node's unhandledRejection-is-fatal default. Tests that DO
  // await ready still see the rejection.
  ready.catch(() => {});

  wss.on("connection", (ws) => {
    browserWs = ws;

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const p = pending.get(msg.id);
        if (!p) return;
        clearTimeout(p.timer);
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg.result);
      } catch {}
    });

    ws.on("close", () => {
      if (browserWs === ws) browserWs = null;
    });
    ws.on("error", () => {
      if (browserWs === ws) browserWs = null;
    });
  });

  function sendCommand(tool, params = {}, opts = {}) {
    const effective = opts.timeoutMs ?? timeoutMs;
    return new Promise((resolve, reject) => {
      if (unavailableReason) {
        reject(new Error(`WebSocket bridge unavailable: ${unavailableReason}`));
        return;
      }
      if (!browserWs || browserWs.readyState !== 1 /* OPEN */) {
        reject(new Error("NetMap browser not connected"));
        return;
      }
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Timeout: browser did not respond in ${Math.round(effective / 1000)}s`));
      }, effective);
      pending.set(id, { resolve, reject, timer });
      browserWs.send(JSON.stringify({ id, tool, params }));
    });
  }

  function close() {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Bridge closed"));
    }
    pending.clear();
    for (const client of wss.clients) client.terminate();
    return new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
  }

  httpServer.listen(port);

  return {
    wss,
    server: httpServer,
    ready,
    sendCommand,
    pending,
    getBrowserWs: () => browserWs,
    close,
  };
}
