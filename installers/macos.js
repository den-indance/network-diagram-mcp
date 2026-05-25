import {
  writeFileSync as nodeWriteFileSync,
  mkdirSync as nodeMkdirSync,
  existsSync as nodeExistsSync,
  rmSync as nodeRmSync,
  chmodSync as nodeChmodSync,
} from "node:fs";
import { execSync as nodeExecSync } from "node:child_process";
import { homedir } from "node:os";
import {
  assertValidScheme,
  defaultHandlerEntry,
  QUIET_EXEC_OPTS,
} from "./_shared.js";

const LSREGISTER =
  "/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister";
const HANDLERS_DIR_REL = "Library/Application Support/NetMap/handlers";

function camelize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function bundleName(scheme) {
  return `NetMap${camelize(scheme)}Handler.app`;
}

export function bundlePath(home, scheme) {
  return `${home}/${HANDLERS_DIR_REL}/${bundleName(scheme)}`;
}

export function infoPlistContent(scheme) {
  const title = `NetMap ${scheme.toUpperCase()} Handler`;
  const bundleId = `com.den.dance.netmap-handler-${scheme}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>netmap-handler</string>
  <key>CFBundleIdentifier</key>
  <string>${bundleId}</string>
  <key>CFBundleName</key>
  <string>${title}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>${title}</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>${scheme}</string>
      </array>
    </dict>
  </array>
  <key>LSUIElement</key>
  <true/>
</dict>
</plist>
`;
}

export function executableContent(handlerEntry) {
  return `#!/bin/bash
exec ${handlerEntry} "$@"
`;
}

export async function install(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? {
    writeFileSync: nodeWriteFileSync,
    mkdirSync: nodeMkdirSync,
    existsSync: nodeExistsSync,
    chmodSync: nodeChmodSync,
  };
  const exec = deps.exec ?? nodeExecSync;
  const handlerEntry = deps.handlerEntry ?? defaultHandlerEntry();

  const bundle = bundlePath(home, scheme);
  const macosDir = `${bundle}/Contents/MacOS`;
  const plistPath = `${bundle}/Contents/Info.plist`;
  const execPath = `${macosDir}/netmap-handler`;

  fs.mkdirSync(macosDir, { recursive: true });
  fs.writeFileSync(plistPath, infoPlistContent(scheme), { mode: 0o644 });
  fs.writeFileSync(execPath, executableContent(handlerEntry), { mode: 0o755 });
  fs.chmodSync(execPath, 0o755);

  exec(`"${LSREGISTER}" -f "${bundle}"`, QUIET_EXEC_OPTS);

  return { path: bundle, registered: true };
}

export async function isInstalled(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? { existsSync: nodeExistsSync };
  return fs.existsSync(bundlePath(home, scheme));
}

export async function uninstall(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? { rmSync: nodeRmSync, existsSync: nodeExistsSync };
  const exec = deps.exec ?? nodeExecSync;

  const bundle = bundlePath(home, scheme);
  let removed = false;
  if (fs.existsSync(bundle)) {
    fs.rmSync(bundle, { recursive: true, force: true });
    removed = true;
    try {
      exec(`"${LSREGISTER}" -u "${bundle}"`, QUIET_EXEC_OPTS);
    } catch {
      /* ignore */
    }
  }

  return { path: bundle, removed };
}
