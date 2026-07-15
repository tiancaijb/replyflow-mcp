#!/usr/bin/env tsx
/**
 * Simple MCP client: calls a tool on replyflow-mcp and prints the result.
 * Usage: tsx scripts/mcp-call.ts <toolName> '<json-args>'
 */
import { spawn } from "node:child_process";
import { join } from "node:path";

const PROJECT_DIR = "/home/wangy/dev/replyflow-mcp";
const toolName = process.argv[2];
const argsStr = process.argv[3] || "{}";

if (!toolName) {
  console.error("Usage: tsx scripts/mcp-call.ts <toolName> '<json-args>'");
  process.exit(1);
}

const child = spawn("node", [join(PROJECT_DIR, "dist/index.js")], {
  cwd: PROJECT_DIR,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});

let buffer = "";
let resolved = false;

child.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();
  // Try to find complete JSON-RPC responses
  tryParse();
});

child.stderr.on("data", (chunk: Buffer) => {
  // MCP server logs to stderr
});

function tryParse() {
  // MCP sends JSON-RPC messages delimited by newlines
  const lines = buffer.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && msg.result) {
        resolved = true;
        console.log(JSON.stringify(msg.result, null, 2));
        child.kill();
        process.exit(0);
      }
    } catch {}
  }
}

// Initialize
child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: toolName,
    arguments: JSON.parse(argsStr),
  },
}) + "\n");

setTimeout(() => {
  if (!resolved) {
    // Try to parse whatever we got
    const lines = buffer.split("\n").filter(l => l.trim());
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.id === 1) {
          console.log(JSON.stringify(msg, null, 2));
          process.exit(0);
        }
      } catch {}
    }
    console.error("Timeout - no response received");
    console.error("Buffer:", buffer.slice(0, 2000));
    process.exit(1);
  }
}, 15000);
