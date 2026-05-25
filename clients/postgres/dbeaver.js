import { whichSync, probeAppBundleSync } from "../../detect.js";

const MACOS_BUNDLE = "/Applications/DBeaver.app";

function buildConnectionString(parsed) {
  const parts = [
    "driver=postgresql",
    `host=${parsed.host}`,
    `port=${parsed.port}`,
  ];
  if (parsed.database) parts.push(`database=${parsed.database}`);
  if (parsed.user) parts.push(`user=${parsed.user}`);
  if (parsed.password) parts.push(`password=${parsed.password}`);
  return parts.join("|");
}

export default {
  id: "dbeaver",
  name: "DBeaver Community",
  supportedOS: ["linux", "darwin", "win32"],

  async detect(deps = {}) {
    const platform = deps.platform ?? process.platform;
    if (platform === "darwin") {
      const path = probeAppBundleSync(MACOS_BUNDLE, deps);
      if (path) return { installed: true, path };
      return { installed: false };
    }
    const bin = platform === "win32" ? "dbeaver.exe" : "dbeaver";
    const path = whichSync(bin, deps);
    return path ? { installed: true, path } : { installed: false };
  },

  translate(parsed) {
    return { cmd: "dbeaver", args: ["-con", buildConnectionString(parsed)], env: {} };
  },
};
