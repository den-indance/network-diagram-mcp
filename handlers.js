import { TOOLS } from "./tools.js";

// Tools that may need significantly more than the bridge default (e.g. PNG/PDF
// capture on large maps). Routed through sendCommand opts.timeoutMs.
const LONG_RUNNING_TOOLS = new Set(["map_export"]);
const LONG_TIMEOUT_MS = 30_000;

export function handleListTools() {
  return { tools: TOOLS };
}

export async function handleCallTool(request, sendCommand) {
  const { name, arguments: args } = request.params;
  const opts = LONG_RUNNING_TOOLS.has(name) ? { timeoutMs: LONG_TIMEOUT_MS } : {};
  try {
    const result = await sendCommand(name, args || {}, opts);
    const text = result === undefined ? "" : JSON.stringify(result, null, 2);
    return {
      content: [{ type: "text", text }],
    };
  } catch (err) {
    const msg = err?.message ?? String(err);
    return {
      content: [{ type: "text", text: `Error: ${msg}` }],
      isError: true,
    };
  }
}
