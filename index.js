#!/usr/bin/env node
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createBridge as defaultCreateBridge } from "./bridge.js";
import { handleListTools, handleCallTool } from "./handlers.js";
import { getOrCreateToken } from "./token.js";
import { isSubcommand, runCli } from "./cli-core.js";

/**
 * Entry-point logic factored out so unit tests can import + invoke directly
 * (giving v8 coverage of this module). When called as the actual CLI entry
 * the `if (isInvokedAsScript())` block below handles process.exit / signal
 * handlers / infinite-pending block — runEntry itself stays test-friendly
 * (no process.exit, returns a `{mode, ...}` descriptor).
 *
 * @param {string[]} argv  — typically process.argv
 * @param {object} [deps]  — injection seam
 *   - cliDeps: passed-through to runCli (stdout/stderr/createBridge/...)
 *   - createBridge: stdio-MCP createBridge factory (default: ./bridge.js)
 *   - Server, Transport: MCP SDK constructors (default: real SDK)
 *   - tokenThunk: override token resolution
 *   - port: override NETMAP_MCP_PORT
 *   - skipTransportConnect: stdio path returns before await server.connect()
 *     so tests don't hang on stdin
 * @returns {Promise<{mode: "subcommand"|"daemon"|"stdio-mcp", ...}>}
 */
export async function runEntry(argv = process.argv, deps = {}) {
  const sub = argv[2];
  if (isSubcommand(sub)) {
    const result = await runCli(argv.slice(2), deps.cliDeps ?? {});
    if (result?.daemonize) {
      return { mode: "daemon", bridge: result.bridge, exitCode: 0 };
    }
    return { mode: "subcommand", exitCode: result.exitCode ?? 0 };
  }

  // Default stdio MCP path — back-compat for `npx @den.dance/network-diagram-mcp`
  const port = deps.port ?? parseInt(process.env.NETMAP_MCP_PORT || "47821", 10);

  // Token is created lazily on first /exec — catalog scanners (Smithery,
  // Claude Desktop probes) introspect tools/list via stdio without HOME
  // write access; we must not trip them on startup.
  let cachedToken = null;
  const tokenThunk =
    deps.tokenThunk ??
    (() => {
      if (cachedToken !== null) return cachedToken;
      try {
        cachedToken = getOrCreateToken({});
        return cachedToken;
      } catch {
        return null;
      }
    });

  const createBridgeFn = deps.createBridge ?? defaultCreateBridge;
  const { sendCommand } = createBridgeFn({ port, token: tokenThunk });

  let pkgVersion = "unknown";
  try {
    const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
    pkgVersion = pkg.version;
  } catch {
    /* tests / unusual install layout — fall back to "unknown" */
  }

  const ServerCtor = deps.Server ?? Server;
  const server = new ServerCtor(
    { name: "netmap", version: pkgVersion },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => handleListTools());
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleCallTool(request, sendCommand),
  );

  if (deps.skipTransportConnect) {
    return { mode: "stdio-mcp", server, sendCommand };
  }

  const TransportCtor = deps.Transport ?? StdioServerTransport;
  const transport = new TransportCtor();
  await server.connect(transport);
  return { mode: "stdio-mcp", server, sendCommand };
}

/** True when this module is the script Node was launched with (not an import). */
function isInvokedAsScript() {
  try {
    if (!process.argv[1]) return false;
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isInvokedAsScript()) {
  const result = await runEntry().catch((err) => {
    try { console.error(err && err.message ? err.message : String(err)); } catch {}
    process.exit(1);
  });
  if (result?.mode === "daemon") {
    const bridge = result.bridge;
    const shutdown = async () => {
      try { if (bridge?.close) await bridge.close(); } catch {}
      process.exit(0);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    await new Promise(() => {});
  } else if (result?.mode === "subcommand") {
    process.exit(result.exitCode);
  }
  // stdio-mcp: process stays alive via stdin (Server's transport)
}
