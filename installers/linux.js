import {
  writeFileSync as nodeWriteFileSync,
  unlinkSync as nodeUnlinkSync,
  mkdirSync as nodeMkdirSync,
  existsSync as nodeExistsSync,
} from "node:fs";
import { execSync as nodeExecSync } from "node:child_process";
import { homedir } from "node:os";
import {
  assertValidScheme,
  defaultHandlerEntry,
  QUIET_EXEC_OPTS,
} from "./_shared.js";

const APP_DIR_REL = ".local/share/applications";

export function desktopFilePath(home, scheme) {
  return `${home}/${APP_DIR_REL}/netmap-${scheme}-handler.desktop`;
}

export function desktopFileContent(scheme, handlerEntry) {
  return `[Desktop Entry]
Type=Application
Name=NetMap ${scheme.toUpperCase()} Handler
Comment=NetMap protocol handler for ${scheme}://
Exec=${handlerEntry} %u
NoDisplay=true
Terminal=false
MimeType=x-scheme-handler/${scheme};
StartupNotify=false
`;
}

export async function install(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? {
    writeFileSync: nodeWriteFileSync,
    mkdirSync: nodeMkdirSync,
    existsSync: nodeExistsSync,
  };
  const exec = deps.exec ?? nodeExecSync;
  const handlerEntry = deps.handlerEntry ?? defaultHandlerEntry();

  const path = desktopFilePath(home, scheme);
  const dir = `${home}/${APP_DIR_REL}`;
  const filename = `netmap-${scheme}-handler.desktop`;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path, desktopFileContent(scheme, handlerEntry), { mode: 0o644 });

  exec(
    `xdg-mime default "${filename}" "x-scheme-handler/${scheme}"`,
    QUIET_EXEC_OPTS
  );

  return { path, registered: true };
}

export async function isInstalled(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? { existsSync: nodeExistsSync };
  return fs.existsSync(desktopFilePath(home, scheme));
}

export async function uninstall(scheme, deps = {}) {
  assertValidScheme(scheme);
  const home = deps.home ?? homedir();
  const fs = deps.fs ?? { unlinkSync: nodeUnlinkSync, existsSync: nodeExistsSync };
  const exec = deps.exec ?? nodeExecSync;

  const path = desktopFilePath(home, scheme);
  let removed = false;
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
    removed = true;
  }

  // Reset mime default (best-effort — may not be ours)
  try {
    exec(`xdg-mime default "" "x-scheme-handler/${scheme}"`, QUIET_EXEC_OPTS);
  } catch {
    /* ignore */
  }

  return { path, removed };
}
