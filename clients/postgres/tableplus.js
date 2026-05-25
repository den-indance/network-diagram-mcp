import { whichSync, probeAppBundleSync, probeWindowsRegistrySync } from "../../detect.js";
import { format } from "../../protocols/postgres.js";

const MACOS_BUNDLE = "/Applications/TablePlus.app";
const WIN_REGISTRY_KEY = "HKCU\\Software\\TablePlus";

export default {
  id: "tableplus",
  name: "TablePlus",
  supportedOS: ["darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const path = probeAppBundleSync(MACOS_BUNDLE, deps);
      return path ? { installed: true, path } : { installed: false };
    }
    if (platform === "win32") {
      const path = whichSync("TablePlus.exe", deps);
      if (path) return { installed: true, path };
      if (probeWindowsRegistrySync(WIN_REGISTRY_KEY, deps)) {
        return { installed: true };
      }
      return { installed: false };
    }
    return { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    const url = format(parsed);
    if (platform === "darwin") {
      return { cmd: "open", args: ["-a", "TablePlus", url], env: {} };
    }
    if (platform === "win32") {
      return { cmd: "cmd", args: ["/c", "start", "", "TablePlus.exe", url], env: {} };
    }
    throw new Error("tableplus: unsupported platform " + platform);
  },
};
