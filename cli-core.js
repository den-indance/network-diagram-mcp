import { getInstaller, SUPPORTED_SCHEMES } from "./installers/index.js";
import { PROTOCOLS } from "./http-handler.js";
import { getOrCreateToken } from "./token.js";

export const SUBCOMMANDS = ["install", "uninstall", "list", "detect", "serve"];

export function isSubcommand(s) {
  return SUBCOMMANDS.includes(s);
}

function parseFlag(args, name) {
  const eqMatch = args.find((a) => a.startsWith(`${name}=`));
  if (eqMatch) return eqMatch.slice(name.length + 1);
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function parsePortArg(args, fallback) {
  const v = parseFlag(args, "--port");
  if (v == null) return fallback;
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return fallback;
  return n;
}

function pickSchemes(positional) {
  if (positional.includes("--all")) return SUPPORTED_SCHEMES.slice();
  const filtered = positional.filter((a) => SUPPORTED_SCHEMES.includes(a));
  return filtered;
}

export async function runCli(argv, deps = {}) {
  const stdout = deps.stdout ?? ((m) => console.log(m));
  const stderr = deps.stderr ?? ((m) => console.error(m));
  const platform = deps.platform ?? process.platform;
  const installer = deps.installer ?? getInstaller(platform);
  const installerDeps = deps.installerDeps ?? {};
  const detectDeps = deps.detectDeps ?? {};

  const [cmd, ...rest] = argv;

  if (!isSubcommand(cmd)) {
    stderr(`unknown command: ${cmd}`);
    return { exitCode: 1 };
  }

  if (cmd === "install" || cmd === "uninstall") {
    const schemes = pickSchemes(rest);
    if (schemes.length === 0) {
      stderr(`${cmd}: specify one of [${SUPPORTED_SCHEMES.join(", ")}] or --all`);
      return { exitCode: 1 };
    }
    const action = cmd === "install" ? installer.install : installer.uninstall;
    const results = [];
    for (const s of schemes) {
      try {
        const r = await action(s, installerDeps);
        results.push({ scheme: s, ...r });
      } catch (e) {
        results.push({ scheme: s, error: e.message });
      }
    }
    stdout(JSON.stringify(results, null, 2));
    const allOk = results.every((r) => !r.error);
    return { exitCode: allOk ? 0 : 1, results };
  }

  if (cmd === "list") {
    const items = [];
    for (const scheme of SUPPORTED_SCHEMES) {
      const installed = installer.isInstalled
        ? await installer.isInstalled(scheme, installerDeps)
        : null;
      items.push({ scheme, installed });
    }
    stdout(JSON.stringify({ platform, schemes: items }, null, 2));
    return { exitCode: 0 };
  }

  if (cmd === "detect") {
    const scheme = rest[0];
    if (!PROTOCOLS[scheme]) {
      stderr(
        `detect: invalid scheme "${scheme}". Use one of: ${Object.keys(PROTOCOLS).join(", ")}`
      );
      return { exitCode: 1 };
    }
    const clients = await Promise.all(
      PROTOCOLS[scheme].adapters.map(async (a) => {
        let status;
        try {
          status = await a.detect({ platform, ...detectDeps });
        } catch {
          status = { installed: false };
        }
        return {
          id: a.id,
          name: a.name,
          installed: !!status.installed,
          ...(status.path ? { path: status.path } : {}),
          ...(status.version ? { version: status.version } : {}),
        };
      })
    );
    stdout(JSON.stringify({ scheme, clients }, null, 2));
    return { exitCode: 0 };
  }

  if (cmd === "serve") {
    const port = parsePortArg(rest, 47821);
    const createBridge =
      deps.createBridge ?? (await import("./bridge.js")).createBridge;
    // Real token thunk so /exec actually works for daemon mode. Lazy —
    // catalog scanners that stat the binary without invoking /exec never
    // create the token file. Failure (no HOME write access) → null →
    // /exec returns 401. Mirrors index.js's stdio-MCP token wiring.
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
    const bridge = createBridge({ port, token: tokenThunk });
    if (bridge.ready && typeof bridge.ready.then === "function") {
      await bridge.ready.catch(() => {});
    }
    stdout(`netmap-agent: listening on :${port}`);
    // daemonize signal — index.js holds the process open via an infinite
    // promise + SIGINT/SIGTERM shutdown. Unit tests still await runCli
    // and assert {exitCode, bridge} without consuming the daemonize flag.
    return { exitCode: 0, bridge, daemonize: true };
  }

  stderr(`unreachable: ${cmd}`);
  return { exitCode: 1 };
}
