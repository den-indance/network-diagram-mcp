import { execSync as nodeExecSync } from "node:child_process";
import { existsSync as nodeExistsSync } from "node:fs";
import { platform as nodePlatform } from "node:os";

const SHELL_METACHARS = /[\s;&|`$<>"'\\]/;
const REG_METACHARS = /["`$<>|&;]/;

const QUIET_EXEC_OPTS = { stdio: ["ignore", "pipe", "ignore"] };

export function whichSync(bin, deps = {}) {
  const { exec = nodeExecSync, platform = nodePlatform() } = deps;
  if (typeof bin !== "string" || bin.length === 0) return null;
  if (SHELL_METACHARS.test(bin)) return null;
  const cmd = platform === "win32" ? `where ${bin}` : `which ${bin}`;
  try {
    const out = exec(cmd, QUIET_EXEC_OPTS);
    const str = out == null ? "" : out.toString().trim();
    if (!str) return null;
    return str.split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

export function probeAppBundleSync(bundlePath, deps = {}) {
  const { fs = { existsSync: nodeExistsSync } } = deps;
  if (typeof bundlePath !== "string" || bundlePath.length === 0) return null;
  if (!bundlePath.endsWith(".app")) return null;
  return fs.existsSync(bundlePath) ? bundlePath : null;
}

export function probeWindowsRegistrySync(keyPath, deps = {}) {
  const { exec = nodeExecSync, platform = nodePlatform() } = deps;
  if (platform !== "win32") return false;
  if (typeof keyPath !== "string" || keyPath.length === 0) return false;
  if (REG_METACHARS.test(keyPath)) return false;
  try {
    exec(`reg query "${keyPath}"`, QUIET_EXEC_OPTS);
    return true;
  } catch {
    return false;
  }
}

export function probeBinaryVersionSync(bin, versionFlag = "--version", deps = {}) {
  const { exec = nodeExecSync } = deps;
  if (typeof bin !== "string" || bin.length === 0) return null;
  if (SHELL_METACHARS.test(bin)) return null;
  try {
    const out = exec(`${bin} ${versionFlag}`, { stdio: ["ignore", "pipe", "pipe"] });
    const str = out == null ? "" : out.toString();
    const m = str.match(/(\d+\.\d+(?:\.\d+)?)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function getPlatform() {
  return nodePlatform();
}
