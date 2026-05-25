import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  existsSync as nodeExistsSync,
  readFileSync as nodeReadFileSync,
  writeFileSync as nodeWriteFileSync,
  mkdirSync as nodeMkdirSync,
} from "node:fs";
import { dirname } from "node:path";

export function defaultTokenPath() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (!home) return null;
  const sep = process.platform === "win32" ? "\\" : "/";
  return `${home}${sep}.config${sep}netmap-agent${sep}token`;
}

export function getOrCreateToken(deps = {}) {
  const path = deps.path ?? defaultTokenPath();
  const fs = deps.fs ?? {
    existsSync: nodeExistsSync,
    readFileSync: nodeReadFileSync,
    writeFileSync: nodeWriteFileSync,
    mkdirSync: nodeMkdirSync,
  };
  const randomBytes = deps.randomBytes ?? nodeRandomBytes;

  if (!path) throw new Error("token: cannot determine path (no HOME/USERPROFILE)");

  if (fs.existsSync(path)) {
    const existing = fs.readFileSync(path, "utf-8").toString().trim();
    if (existing.length > 0) return existing;
  }

  fs.mkdirSync(dirname(path), { recursive: true });
  const token = randomBytes(32).toString("hex");
  fs.writeFileSync(path, token, { mode: 0o600 });
  return token;
}
