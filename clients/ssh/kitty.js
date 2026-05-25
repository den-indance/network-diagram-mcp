import { whichSync, probeAppBundleSync, probeBinaryVersionSync } from "../../detect.js";
import { buildSshArgs } from "./_ssh-args.js";

const MACOS_BUNDLE = "/Applications/kitty.app";

export default {
  id: "kitty",
  name: "kitty",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const bundle = probeAppBundleSync(MACOS_BUNDLE, deps);
      if (bundle) return { installed: true, path: bundle };
    }
    const bin = platform === "win32" ? "kitty.exe" : "kitty";
    const path = whichSync(bin, deps);
    if (!path) return { installed: false };
    const version = probeBinaryVersionSync(bin, "--version", deps);
    return version ? { installed: true, path, version } : { installed: true, path };
  },

  translate(parsed) {
    return { cmd: "kitty", args: ["ssh", ...buildSshArgs(parsed)], env: {} };
  },
};
