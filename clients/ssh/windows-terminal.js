import { whichSync } from "../../detect.js";
import { buildSshArgs } from "./_ssh-args.js";

export default {
  id: "windows-terminal",
  name: "Windows Terminal",
  supportedOS: ["win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform !== "win32") return { installed: false };
    const path = whichSync("wt.exe", deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform !== "win32") {
      throw new Error("windows-terminal: Windows only");
    }
    return { cmd: "wt", args: ["--", "ssh", ...buildSshArgs(parsed)], env: {} };
  },
};
