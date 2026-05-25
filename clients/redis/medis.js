import { probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLE = "/Applications/Medis.app";

export default {
  id: "medis",
  name: "Medis",
  supportedOS: ["darwin"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform !== "darwin") return { installed: false };
    const path = probeAppBundleSync(MACOS_BUNDLE, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform !== "darwin") {
      throw new Error("medis: macOS only");
    }
    return { cmd: "open", args: ["-a", "Medis"], env: {} };
  },
};
