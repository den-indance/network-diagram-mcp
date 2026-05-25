import * as linux from "./linux.js";
import * as macos from "./macos.js";
import * as windows from "./windows.js";

export { SUPPORTED_SCHEMES } from "./_shared.js";

export function getInstaller(platform = process.platform) {
  if (platform === "linux") return linux;
  if (platform === "darwin") return macos;
  if (platform === "win32") return windows;
  throw new Error(`installer: unsupported platform "${platform}"`);
}

export { linux, macos, windows };
