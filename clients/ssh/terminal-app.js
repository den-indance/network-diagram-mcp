import { buildSshCmdString } from "./_ssh-args.js";

export default {
  id: "terminal-app",
  name: "Terminal.app (macOS)",
  supportedOS: ["darwin"],

  // Terminal.app ships with every macOS install. Detect = platform check.
  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    return platform === "darwin" ? { installed: true } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform !== "darwin") {
      throw new Error("terminal-app: macOS only");
    }
    const sshCmd = buildSshCmdString(parsed).replace(/"/g, '\\"');
    const script = `tell application "Terminal" to do script "${sshCmd}"`;
    return { cmd: "osascript", args: ["-e", script], env: {} };
  },
};
