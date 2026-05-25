import { whichSync, probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLE = "/Applications/Beekeeper Studio.app";

export default {
  id: "beekeeper",
  name: "Beekeeper Studio",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const path = probeAppBundleSync(MACOS_BUNDLE, deps);
      if (path) return { installed: true, path };
      return { installed: false };
    }
    const bin = platform === "win32" ? "beekeeper-studio.exe" : "beekeeper-studio";
    const path = whichSync(bin, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform === "darwin") {
      return { cmd: "open", args: ["-a", "Beekeeper Studio"], env: {} };
    }
    return { cmd: "beekeeper-studio", args: [], env: {} };
  },
};
