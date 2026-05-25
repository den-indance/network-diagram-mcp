// Append-only diagnostic log for the OS-handler chain. Notifications can
// be missed (auto-dismissed, suppressed, no notification daemon), the
// .desktop-spawned process's stderr is /dev/null'd by the OS, and the
// click path is otherwise silent. A log file at a stable location gives
// the user a post-mortem trail to verify "did the click reach handler.js?
// which adapter was tried? why did it exit?"

import { appendFileSync as nodeAppendFileSync, mkdirSync as nodeMkdirSync } from "node:fs";
import { homedir as nodeHomedir } from "node:os";
import { dirname } from "node:path";

export function defaultLogPath() {
  const home = process.env.HOME || nodeHomedir();
  if (!home) return null;
  return `${home}/.cache/netmap-agent/log.txt`;
}

/**
 * Append a single line to the log file. Best-effort — never throws.
 *
 * @param {string} line  — single log line (newline added automatically)
 * @param {{path?: string, fs?: object}} [deps]
 * @returns {boolean} true on success, false on failure
 */
export function appendLog(line, deps = {}) {
  // Explicit null/empty path = disable; undefined = use default. Tests pass
  // null to assert the disabled path; production uses default.
  const path = deps.path !== undefined ? deps.path : defaultLogPath();
  if (!path) return false;
  const fs = deps.fs ?? {
    appendFileSync: nodeAppendFileSync,
    mkdirSync: nodeMkdirSync,
  };
  try {
    fs.mkdirSync(dirname(path), { recursive: true });
    const stamp = new Date().toISOString();
    fs.appendFileSync(path, `[${stamp}] ${line}\n`, { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}
