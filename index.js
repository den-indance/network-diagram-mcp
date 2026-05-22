#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createBridge } from "./bridge.js";
import { handleListTools, handleCallTool } from "./handlers.js";

const PORT = parseInt(process.env.NETMAP_MCP_PORT || "47821", 10);

const { sendCommand } = createBridge({ port: PORT });

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

const server = new Server(
  { name: "netmap", version: pkg.version },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => handleListTools());
server.setRequestHandler(CallToolRequestSchema, async (request) => handleCallTool(request, sendCommand));

const transport = new StdioServerTransport();
await server.connect(transport);
