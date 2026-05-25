import { whichSync, probeBinaryVersionSync } from "../../detect.js";
import { format } from "../../protocols/postgres.js";

export default {
  id: "psql",
  name: "psql (CLI)",
  supportedOS: ["linux", "darwin", "win32"],
  // CLI client → must be wrapped in user's terminal by handler-core so the
  // interactive session is visible. Without the wrap, the OS-spawned psql
  // runs detached with stdio:"ignore" and exits invisibly.
  requiresTerminal: true,

  async detect(deps = {}) {
    const bin = (deps.platform ?? process.platform) === "win32" ? "psql.exe" : "psql";
    const path = whichSync(bin, deps);
    if (!path) return { installed: false };
    const version = probeBinaryVersionSync(bin, "--version", deps);
    return version ? { installed: true, path, version } : { installed: true, path };
  },

  translate(parsed) {
    return { cmd: "psql", args: [format(parsed)], env: {} };
  },
};
