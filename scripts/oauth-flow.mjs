#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { TwitterApi } from "twitter-api-v2";

const CONFIG_PATH = join(homedir(), ".replyflow", "config.json");
const REDIRECT_URI = "http://localhost:54321/callback";
const PORT = 54321;
const TIMEOUT_MS = 120_000;

function loadConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

async function main() {
  const config = loadConfig();
  const clientId = config.oauth2ClientId;

  if (!clientId) {
    console.error("No OAuth 2.0 Client ID found.");
    process.exit(1);
  }

  const oauthClient = new TwitterApi({ clientId });
  const { url, codeVerifier, state } = oauthClient.generateOAuth2AuthLink(
    REDIRECT_URI,
    { scope: ["tweet.read", "users.read", "offline.access"] },
  );

  // Start server
  const server = createServer();
  const callbackPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("OAuth timed out after 2 minutes"));
    }, TIMEOUT_MS);

    server.on("request", (req, res) => {
      const reqUrl = req.url ?? "/";
      console.log("  [debug] incoming request:", req.method, reqUrl);

      // Handle favicon quietly
      if (reqUrl === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (!reqUrl.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      clearTimeout(timeout);

      const parsed = new URL(reqUrl, `http://localhost:${PORT}`);
      const code = parsed.searchParams.get("code");
      const callbackState = parsed.searchParams.get("state");
      const error = parsed.searchParams.get("error");

      console.log("  [debug] code:", code?.slice(0, 10), "state:", callbackState?.slice(0, 10), "error:", error);

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Auth failed</h1><p>${error}</p>`);
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || !callbackState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Missing params</h1><p>code: ${!!code}, state: ${!!callbackState}</p>`);
        reject(new Error(`Missing code or state. URL: ${reqUrl}`));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<html><body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5"><div style="text-align:center;padding:2rem;background:white;border-radius:12px"><h1 style="color:#1da1f2;">✅ ReplyFlow</h1><p>OAuth complete! Close this tab.</p></div></body></html>`);
      resolve({ code, callbackState });
    });

    server.listen(PORT, "127.0.0.1");
    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Open browser
  console.log("\n  → Opening browser…\n");
  console.log("  If browser doesn't open, copy this URL:");
  console.log(`  ${url}\n`);
  try { spawn("xdg-open", [url], { stdio: "ignore" }); } catch {}

  console.log(`  Waiting on http://localhost:${PORT}/callback …\n`);

  // Wait for callback
  let callbackData;
  try {
    callbackData = await callbackPromise;
  } catch (err) {
    console.error(`\n  ❌ ${err.message}`);
    process.exit(1);
  } finally {
    server.close();
  }

  // Verify state
  if (callbackData.callbackState !== state) {
    console.error("\n  ❌ State mismatch — CSRF risk. Aborting.");
    process.exit(1);
  }

  // Exchange code for token
  console.log("  → Exchanging code for token…\n");
  try {
    const result = await oauthClient.loginWithOAuth2({
      code: callbackData.code,
      codeVerifier,
      redirectUri: REDIRECT_URI,
    });

    const cfg = loadConfig();
    cfg.oauth2AccessToken = result.accessToken;
    cfg.oauth2RefreshToken = result.refreshToken;
    cfg.oauth2TokenExpiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
      : undefined;
    saveConfig(cfg);

    console.log("  ✅ OAuth 2.0 complete!");
    console.log(`  Tokens saved to ${CONFIG_PATH}\n`);
  } catch (err) {
    console.error(`\n  ❌ Token exchange failed: ${err.message}`);
    process.exit(1);
  }
}

main();
