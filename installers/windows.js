import { execSync as nodeExecSync } from "node:child_process";
import {
  assertValidScheme,
  defaultHandlerEntry,
  QUIET_EXEC_OPTS,
} from "./_shared.js";

export function registryKey(scheme) {
  return `HKCU\\Software\\Classes\\${scheme}`;
}

export async function install(scheme, deps = {}) {
  assertValidScheme(scheme);
  const exec = deps.exec ?? nodeExecSync;
  const handlerEntry = deps.handlerEntry ?? defaultHandlerEntry();

  const key = registryKey(scheme);
  const cmdKey = `${key}\\shell\\open\\command`;

  // Internal "" → \"\" for cmd-quoted value
  const cmdValue = `${handlerEntry} \\"%1\\"`;

  const cmds = [
    `reg add "${key}" /ve /d "URL:NetMap ${scheme} Handler" /f`,
    `reg add "${key}" /v "URL Protocol" /d "" /f`,
    `reg add "${cmdKey}" /ve /d "${cmdValue}" /f`,
  ];

  for (const c of cmds) exec(c, QUIET_EXEC_OPTS);

  return { path: key, registered: true };
}

export async function isInstalled(scheme, deps = {}) {
  assertValidScheme(scheme);
  const exec = deps.exec ?? nodeExecSync;
  try {
    exec(`reg query "${registryKey(scheme)}"`, QUIET_EXEC_OPTS);
    return true;
  } catch {
    return false;
  }
}

export async function uninstall(scheme, deps = {}) {
  assertValidScheme(scheme);
  const exec = deps.exec ?? nodeExecSync;

  const key = registryKey(scheme);
  let removed = false;
  try {
    exec(`reg delete "${key}" /f`, QUIET_EXEC_OPTS);
    removed = true;
  } catch {
    /* ignore: key didn't exist */
  }

  return { path: key, removed };
}
