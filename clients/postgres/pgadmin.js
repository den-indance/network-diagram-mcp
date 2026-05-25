import { whichSync, probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLE = "/Applications/pgAdmin 4.app";

export default {
  id: "pgadmin",
  name: "pgAdmin 4",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const path = probeAppBundleSync(MACOS_BUNDLE, deps);
      if (path) return { installed: true, path };
      return { installed: false };
    }
    const bin = platform === "win32" ? "pgadmin4.exe" : "pgadmin4";
    const path = whichSync(bin, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform === "darwin") {
      return { cmd: "open", args: ["-a", "pgAdmin 4"], env: {} };
    }
    return { cmd: "pgadmin4", args: [], env: {} };
  },
};
