// RESP.app / Redis Desktop Manager has no CLI flag for `redis://` URLs —
// QApplication's argv handler only honors --settings-dir / --extension-server-url
// / --rendering-backend (verified by source-code inspection of
// uglide/RedisDesktopManager src/app/app.cpp::processCmdArgs). To bridge
// our click → connection flow we exploit --settings-dir: each click creates
// a fresh isolated settings dir, writes a connections.json with the parsed
// URL pre-filled as a single connection, then spawns RESP.app with
// --settings-dir <our-temp>. RESP.app opens showing only that one connection
// → user clicks once to connect, no manual URL re-entry.
//
// Session dirs:
//   - Non-snap installs → ~/.cache/netmap-agent/resp-sessions/<randhex>/
//   - Snap install (linux) → ~/snap/redis-desktop-manager/common/netmap-sessions/<randhex>/
//
// The snap-specific path is mandatory: snap's `home` interface forbids access
// to hidden dirs in $HOME (anything starting with `.`), so RESP.app cannot
// read `~/.cache/...` (AppArmor DENIED open). SNAP_USER_COMMON
// (~/snap/<pkg>/common/) is the snap's own writeable dir — guaranteed R/W
// from inside the confined process. Each invocation sweeps session dirs older
// than SESSION_MAX_AGE_MS so dirs don't accumulate.

import {
  mkdirSync as nodeMkdirSync,
  writeFileSync as nodeWriteFileSync,
  readdirSync as nodeReaddirSync,
  statSync as nodeStatSync,
  rmSync as nodeRmSync,
} from "node:fs";
import { homedir as nodeHomedir } from "node:os";
import { join } from "node:path";

export const SESSION_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export const SNAP_PKG = "redis-desktop-manager";

export function defaultSessionRoot({ snap = false } = {}) {
  const home = process.env.HOME || nodeHomedir();
  if (!home) return null;
  if (snap) {
    // SNAP_USER_COMMON — guaranteed R/W from inside the confined snap process,
    // unlike ~/.cache/* which AppArmor's `home` interface blocks (hidden dir).
    return `${home}/snap/${SNAP_PKG}/common/netmap-sessions`;
  }
  return `${home}/.cache/netmap-agent/resp-sessions`;
}

/**
 * Build a single connection entry matching RESP.app's connections.json
 * schema (verified against a real user's ~/.rdm/connections.json). Only
 * fields meaningful for an auto-injected click; others use RESP.app's
 * own defaults.
 */
export function buildConnectionEntry(parsed) {
  if (!parsed || typeof parsed.host !== "string" || !parsed.host) {
    throw new Error("rdm-session: parsed must include non-empty host");
  }
  const port = Number.isInteger(parsed.port) ? parsed.port : 6379;
  const host = parsed.host;
  const portLabel = port === 6379 ? "" : `:${port}`;
  return {
    auth: parsed.password || "",
    username: parsed.user || "",
    host,
    port,
    name: `NetMap (${host}${portLabel})`,
    namespace_separator: ":",
    keys_pattern: "*",
    timeout_connect: 60000,
    timeout_execute: 60000,
    // rediss:// → TLS; ignoring cert errors keeps the auto-injected
    // connection usable for self-signed / cloud-issued certs the user
    // would normally accept manually
    ...(parsed.scheme === "rediss" ? { ssl_ignore_all_errors: true } : {}),
  };
}

function randSuffix() {
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

/**
 * Sweep session dirs older than SESSION_MAX_AGE_MS. Best-effort — fs errors
 * (permission, partial state) are swallowed; the worst case is leftover
 * dirs that get cleaned next invocation.
 */
export function cleanupOldSessions(deps = {}) {
  const root = deps.root !== undefined ? deps.root : defaultSessionRoot();
  if (!root) return 0;
  const fs = deps.fs ?? {
    readdirSync: nodeReaddirSync,
    statSync: nodeStatSync,
    rmSync: nodeRmSync,
  };
  const now = deps.now ?? Date.now();
  const maxAge = deps.maxAgeMs ?? SESSION_MAX_AGE_MS;
  let removed = 0;
  let entries;
  try {
    entries = fs.readdirSync(root);
  } catch {
    return 0;
  }
  for (const name of entries) {
    const path = join(root, name);
    try {
      const stats = fs.statSync(path);
      const age = now - (stats.mtimeMs ?? 0);
      if (age > maxAge) {
        fs.rmSync(path, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      /* skip — partial state, fs racing */
    }
  }
  return removed;
}

/**
 * Create a fresh session dir + write `.rdm/connections.json` with the
 * parsed URL as a single pre-filled connection. Returns the path to pass
 * to RESP.app as `--settings-dir`. Sweeps old sessions opportunistically.
 *
 * @returns {string} absolute path to the new session dir, OR null on failure
 */
export function ensureSessionDir(parsed, deps = {}) {
  const root =
    deps.root !== undefined ? deps.root : defaultSessionRoot({ snap: deps.snap });
  if (!root) return null;
  const fs = deps.fs ?? {
    mkdirSync: nodeMkdirSync,
    writeFileSync: nodeWriteFileSync,
  };
  let entry;
  try {
    entry = buildConnectionEntry(parsed);
  } catch {
    return null;
  }

  // Opportunistic cleanup — runs before creating new dir so a long-lived
  // process (the .desktop-spawned handler is one-shot but defensive anyway)
  // doesn't grow unbounded.
  try {
    cleanupOldSessions({ root });
  } catch {
    /* best-effort */
  }

  const sessionDir = join(root, randSuffix());
  const rdmSubdir = join(sessionDir, ".rdm");
  try {
    fs.mkdirSync(rdmSubdir, { recursive: true });
    fs.writeFileSync(
      join(rdmSubdir, "connections.json"),
      JSON.stringify([entry], null, 2),
      { encoding: "utf-8", mode: 0o600 },
    );
  } catch {
    return null;
  }
  return sessionDir;
}
