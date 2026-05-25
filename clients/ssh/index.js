import iterm2 from "./iterm2.js";
import windowsTerminal from "./windows-terminal.js";
import gnomeTerminal from "./gnome-terminal.js";
import terminalApp from "./terminal-app.js";
import kitty from "./kitty.js";

// Priority: platform-native preferred first (iTerm2 on macOS, Windows
// Terminal on Win, GNOME Terminal on Linux), then OS-stock fallback,
// then cross-platform power user. $TERMINAL env var is handled by the
// orchestrator (Phase 3 picker), not as a separate adapter.
export default [iterm2, windowsTerminal, gnomeTerminal, terminalApp, kitty];
