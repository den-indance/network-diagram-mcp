export function buildSshArgs(parsed) {
  const args = [];
  if (parsed.port && parsed.port !== 22) {
    args.push("-p", String(parsed.port));
  }
  args.push(parsed.user ? `${parsed.user}@${parsed.host}` : parsed.host);
  return args;
}

export function buildSshCmdString(parsed) {
  return ["ssh", ...buildSshArgs(parsed)].join(" ");
}
