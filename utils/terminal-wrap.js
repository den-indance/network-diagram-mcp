// Wrap an arbitrary CLI command in the user's terminal so the spawned
// session is VISIBLE. Without this wrap, .desktop-spawned psql/redis-cli
// run with detached + stdio:"ignore" and exit invisibly, defeating the
// whole click-to-open-shell UX (user sees nothing happen).
//
// Mirror of the ssh-adapter pattern, but generalized: any CLI tool can
// be wrapped, not just ssh. Used by adapters that set requiresTerminal:true
// (psql, redis-cli) — handler-core.js calls this after adapter.translate().

import { execSync as nodeExecSync } from "node:child_process";
import { whichSync } from "../detect.js";

const LINUX_TERMINALS = [
  { bin: "gnome-terminal", args: (cmd, args) => ["--", cmd, ...args] },
  { bin: "konsole",        args: (cmd, args) => ["-e", cmd, ...args] },
  { bin: "kitty",          args: (cmd, args) => [cmd, ...args] },
  { bin: "alacritty",      args: (cmd, args) => ["-e", cmd, ...args] },
  { bin: "wezterm",        args: (cmd, args) => ["start", "--", cmd, ...args] },
  { bin: "xterm",          args: (cmd, args) => ["-e", cmd, ...args] },
];

function shellQuote(s) {
  if (s == null) return "''";
  const str = String(s);
  if (str.length > 0 && /^[A-Za-z0-9_/.:@,=+\-]+$/.test(str)) return str;
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Wrap (cmd, args) so it runs inside the user's preferred terminal.
 * Returns { cmd, args, env } spawn-shape OR null when no suitable
 * terminal is available (caller falls back to bare spawn).
 *
 * Priority on Linux:
 *   1. $TERMINAL env var (if it exists in PATH)
 *   2. LINUX_TERMINALS in declared order, first installed wins
 *
 * @param {{cmd: string, args: string[], platform?: string,
 *          exec?: Function, env?: object}} opts
 */
export function wrapInTerminal(opts) {
  const { cmd, args = [] } = opts;
  if (typeof cmd !== "string" || cmd.length === 0) return null;
  const platform = opts.platform ?? process.platform;
  const exec = opts.exec ?? nodeExecSync;
  const env = opts.env ?? process.env;

  if (platform === "linux") {
    // Honor $TERMINAL first (user override)
    const envTerm = (env.TERMINAL || "").trim();
    if (envTerm) {
      const cfg = LINUX_TERMINALS.find((t) => t.bin === envTerm);
      const argsFn = cfg ? cfg.args : (c, a) => ["-e", c, ...a];
      if (whichSync(envTerm, { exec, platform })) {
        return { cmd: envTerm, args: argsFn(cmd, args), env: {} };
      }
    }
    for (const t of LINUX_TERMINALS) {
      if (whichSync(t.bin, { exec, platform })) {
        return { cmd: t.bin, args: t.args(cmd, args), env: {} };
      }
    }
    return null;
  }

  if (platform === "darwin") {
    // Terminal.app via osascript — ships with every macOS install
    const fullCmd = [cmd, ...args].map(shellQuote).join(" ");
    const escaped = fullCmd.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return {
      cmd: "osascript",
      args: ["-e", `tell application "Terminal" to do script "${escaped}"`],
      env: {},
    };
  }

  if (platform === "win32") {
    // Windows Terminal if available, else cmd /k (cmd.exe ships with every Win install)
    if (whichSync("wt.exe", { exec, platform })) {
      return { cmd: "wt", args: ["--", cmd, ...args], env: {} };
    }
    return { cmd: "cmd", args: ["/k", cmd, ...args], env: {} };
  }

  return null;
}

// Exported for unit tests so they can iterate the priority list
export const LINUX_TERMINAL_PRIORITY = LINUX_TERMINALS.map((t) => t.bin);
