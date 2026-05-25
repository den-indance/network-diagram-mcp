import { whichSync, probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLE = "/Applications/Another Redis Desktop Manager.app";

export default {
  id: "another-redis",
  name: "Another Redis Desktop Manager",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const path = probeAppBundleSync(MACOS_BUNDLE, deps);
      if (path) return { installed: true, path };
      return { installed: false };
    }
    const bin =
      platform === "win32"
        ? "another-redis-desktop-manager.exe"
        : "another-redis-desktop-manager";
    const path = whichSync(bin, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform === "darwin") {
      return { cmd: "open", args: ["-a", "Another Redis Desktop Manager"], env: {} };
    }
    return { cmd: "another-redis-desktop-manager", args: [], env: {} };
  },
};
