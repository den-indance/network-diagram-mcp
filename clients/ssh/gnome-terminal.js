import { whichSync } from "../../detect.js";
import { buildSshArgs } from "./_ssh-args.js";

export default {
  id: "gnome-terminal",
  name: "GNOME Terminal",
  supportedOS: ["linux"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform !== "linux") return { installed: false };
    const path = whichSync("gnome-terminal", deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed, opts = {}) {
    const platform = opts.platform ?? process.platform;
    if (platform !== "linux") {
      throw new Error("gnome-terminal: Linux only");
    }
    return { cmd: "gnome-terminal", args: ["--", "ssh", ...buildSshArgs(parsed)], env: {} };
  },
};
