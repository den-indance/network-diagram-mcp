import { probeAppBundleSync } from "../../detect.js";
import { buildSshCmdString } from "./_ssh-args.js";

const MACOS_BUNDLE = "/Applications/iTerm.app";

export default {
  id: "iterm2",
  name: "iTerm2",
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
      throw new Error("iterm2: macOS only");
    }
    const sshCmd = buildSshCmdString(parsed).replace(/"/g, '\\"');
    const script = `tell application "iTerm" to create window with default profile command "${sshCmd}"`;
    return { cmd: "osascript", args: ["-e", script], env: {} };
  },
};
