// Tool definitions exposed to the MCP client (exported for testing)

export const TOOLS = [
  {
    name: "map_get_state",
    description: "Return the current map state: all nodes, manual connections, stickies and notes. NOTE: only manual connections are included — use map_get_all_connections to also get auto-generated connections (DNS→server, project→server, service→node).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_add_node",
    description: "Add a new node to the map. Returns the new node id.",
    inputSchema: {
      type: "object",
      properties: {
        type:  { type: "string", enum: ["server","router","switch","firewall","domain","project","service","pc","nas","ap","camera","printer","other"], description: "Node type" },
        name:  { type: "string", description: "Display name" },
        ip:    { type: "string", description: "IP address (optional)" },
        x:     { type: "number", description: "Canvas X position (optional)" },
        y:     { type: "number", description: "Canvas Y position (optional)" },
      },
      required: ["type", "name"],
    },
  },
  {
    name: "map_update_node",
    description: `Update fields of an existing node by id.

FIELD SCHEMA BY NODE TYPE
All types: name, ip, x, y, w, h, notes
  ips: [{address, label}]  — extra IP addresses

server / pc / nas / ap / camera / printer / router / switch / firewall / other:
  ports: [{port, protocol("tcp"|"udp"|"icmp"), service, url, bindIp}]
  dockerServices: [{name, image, hostPort, containerPort, protocol("tcp"|"udp"), url}]

project:
  parentServer  — id of the parent server node (creates auto-connection)
  repoUrl       — Git/GitLab URL
  deployPath    — deployment directory
  cicdUrl       — CI/CD pipeline URL
  dockerServices (same as server)

domain (DNS Zone):
  ip            — registrar name (e.g. "Cloudflare")
  registrarUrl  — registrar control panel URL
  domains: [{name, record("A"|"AAAA"|"CNAME"|"MX"|"TXT"|"NS"|"SRV"), target, url}]
             target IP in 'target' triggers auto-connection to matching server node

service (External Service):
  provider      — provider name (e.g. "Supabase", "Vercel")
  dashboardUrl  — link to service dashboard
  serviceConns: [{toId, label}]  — links to other nodes (creates auto-connections)
  servedDomains: [string]`,
    inputSchema: {
      type: "object",
      properties: {
        id:      { type: "string", description: "Node id" },
        changes: { type: "object", description: "Fields to update — see tool description for full schema per node type" },
      },
      required: ["id", "changes"],
    },
  },
  {
    name: "map_delete_node",
    description: "Delete a node and all its connections.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Node id" },
      },
      required: ["id"],
    },
  },
  {
    name: "map_add_connection",
    description: "Add a manual connection between two nodes. Returns the new connection id.",
    inputSchema: {
      type: "object",
      properties: {
        from_id: { type: "string", description: "Source node id" },
        to_id:   { type: "string", description: "Target node id" },
        label:   { type: "string", description: "Optional connection label" },
        color:   { type: "string", description: "Optional line color, e.g. #ef4444" },
      },
      required: ["from_id", "to_id"],
    },
  },
  {
    name: "map_delete_connection",
    description: "Delete a connection by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Connection id" },
      },
      required: ["id"],
    },
  },
  {
    name: "map_add_sticky",
    description: "Add a sticky note to the map. Returns the new sticky id.",
    inputSchema: {
      type: "object",
      properties: {
        text:  { type: "string", description: "Note text" },
        x:     { type: "number", description: "Canvas X position (optional)" },
        y:     { type: "number", description: "Canvas Y position (optional)" },
        color: { type: "string", description: "Hex color, e.g. #fbbf24 (optional)" },
      },
      required: ["text"],
    },
  },
  {
    name: "map_move_node",
    description: "Move a node to new canvas coordinates without changing any other fields.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Node id" },
        x:  { type: "number", description: "New canvas X position" },
        y:  { type: "number", description: "New canvas Y position" },
      },
      required: ["id", "x", "y"],
    },
  },
  {
    name: "map_move_sticky",
    description: "Move a sticky note to new canvas coordinates without changing its text or color.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sticky note id" },
        x:  { type: "number", description: "New canvas X position" },
        y:  { type: "number", description: "New canvas Y position" },
      },
      required: ["id", "x", "y"],
    },
  },
  {
    name: "map_clear",
    description: "Remove all nodes, connections and stickies from the current sheet.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: { type: "boolean", description: "Must be true to confirm destructive action" },
      },
      required: ["confirm"],
    },
  },
  {
    name: "map_arrange",
    description: "Auto-arrange all nodes in a grid or circle layout.",
    inputSchema: {
      type: "object",
      properties: {
        layout: { type: "string", enum: ["grid", "circle"], description: "Layout type" },
      },
      required: ["layout"],
    },
  },
  {
    name: "map_update_connection",
    description: "Update label or color of an existing connection.",
    inputSchema: {
      type: "object",
      properties: {
        id:      { type: "string", description: "Connection id" },
        changes: {
          type: "object",
          description: "Fields to update",
          properties: {
            label: { type: "string" },
            color: { type: "string", description: "Hex color, e.g. #ef4444" },
          },
        },
      },
      required: ["id", "changes"],
    },
  },
  {
    name: "map_update_sticky",
    description: "Update text, color or size of a sticky note.",
    inputSchema: {
      type: "object",
      properties: {
        id:      { type: "string", description: "Sticky note id" },
        changes: {
          type: "object",
          description: "Fields to update",
          properties: {
            text:  { type: "string" },
            color: { type: "string", description: "Hex color, e.g. #fbbf24" },
            x:     { type: "number" },
            y:     { type: "number" },
            w:     { type: "number", description: "Width in pixels" },
            h:     { type: "number", description: "Height in pixels" },
          },
        },
      },
      required: ["id", "changes"],
    },
  },
  {
    name: "map_delete_sticky",
    description: "Delete a sticky note by id.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sticky note id" },
      },
      required: ["id"],
    },
  },
  {
    name: "map_list_sheets",
    description: "List all sheets with their id, name, createdAt, updatedAt and which is active.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_get_sheet_data",
    description: "Return nodes/connections/stickies/notes for a specific sheet (defaults to active sheet).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sheet id (omit for active sheet)" },
      },
    },
  },
  {
    name: "map_create_sheet",
    description: "Create a new empty sheet and switch to it. Returns new sheet id.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Sheet name (optional, auto-generated if omitted)" },
      },
    },
  },
  {
    name: "map_switch_sheet",
    description: "Switch the active sheet. Saves current sheet state first.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sheet id to switch to" },
      },
      required: ["id"],
    },
  },
  {
    name: "map_rename_sheet",
    description: "Rename a sheet.",
    inputSchema: {
      type: "object",
      properties: {
        id:   { type: "string", description: "Sheet id" },
        name: { type: "string", description: "New name (max 50 chars)" },
      },
      required: ["id", "name"],
    },
  },
  {
    name: "map_delete_sheet",
    description: "Delete a sheet. Cannot delete the last remaining sheet.",
    inputSchema: {
      type: "object",
      properties: {
        id:      { type: "string", description: "Sheet id" },
        confirm: { type: "boolean", description: "Must be true to confirm destructive action" },
      },
      required: ["id", "confirm"],
    },
  },
  {
    name: "map_set_zoom",
    description: "Set canvas zoom level (0.1–3.0).",
    inputSchema: {
      type: "object",
      properties: {
        zoom: { type: "number", description: "Zoom level, e.g. 1.0 = 100%, 0.5 = 50%" },
      },
      required: ["zoom"],
    },
  },
  {
    name: "map_set_canvas_offset",
    description: "Pan canvas to an absolute pixel offset.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Horizontal offset in pixels" },
        y: { type: "number", description: "Vertical offset in pixels" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "map_zoom_to_fit",
    description: "Auto-fit all nodes into the viewport by adjusting zoom and pan.",
    inputSchema: {
      type: "object",
      properties: {
        padding: { type: "number", description: "Padding around content in pixels (default 80)" },
      },
    },
  },
  {
    name: "map_get_notes",
    description: "Return the sheet-level notes text.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_set_notes",
    description: "Set the sheet-level notes text.",
    inputSchema: {
      type: "object",
      properties: {
        notes: { type: "string", description: "Notes content" },
      },
      required: ["notes"],
    },
  },
  {
    name: "map_lock_sheet",
    description: "Lock or unlock a sheet. A locked sheet rejects all MCP mutations and disables manual editing in the UI. Pass locked: false to unlock.",
    inputSchema: {
      type: "object",
      properties: {
        id:     { type: "string", description: "Sheet id (omit for active sheet)" },
        locked: { type: "boolean", description: "true = lock (default), false = unlock" },
      },
    },
  },
  {
    name: "map_get_settings",
    description: "Return current app settings (sshMode, dblClickAction, perfMode, showGrid, showZoomSlider).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_update_settings",
    description: "Update one or more app settings.",
    inputSchema: {
      type: "object",
      properties: {
        changes: {
          type: "object",
          description: "Settings fields to update",
          properties: {
            sshMode:        { type: "string", enum: ["iframe", "tab"] },
            dblClickAction: { type: "string", enum: ["node", "sticky"] },
            perfMode:       { type: "boolean" },
            showGrid:       { type: "boolean" },
            showZoomSlider: { type: "boolean" },
          },
        },
      },
      required: ["changes"],
    },
  },
  {
    name: "map_get_all_connections",
    description: "Return all connections including auto-generated ones (DNS→server, project→server, service→node). Auto connections have auto:true flag. Use this instead of map_get_state.connections when you need the full topology picture.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_get_view",
    description: "Return current canvas zoom level and pan offset.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_find_node",
    description: "Search nodes by name, IP, type, or free-text query. Returns id, name, type, ip, x, y for each match. Use this to locate a node before updating it.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Substring match on node name (case-insensitive)" },
        ip:   { type: "string", description: "Exact match on primary IP or any secondary IP" },
        type: { type: "string", enum: ["server","router","switch","firewall","domain","project","service","pc","nas","ap","camera","printer","other"], description: "Filter by node type" },
        text: { type: "string", description: "Free-text search across name, IPs, and domain records" },
      },
    },
  },
  {
    name: "map_search",
    description: "Full-text search across nodes (name/ip/notes), stickies, connection labels, and ports (port-number/service). Returns categorized hits with a total count. Use map_find_node for structured node-only filtering.",
    inputSchema: {
      type: "object",
      properties: {
        q:     { type: "string", description: "Query string (case-insensitive substring match)" },
        types: { type: "array", items: { type: "string", enum: ["nodes","stickies","connections","ports"] }, description: "Limit search scope (default: all 4)" },
      },
      required: ["q"],
    },
  },
  {
    name: "map_import_nmap",
    description: "Parse nmap scan output (XML from `nmap -oX`) and create nodes with their open ports. Auto-infers node type from OS fingerprint + port profile (router/switch/firewall/server/printer/etc.). Provide either raw `xml` OR pre-parsed `hosts[]` — `hosts` takes priority when both are given. Nodes are auto-arranged in a grid. Returns {count, ids}.",
    inputSchema: {
      type: "object",
      properties: {
        xml:   { type: "string", description: "Raw nmap XML output (use `nmap -oX -`)" },
        hosts: { type: "array",  description: "Alternative: pre-parsed hosts [{ip, hostnames[], ports[{portid, protocol, service}], osMatch}]" },
      },
    },
  },
  {
    name: "map_suggest_layout",
    description: "Smart auto-layout: force-directed (organic, deterministic with seed), cluster-by-type (horizontal lanes per node type), or cluster-by-connection (BFS components → separate zones). Different from map_arrange (naive grid/circle). Mutates node positions in-place.",
    inputSchema: {
      type: "object",
      properties: {
        algorithm:  { type: "string", enum: ["force", "cluster-by-type", "cluster-by-connection"], description: "Layout algorithm (default: force)" },
        iterations: { type: "number", description: "Force-directed only; default 200, recommended range 50-1000" },
        seed:       { type: "number", description: "PRNG seed for force-directed reproducibility (default 42)" },
      },
    },
  },
  {
    name: "map_import_csv",
    description: "Import nodes from CSV. Auto-detects columns from the header row (name/ip/type/ports/notes — case-insensitive, aliases like hostname/description/host_ip accepted). Ports field accepts 'port/protocol,port/protocol' (e.g. '22/tcp,80/tcp') or bare port numbers (default tcp). Nodes laid out in a 6-column grid. Returns {count, ids}.",
    inputSchema: {
      type: "object",
      properties: {
        csv:     { type: "string", description: "CSV content with header row (RFC 4180-lite: quoted fields, escaped \"\", UTF-8 BOM tolerated)" },
        columns: { type: "object", description: "Optional explicit column mapping: {name: 0, ip: 1, type: 2, ports: 3, notes: 4} — overrides auto-detect; missing keys default to -1" },
      },
      required: ["csv"],
    },
  },
  {
    name: "map_get_nodes_by_type",
    description: "Return all nodes of a given type with FULL field data (ports, dockerServices, domains, ips, notes, parentServer, etc.). For stripped projection or multi-criteria filtering use map_find_node instead.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["server","router","switch","firewall","domain","project","service","pc","nas","ap","camera","printer","other"], description: "Node type to filter by" },
      },
      required: ["type"],
    },
  },
  {
    name: "map_import_sheet",
    description: "Replace active sheet content with provided JSON data. Useful for loading a prepared topology in one call.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Sheet data: { nodes: [], connections: [], stickies?: [], notes?: '' }",
          properties: {
            nodes:       { type: "array" },
            connections: { type: "array" },
            stickies:    { type: "array" },
            notes:       { type: "string" },
          },
          required: ["nodes", "connections"],
        },
      },
      required: ["data"],
    },
  },
  {
    name: "map_export_sheet",
    description: "Export sheet data as JSON including auto-connections. Defaults to active sheet.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Sheet id (omit for active sheet)" },
      },
    },
  },
  {
    name: "map_export",
    description: "Export current or specified sheet as JSON / PNG / PDF. PNG and PDF return base64-encoded blobs with mimeType — the client decodes and saves to a file. Server raises the response timeout to 30s for PNG/PDF since large maps can take several seconds to render.",
    inputSchema: {
      type: "object",
      properties: {
        format:   { type: "string", enum: ["json", "png", "pdf"], description: "Output format (default: json)" },
        sheet_id: { type: "string", description: "Sheet id (omit for the active sheet)" },
      },
    },
  },
  {
    name: "map_duplicate_node",
    description: "Clone a node with all its properties (ports, services, domains, etc.). Returns new node id.",
    inputSchema: {
      type: "object",
      properties: {
        id:       { type: "string", description: "Source node id" },
        offset_x: { type: "number", description: "X offset from original (default 40)" },
        offset_y: { type: "number", description: "Y offset from original (default 40)" },
        name:     { type: "string", description: "Override name for the clone (default: same as original)" },
      },
      required: ["id"],
    },
  },
  {
    name: "map_get_selection",
    description: "Return currently selected node/sticky ids and connection id. Result shape: { nodeIds: string[], nodeId: string|null (= nodeIds[0], legacy single-id), connId: string|null }.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "map_select",
    description: "Programmatically select node(s)/sticky(s) and/or a connection. Pass node_ids (array) for multi-select; node_id (string) is legacy single-select. Empty array or null deselects. Connection selection remains single (multi-select connections out of scope v1).",
    inputSchema: {
      type: "object",
      properties: {
        node_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of node/sticky ids to select (multi-select). Replaces the existing selection.",
        },
        node_id: { type: ["string", "null"], description: "Legacy single node/sticky id (prefer node_ids for multi-select)" },
        conn_id: { type: ["string", "null"], description: "Connection id to select (single-select)" },
      },
    },
  },
  {
    name: "map_bulk_add_nodes",
    description: "Add multiple nodes in a single call. Each node accepts the same fields as map_add_node plus all type-specific fields (ports, dockerServices, domains, parentServer, etc.). Returns array of created ids.",
    inputSchema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          description: "Array of node objects",
          items: {
            type: "object",
            properties: {
              type:           { type: "string", enum: ["server","router","switch","firewall","domain","project","service","pc","nas","ap","camera","printer","other"] },
              name:           { type: "string" },
              ip:             { type: "string" },
              x:              { type: "number" },
              y:              { type: "number" },
              ports:          { type: "array" },
              ips:            { type: "array" },
              dockerServices: { type: "array" },
              domains:        { type: "array" },
              parentServer:   { type: "string" },
              repoUrl:        { type: "string" },
              deployPath:     { type: "string" },
              cicdUrl:        { type: "string" },
              provider:       { type: "string" },
              dashboardUrl:   { type: "string" },
              serviceConns:   { type: "array" },
              registrarUrl:   { type: "string" },
              notes:          { type: "string" },
            },
            required: ["type", "name"],
          },
        },
      },
      required: ["nodes"],
    },
  },
  {
    name: "map_bulk_add_connections",
    description: "Add multiple connections in a single call. Returns array of created ids.",
    inputSchema: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          description: "Array of connection objects",
          items: {
            type: "object",
            properties: {
              from_id: { type: "string" },
              to_id:   { type: "string" },
              label:   { type: "string" },
              color:   { type: "string" },
            },
            required: ["from_id", "to_id"],
          },
        },
      },
      required: ["connections"],
    },
  },
];
