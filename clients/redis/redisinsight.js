import { whichSync, probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLES = ["/Applications/RedisInsight.app", "/Applications/RedisInsight-v2.app"];

export default {
  id: "redisinsight",
  name: "RedisInsight",
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
    const bin = platform === "win32" ? "RedisInsight.exe" : "RedisInsight";
    const path = whichSync(bin, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform === "darwin") {
      return { cmd: "open", args: ["-a", "RedisInsight"], env: {} };
    }
    return { cmd: "RedisInsight", args: [], env: {} };
  },
};
