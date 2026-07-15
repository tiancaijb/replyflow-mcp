#!/usr/bin/env node
/**
 * MCP client for replyflow-mcp.
 * Usage: node scripts/mcp-client.mjs <toolName> '<json-args>'
 *
 * Handles the MCP initialization handshake then calls the tool.
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");

const toolName = process.argv[2];
const argsStr = process.argv[3] || "{}";
const timeoutMs = parseInt(process.argv[4] || "30000", 10);

if (!toolName) {
  console.error("Usage: node scripts/mcp-client.mjs <toolName> '<json-args>' [timeoutMs]");
  process.exit(1);
}

let args;
try {
  args = JSON.parse(argsStr);
} catch {
  console.error("Invalid JSON args:", argsStr);
  process.exit(1);
}

const child = spawn("node", [join(PROJECT_DIR, "dist/index.js")], {
  cwd: PROJECT_DIR,
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});

let buffer = "";
let pendingResolve = null;
let pendingReject = null;
let reqId = 0;

function send(method, params = {}) {
  reqId++;
  const msg = JSON.stringify({ jsonrpc: "2.0", id: reqId, method, params }) + "\n";
  child.stdin.write(msg);
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
  });
}

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  processMessages();
});

function processMessages() {
  const lines = buffer.split("\n");
  let consumed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      consumed = i + 1;
      continue;
    }
    try {
      const msg = JSON.parse(line);
      consumed = i + 1;
      if (pendingResolve) {
        const resolve = pendingResolve;
        pendingResolve = null;
        resolve(msg);
      }
    } catch {
      // Incomplete JSON, wait for more data
      break;
    }
  }
  buffer = lines.slice(consumed).join("\n");
}

child.stderr.on("data", () => {
  // MCP server logs to stderr, ignore
});

// Timeout
const timer = setTimeout(() => {
  child.kill();
  console.error(JSON.stringify({ error: "Request timed out" }));
  process.exit(1);
}, timeoutMs);

(async () => {
  try {
    // Step 1: Initialize
    const initResult = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "replyflow-pi-client", version: "1.0.0" },
    });

    if (initResult.error) {
      throw new Error(`Initialize error: ${initResult.error.message}`);
    }

    // Step 2: Send initialized notification
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

    // Step 3: Call the tool
    const result = await send("tools/call", {
      name: toolName,
      arguments: args,
    });

    clearTimeout(timer);
    child.kill();

    if (result.error) {
      console.error(JSON.stringify({ error: result.error.message }));
      process.exit(1);
    }

    // Extract content
    const content = result.result?.content || result.content || [];
    for (const item of content) {
      if (item.type === "text") {
        console.log(item.text);
      }
    }
    process.exit(0);
  } catch (err) {
    clearTimeout(timer);
    child.kill();
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
})();
