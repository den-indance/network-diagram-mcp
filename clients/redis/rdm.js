import { whichSync, probeAppBundleSync } from "../../detect.js";
import { ensureSessionDir } from "./_rdm-session.js";

// RESP.app is the modern rename of Redis Desktop Manager (same project line,
// same author/publisher). Snap publishes it under the legacy package name
// `redis-desktop-manager` but the snap command alias is `.resp` →
// /snap/bin/redis-desktop-manager.resp. macOS .app may be named RESP.app
// (modern) or RedisDesktopManager.app (legacy). Detect all forms; v1 just
// needs ANY of them.
//
// CRITICAL UPSTREAM LIMITATION: RESP.app QApplication argv handler only
// accepts --settings-dir / --extension-server-url / --rendering-backend
// (verified in uglide/RedisDesktopManager src/app/app.cpp::processCmdArgs).
// Passing a redis:// URL as positional arg has no effect — RESP.app simply
// ignores it. To bridge our click → pre-filled connection flow, _rdm-session.js
// writes a per-click isolated settings dir with a single connection pre-defined,
// then we launch RESP.app with --settings-dir pointing there. RESP.app shows
// only that connection; user clicks once to connect.

const MACOS_BUNDLES = [
  "/Applications/RESP.app",
  "/Applications/RedisDesktopManager.app",
];

const LINUX_BINS = [
  "redis-desktop-manager.resp", // snap alias (modern install)
  "redis-desktop-manager",
  "resp",
  "rdm",
];

const WIN32_BINS = [
  "RESP.exe",
  "redis-desktop-manager.exe",
  "resp.exe",
];

function pickLinuxBin(deps) {
  for (const bin of LINUX_BINS) {
    if (whichSync(bin, deps)) return bin;
  }
  return null;
}

function pickWin32Bin(deps) {
  for (const bin of WIN32_BINS) {
    if (whichSync(bin, deps)) return bin;
  }
  return null;
}

export default {
  id: "rdm",
  name: "RESP.app / Redis Desktop Manager",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      for (const bundle of MACOS_BUNDLES) {
        const path = probeAppBundleSync(bundle, deps);
        if (path) return { installed: true, path };
      }
      return { installed: false };
    }
    if (platform === "win32") {
      const bin = pickWin32Bin(deps);
      if (bin) {
        const path = whichSync(bin, deps);
        return path ? { installed: true, path } : { installed: false };
      }
      return { installed: false };
    }
    // Linux: try snap variant first, then non-suffix + alt names
    const bin = pickLinuxBin(deps);
    if (bin) {
      const path = whichSync(bin, deps);
      return path ? { installed: true, path } : { installed: false };
    }
    return { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    // Pick bin BEFORE building the session — on linux the choice tells us
    // whether to route the session into SNAP_USER_COMMON (snap variant cannot
    // read ~/.cache due to AppArmor `home` plug forbidding hidden dirs).
    const linuxBin = platform === "linux" ? pickLinuxBin(opts) || LINUX_BINS[0] : null;
    const isSnap = linuxBin === "redis-desktop-manager.resp";

    // Pre-fill via --settings-dir injection (see file-header note).
    // Falls back to bare launch (blank GUI) if session dir setup fails —
    // user still gets RESP.app open, just has to enter URL manually.
    const sessionDir = (opts.ensureSessionDir ?? ensureSessionDir)(parsed, {
      snap: isSnap,
    });
    const settingsArgs = sessionDir ? ["--settings-dir", sessionDir] : [];

    if (platform === "darwin") {
      // `open -a APP --args <args>` forwards --args... as argv to the .app's
      // main executable so RESP.app picks up --settings-dir.
      if (settingsArgs.length === 0) {
        return { cmd: "open", args: ["-a", "RESP"], env: {} };
      }
      return { cmd: "open", args: ["-a", "RESP", "--args", ...settingsArgs], env: {} };
    }
    if (platform === "win32") {
      const bin = pickWin32Bin(opts) || WIN32_BINS[0];
      return { cmd: bin, args: settingsArgs, env: {} };
    }
    // Linux: snap dispatch (`<package>.<command>`) forwards argv to the
    // packaged binary transparently — --settings-dir reaches the QApp parser.
    return { cmd: linuxBin, args: settingsArgs, env: {} };
  },
};
