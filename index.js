#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createBridge } from "./bridge.js";
import { handleListTools, handleCallTool } from "./handlers.js";

const PORT = parseInt(process.env.NETMAP_MCP_PORT || "47821", 10);

const { sendCommand } = createBridge({ port: PORT });

// NOTE: version must stay in sync with package.json on every release.
const server = new Server(
  { name: "netmap", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => handleListTools());
server.setRequestHandler(CallToolRequestSchema, async (request) => handleCallTool(request, sendCommand));

const transport = new StdioServerTransport();
await server.connect(transport);
