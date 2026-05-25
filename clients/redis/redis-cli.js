import { whichSync, probeBinaryVersionSync } from "../../detect.js";

export default {
  id: "redis-cli",
  name: "redis-cli (CLI)",
  supportedOS: ["linux", "darwin", "win32"],
  // CLI client — see psql.js for rationale (handler-core wraps in terminal).
  requiresTerminal: true,

  async detect(deps = {}) {
    const bin = (deps.platform ?? process.platform) === "win32" ? "redis-cli.exe" : "redis-cli";
    const path = whichSync(bin, deps);
    if (!path) return { installed: false };
    const version = probeBinaryVersionSync(bin, "--version", deps);
    return version ? { installed: true, path, version } : { installed: true, path };
  },

  translate(parsed) {
    const args = ["-h", parsed.host];
    if (parsed.port && parsed.port !== 6379) args.push("-p", String(parsed.port));
    if (parsed.user) args.push("--user", parsed.user);
    if (parsed.password) args.push("-a", parsed.password);
    if (parsed.db !== undefined && parsed.db !== 0) args.push("-n", String(parsed.db));
    if (parsed.scheme === "rediss") args.push("--tls");
    return { cmd: "redis-cli", args, env: {} };
  },
};
