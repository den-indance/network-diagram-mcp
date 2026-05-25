import { spawn as nodeSpawn } from "node:child_process";
import { PROTOCOLS, resolveScheme } from "./http-handler.js";
import { wrapInTerminal } from "./utils/terminal-wrap.js";
import { notifyUser } from "./utils/notify.js";
import { appendLog } from "./utils/log.js";

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/;

export function detectScheme(url) {
  if (typeof url !== "string") return null;
  const m = SCHEME_RE.exec(url);
  return m ? m[1] : null;
}

/**
 * Standalone protocol-handler entry. Invoked by the OS when the user clicks
 * an ssh://, postgres://, or redis:// link (the .desktop / .app / registry
 * registration written by Phase 4 installers points here).
 *
 * Does NOT depend on the running daemon — parses + spawns inline.
 *
 * @returns Promise<{exitCode: number, pid?: number, error?: string}>
 */
export async function runHandler(argv, deps = {}) {
  const spawn = deps.spawn ?? nodeSpawn;
  const platform = deps.platform ?? process.platform;
  const detectDeps = deps.detectDeps ?? {};
  const stderr = deps.stderr ?? ((m) => console.error(m));
  // Log file gives post-mortem visibility when .desktop / .app / HKCU
  // chains discard stderr and notifications get auto-dismissed. Best-effort.
  const log = deps.log ?? appendLog;
  try { log(`runHandler argv=${JSON.stringify(argv)} platform=${platform}`); } catch {}

  const url = argv[0];
  if (!url) {
    stderr("usage: handler.js <url>");
    return { exitCode: 2, error: "missing_url" };
  }

  const scheme = detectScheme(url);
  const canonical = scheme ? resolveScheme(scheme) : null;
  if (!canonical || !PROTOCOLS[canonical]) {
    stderr(`unsupported scheme in URL: ${url}`);
    return { exitCode: 3, error: "unsupported_scheme" };
  }

  const parsed = PROTOCOLS[canonical].parse(url);
  if (parsed.error) {
    stderr(`invalid URL (${parsed.error}): ${url}`);
    return { exitCode: 4, error: parsed.error };
  }

  let adapter = null;
  for (const a of PROTOCOLS[canonical].adapters) {
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
  if (!adapter) {
    stderr(`no ${canonical} client installed`);
    // Native notification — without this the .desktop/.app/HKCU-spawned
    // process exits to /dev/null and the user sees nothing. notifyUser
    // is best-effort (returns false if notify-send / osascript / PowerShell
    // unavailable); failure stays silent, exit code is the contract.
    const installables = (PROTOCOLS[canonical]?.adapters ?? [])
      .map((a) => a.name)
      .join(", ");
    try {
      const notify = deps.notify ?? notifyUser;
      notify({
        title: `NetMap — no ${canonical} client installed`,
        message: `Install one of: ${installables}`,
        platform,
      });
    } catch {
      /* notification is bonus UX, never propagate */
    }
    try { log(`no_client_installed scheme=${canonical} adapters=[${installables}]`); } catch {}
    return { exitCode: 5, error: "no_client_installed" };
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
    stderr(`translate failed: ${e.message}`);
    return { exitCode: 6, error: "translate_failed" };
  }

  // CLI clients (psql, redis-cli) opt-in via adapter.requiresTerminal so the
  // interactive session is VISIBLE — without the wrap, OS-spawn'd CLI tools
  // run detached with stdio:"ignore" and exit invisibly. GUI clients
  // (tableplus, dbeaver, …) handle their own windowing and don't set the flag.
  if (adapter.requiresTerminal) {
    const wrap = deps.wrapInTerminal ?? wrapInTerminal;
    const wrapped = wrap({ cmd, args, platform, env: deps.env });
    if (wrapped) {
      cmd = wrapped.cmd;
      args = wrapped.args;
      env = { ...env, ...(wrapped.env || {}) };
    }
    // null result → no terminal found → fall through to bare spawn (silent
    // but at least we tried). User can install a terminal or set $TERMINAL.
  }

  let child;
  try {
    child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ...env },
    });
    if (typeof child.unref === "function") child.unref();
  } catch (e) {
    stderr(`spawn failed: ${e.message}`);
    try { log(`spawn_failed adapter=${adapter.id} cmd=${cmd} args=${JSON.stringify(args)} err=${e.message}`); } catch {}
    return { exitCode: 7, error: "spawn_failed" };
  }

  try { log(`spawned adapter=${adapter.id} cmd=${cmd} args=${JSON.stringify(args)} pid=${child.pid}`); } catch {}
  return { exitCode: 0, pid: child.pid, client: adapter.id };
}
