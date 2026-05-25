#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runHandler } from "../handler-core.js";

/**
 * Thin shim factored for testability — bin/handler.js is what `.desktop` /
 * `.app` / HKCU registration points at, so it must work as a standalone
 * script, but it's small enough that the import-based tests cover all
 * branches (success + thrown-error catch fallback).
 */
export async function runScript(argv = process.argv) {
  const result = await runHandler(argv.slice(2)).catch((err) => ({
    exitCode: 99,
    error: err && err.message ? err.message : String(err),
  }));
  return result.exitCode;
}

function isInvokedAsScript() {
  try {
    if (!process.argv[1]) return false;
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isInvokedAsScript()) {
  process.exit(await runScript());
}
