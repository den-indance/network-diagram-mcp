import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const SUPPORTED_SCHEMES = ["ssh", "postgres", "redis"];

export const QUIET_EXEC_OPTS = { stdio: ["ignore", "pipe", "ignore"] };

// Reject any scheme containing characters that could break shell quoting,
// XML escaping (Info.plist), or registry value parsing. Schemes are
// lowercase ASCII per RFC 3986.
const VALID_SCHEME_RE = /^[a-z][a-z0-9+.-]{0,30}$/;

export function assertValidScheme(scheme) {
  if (typeof scheme !== "string" || !VALID_SCHEME_RE.test(scheme)) {
    throw new Error(`installer: invalid scheme "${scheme}"`);
  }
}

export function defaultHandlerEntry() {
  // Resolve <package-root>/bin/handler.js relative to this module.
  // Phase 5 ships bin/handler.js; Phase 4 only writes the path.
  const here = fileURLToPath(import.meta.url);
  const handlerPath = join(dirname(here), "..", "bin", "handler.js");
  return `node "${handlerPath}"`;
}
