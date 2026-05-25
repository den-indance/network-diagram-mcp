// Native desktop notification — `notify-send` on Linux, osascript-driven
// macOS notification, PowerShell MessageBox on Windows. Used by handler-core
// when no_client_installed for a scheme so the .desktop / .app / HKCU-spawned
// process gives visible feedback (its stderr is /dev/null'd by the OS).
//
// Best-effort: returns true if exec succeeded, false otherwise. Caller
// keeps running with its primary exit-code path; notification is bonus UX.

import { execSync as nodeExecSync } from "node:child_process";

const QUIET = { stdio: ["ignore", "pipe", "ignore"] };

function shAESC(s) {
  return String(s).replace(/'/g, "'\\''");
}

function dqEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Show a native notification. Returns true on success, false on any failure.
 *
 * @param {{title: string, message: string, platform?: string, exec?: Function}} opts
 */
export function notifyUser(opts) {
  const title = String(opts.title ?? "");
  const message = String(opts.message ?? "");
  const platform = opts.platform ?? process.platform;
  const exec = opts.exec ?? nodeExecSync;

  if (!title && !message) return false;

  if (platform === "linux") {
    try {
      // -u critical + -t 0 makes the notification stay until user dismisses
      // (default 3-5s timeout was easy to miss when triggered via xdg-open
      // → user-reported "nothing happens" after browser click).
      exec(
        `notify-send -u critical -t 0 '${shAESC(title)}' '${shAESC(message)}'`,
        QUIET,
      );
      return true;
    } catch {
      return false;
    }
  }

  if (platform === "darwin") {
    try {
      const script = `display notification "${dqEscape(message)}" with title "${dqEscape(title)}"`;
      exec(`osascript -e '${shAESC(script)}'`, QUIET);
      return true;
    } catch {
      return false;
    }
  }

  if (platform === "win32") {
    try {
      // .NET MessageBox via PowerShell — works on every Windows edition
      // without external modules (BurntToast / other toast libs require install)
      const psScript =
        `[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); ` +
        `[System.Windows.Forms.MessageBox]::Show('${shAESC(message)}', '${shAESC(title)}') | Out-Null`;
      exec(`powershell -NoProfile -Command "${dqEscape(psScript)}"`, QUIET);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
