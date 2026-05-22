import { WebSocketServer } from "ws";

export const CMD_TIMEOUT_MS = 5000;

/**
 * Create a WebSocket bridge that the NetMap browser connects to.
 *
 * @param {object} opts
 * @param {number} opts.port  — port to listen on (use 0 for random in tests)
 * @param {number} [opts.timeoutMs=5000]  — per-command timeout
 * @returns {{
 *   wss: import("ws").WebSocketServer,
 *   ready: Promise<void>,
 *   sendCommand: (tool: string, params?: object, opts?: {timeoutMs?: number}) => Promise<any>,
 *   pending: Map<string, {resolve:Function, reject:Function, timer:any}>,
 *   getBrowserWs: () => any,
 *   close: () => Promise<void>,
 * }}
 */
export function createBridge({ port, timeoutMs = CMD_TIMEOUT_MS } = {}) {
  const wss = new WebSocketServer({ port });
  let browserWs = null;
  let unavailableReason = null;
  const pending = new Map();

  // Defensive: WS bind failures (EADDRINUSE etc.) and other server errors
  // must NOT crash the MCP process. Tools introspection by sandboxed registries
  // (Smithery, Claude Desktop probes) starts the server with port 47821 already
  // taken; without this handler the unhandled 'error' / rejected `ready` aborts
  // the whole stdio session before tools/list can run.
  wss.on("error", (err) => {
    if (!unavailableReason) unavailableReason = err.message || String(err);
    try { console.error(`[netmap-mcp] WebSocket bridge unavailable: ${unavailableReason}`); } catch {}
  });

  const ready = new Promise((resolve, reject) => {
    wss.once("listening", resolve);
    wss.once("error", reject);
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

    ws.on("close", () => { if (browserWs === ws) browserWs = null; });
    ws.on("error", () => { if (browserWs === ws) browserWs = null; });
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
    // Terminate any live client sockets so wss.close() resolves quickly.
    for (const client of wss.clients) client.terminate();
    return new Promise((resolve) => wss.close(() => resolve()));
  }

  return {
    wss,
    ready,
    sendCommand,
    pending,
    getBrowserWs: () => browserWs,
    close,
  };
}
