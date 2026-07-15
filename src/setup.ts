/**
 * replyflow-mcp interactive setup.
 *
 * Usage: npx replyflow-mcp setup
 *
 * Walks the user through:
 *   1. Twitter API Key / Secret (required for app-only Bearer token)
 *   2. (Optional) Twitter OAuth 2.0 PKCE — get user-context access token
 *   3. Niche keywords for trending-post search
 *   4. Preferred reply style
 *   5. Save to config file
 */

import * as readline from "node:readline/promises";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { stdin as stdinRaw, stdout } from "node:process";
import * as http from "node:http";
import { TwitterApi } from "twitter-api-v2";
import {
  Config,
  ReplyStyle,
  CONFIG_PATH,
  updateEffectiveConfig,
  setActiveAccount,
  getAccountConfigPath,
} from "./config.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createReader() {
  return readline.createInterface({
    input: stdinRaw,
    output: stdout,
  });
}

async function ask(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askWithDefault(
  rl: readline.Interface,
  question: string,
  defaultVal: string,
): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim() || defaultVal;
}

// ── Banners ──────────────────────────────────────────────────────────────────

function printWelcome(): void {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   🚀 ReplyFlow – Interactive Setup                    │");
  console.log("  │                                                      │");
  console.log("  │   This will configure your Twitter credentials,      │");
  console.log("  │   OAuth 2.0 tokens, niche keywords, and reply        │");
  console.log("  │   style in ~/.replyflow/config.json.                 │");
  console.log("  │                                                      │");
  console.log("  │   You need a Twitter Developer Account:              │");
  console.log("  │   https://developer.twitter.com/en/portal/dashboard  │");
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

function printOAuthInstructions(clientId: string): void {
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   🔐 Twitter OAuth 2.0 Authorization                 │");
  console.log("  │                                                      │");
  console.log("  │   Before continuing:                                 │");
  console.log("  │                                                      │");
  console.log("  │   1. Go to Twitter Developer Portal                  │");
  console.log("  │      → Your Project → User authentication settings   │");
  console.log("  │                                                      │");
  console.log("  │   2. Under 'OAuth 2.0':                              │");
  console.log("  │      - Set App permissions → 'Read'                   │");
  console.log("  │      - Set Type of App → 'Native App' / 'Web App'    │");
  console.log(`  │      - Add redirect URI:                              │`);
  console.log(`  │        http://localhost:54321/callback                │`);
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

function printOAuthSuccess(): void {
  console.log("");
  console.log("  ✅  OAuth 2.0 authorization successful!");
  console.log("");
}

function printSaveSummary(config: Partial<Config>): void {
  const mask = (s?: string) =>
    s ? s.slice(0, 8) + "…" + s.slice(-4) : "—";
  console.log("");
  console.log("  ╭──────────────────────────────────────────────────────╮");
  console.log("  │                                                      │");
  console.log("  │   📋 Configuration Summary                           │");
  console.log("  │                                                      │");
  console.log(`  │     API Key:         ${(mask(config.twitterApiKey) + "                    ").slice(0, 37)}│`);
  console.log(`  │     API Secret:      ${(mask(config.twitterApiSecret) + "                    ").slice(0, 37)}│`);
  console.log(`  │     OAuth 2.0:       ${config.oauth2AccessToken ? "✅ Connected" : "⏭️  Skipped"}                    │`);
  console.log(`  │     Keywords:        ${((config.nicheKeywords ?? []).join(", ") + "                    ").slice(0, 37)}│`);
  console.log(`  │     Reply Style:     ${(config.replyStyle ?? "curious" + "                    ").slice(0, 37)}│`);
  console.log("  │                                                      │");
  console.log("  ╰──────────────────────────────────────────────────────╯");
  console.log("");
}

// ── OAuth 2.0 PKCE Flow ─────────────────────────────────────────────────────

const OAUTH_REDIRECT_URI = "http://localhost:54321/callback";
const OAUTH_PORT = 54321;
const OAUTH_TIMEOUT_MS = 120_000; // 2 minutes

interface OAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/**
 * Run the OAuth 2.0 PKCE flow:
 *   1. Create TwitterApi instance with clientId
 *   2. Generate auth URL + codeVerifier + state
 *   3. Start local HTTP server on OAUTH_PORT
 *   4. Show URL to user (auto-open if possible)
 *   5. Wait for callback with code + state
 *   6. Verify state
 *   7. Exchange code for access token
 *   8. Return tokens + expiry
 *
 * Returns null on timeout / user cancellation.
 */
async function runOAuthFlow(clientId: string): Promise<OAuthResult | null> {
  const oauthClient = new TwitterApi({ clientId });

  // ── Step 1: Generate auth link ──────────────────────────────────────
  const { url, codeVerifier, state } = oauthClient.generateOAuth2AuthLink(
    OAUTH_REDIRECT_URI,
    {
      scope: ["tweet.read", "users.read", "offline.access"],
    },
  );

  // ── Step 2: Start local HTTP server ─────────────────────────────────
  const server = http.createServer();
  const callbackPromise = new Promise<{ code: string; callbackState: string }>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        server.close();
        reject(new Error("OAuth callback timed out after 2 minutes"));
      }, OAUTH_TIMEOUT_MS);

      server.on("request", (req, res) => {
        // Only handle POST or GET to /callback
        const reqUrl = req.url ?? "/";
        if (!reqUrl.startsWith("/callback")) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const parsed = new URL(reqUrl, `http://localhost:${OAUTH_PORT}`);
        const code = parsed.searchParams.get("code");
        const callbackState = parsed.searchParams.get("state");
        const error = parsed.searchParams.get("error");

        if (error) {
          clearTimeout(timeout);
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<html><body><h1>❌ Authorization failed</h1><p>Error: ${error}</p><p>You can close this tab and try again.</p></body></html>`,
          );
          reject(new Error(`OAuth error from Twitter: ${error}`));
          return;
        }

        if (!code || !callbackState) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            "<html><body><h1>❌ Missing parameters</h1><p>Authorization callback missing code or state.</p></body></html>",
          );
          reject(new Error("OAuth callback missing code or state"));
          return;
        }

        clearTimeout(timeout);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5;"><div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);"><h1 style="color: #1da1f2;">✅ ReplyFlow</h1><p>OAuth authorization complete!</p><p style="color: #666;">You can close this tab and return to the terminal.</p></div></body></html>`,
        );
        resolve({ code, callbackState });
      });

      server.listen(OAUTH_PORT, "127.0.0.1", () => {
        // Server is ready — ok to open browser now
      });
      server.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timeout);
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${OAUTH_PORT} is already in use. Close the other process or use a different port.`,
            ),
          );
        } else {
          reject(err);
        }
      });
    },
  );

  // ── Step 3: Open browser / show URL ─────────────────────────────────
  console.log("");
  console.log("  → Opening browser for Twitter authorization…");
  console.log("");

  // Try to auto-open the URL
  let opened = false;
  try {
    const { spawn } = await import("node:child_process");
    const platform = process.platform;
    if (platform === "darwin") {
      spawn("open", [url]);
      opened = true;
    } else if (platform === "linux") {
      spawn("xdg-open", [url]);
      opened = true;
    } else if (platform === "win32") {
      spawn("start", ["", url], { shell: true });
      opened = true;
    }
  } catch {
    // Ignore — fall back to manual
  }

  if (!opened) {
    console.log(`  Please open this URL in your browser:`);
    console.log(`  ${url}`);
  } else {
    console.log(`  (If the browser didn't open, copy this URL manually:)`);
    console.log(`  ${url}`);
  }
  console.log("");
  console.log(`  Waiting for authorization on http://localhost:${OAUTH_PORT}/callback …`);

  // ── Step 4: Wait for callback ───────────────────────────────────────
  let callbackData: { code: string; callbackState: string };
  try {
    callbackData = await callbackPromise;
  } catch (err) {
    console.error("");
    console.error(`  ❌ OAuth error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    server.close();
  }

  // ── Step 5: Verify state ────────────────────────────────────────────
  if (callbackData.callbackState !== state) {
    console.error("");
    console.error("  ❌ OAuth state mismatch — possible CSRF attack. Aborting.");
    return null;
  }

  // ── Step 6: Exchange code for token ─────────────────────────────────
  console.log("");
  console.log("  → Exchanging authorization code for access token…");

  try {
    const result = await oauthClient.loginWithOAuth2({
      code: callbackData.code,
      codeVerifier,
      redirectUri: OAUTH_REDIRECT_URI,
    });

    printOAuthSuccess();
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  } catch (err) {
    console.error("");
    console.error(
      `  ❌ Failed to exchange code: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ── Interactive Steps ────────────────────────────────────────────────────────

/**
 * Ask for Twitter API Key + Secret.
 * These are needed for the app-only Bearer token (search, tweet lookup).
 */
async function stepApiCredentials(
  rl: readline.Interface,
): Promise<{ apiKey: string; apiSecret: string }> {
  console.log("");
  console.log("  ── Step 1: Twitter API Credentials ──────────────────────────");
  console.log("");
  console.log("  These are your app-level credentials from the Twitter Developer Portal.");
  console.log("  Create a Project → 'Keys and tokens' tab.");
  console.log("");

  const apiKey = await ask(rl, "  Consumer Key (API Key): ");
  const apiSecret = await ask(rl, "  Consumer Secret (API Secret): ");

  return { apiKey, apiSecret };
}

/**
 * Ask if user wants OAuth 2.0 PKCE for user-context access.
 * This enables timeline + mentions features.
 */
async function stepOAuth2(
  rl: readline.Interface,
): Promise<{
  clientId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
}> {
  console.log("");
  console.log("  ── Step 2: Twitter OAuth 2.0 (optional) ──────────────────────");
  console.log("");
  console.log("  OAuth 2.0 lets ReplyFlow read your timeline and @mentions.");
  console.log("  (Without this, it will fall back to app-only search.)");
  console.log("");

  const want = await askWithDefault(rl, "  Set up OAuth 2.0 now? (Y/n): ", "y");
  if (want.toLowerCase() === "n") {
    console.log("  ⏭️  Skipping OAuth 2.0.");
    return {};
  }

  console.log("");
  const clientId = await ask(rl, "  OAuth 2.0 Client ID: ");
  if (!clientId) {
    console.log("  ⏭️  No Client ID entered — skipping OAuth.");
    return {};
  }

  printOAuthInstructions(clientId);
  const ready = await askWithDefault(
    rl,
    "  Ready to continue? You need to add 'http://localhost:54321/callback' as a redirect URI first. (Y/n): ",
    "y",
  );

  if (ready.toLowerCase() === "n") {
    console.log("  ⏭️  Skipping OAuth 2.0.");
    return {};
  }

  const result = await runOAuthFlow(clientId);

  if (!result) {
    console.log("  ⏭️  OAuth 2.0 failed — skipping. You can retry with 'npx replyflow-mcp setup'.");
    return { clientId };
  }

  return {
    clientId,
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    tokenExpiresAt: result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
      : undefined,
  };
}

/**
 * Ask for niche keywords.
 */
async function stepKeywords(rl: ReadlineInterface): Promise<string[]> {
  const DEFAULT = "indie dev, saas, build in public, coding, solopreneur";
  console.log("");
  console.log("  ── Step 3: Niche Keywords ────────────────────────────────────");
  console.log("");
  console.log("  These keywords are used to find relevant tweets to reply to.");
  console.log("  Separate multiple keywords with commas.");
  console.log("");

  const raw = await askWithDefault(rl, `  Keywords [${DEFAULT}]: `, DEFAULT);
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Ask for preferred reply style.
 */
async function stepReplyStyle(rl: ReadlineInterface): Promise<ReplyStyle> {
  const STYLES: { key: ReplyStyle; desc: string }[] = [
    { key: "curious", desc: "Ask thoughtful questions" },
    { key: "casual", desc: "Relaxed, conversational" },
    { key: "supportive", desc: "Warm and encouraging" },
    { key: "thoughtful", desc: "Substantive observations" },
    { key: "auto", desc: "Let AI decide based on post tone" },
  ];

  console.log("");
  console.log("  ── Step 4: Reply Style ───────────────────────────────────────");
  console.log("");
  console.log("  How would you like your replies to sound by default?");
  console.log("");

  for (let i = 0; i < STYLES.length; i++) {
    console.log(`    ${i + 1}. ${STYLES[i].key} — ${STYLES[i].desc}`);
  }
  console.log("");

  const choice = await askWithDefault(rl, "  Select [1-5] (default: 1): ", "1");
  const idx = Math.max(0, Math.min(parseInt(choice) - 1, STYLES.length - 1));
  return STYLES[idx].key;
}

// ── Main entry ───────────────────────────────────────────────────────────────

/**
 * Run the full interactive setup.
 *
 * @param account Optional account name (from `--account` flag).
 *   If provided, switches to this account before configuring.
 *   Returns `true` if config was saved, `false` if cancelled.
 */
export async function runInteractiveSetup(account?: string): Promise<boolean> {
  const rl = createReader();

  try {
    // If an account is specified, switch to it before setup
    if (account) {
      setActiveAccount(account);
      console.log("");
      console.log(`  Configuring account: ${account}`);
      console.log("");
    }

    printWelcome();

    // Step 1: API credentials
    const { apiKey, apiSecret } = await stepApiCredentials(rl);
    if (!apiKey || !apiSecret) {
      console.log("  ❌ API Key and Secret are required. Setup cancelled.");
      return false;
    }

    // Step 2: OAuth 2.0 (optional)
    const oauth = await stepOAuth2(rl);

    // Step 3: Keywords
    const keywords = await stepKeywords(rl);

    // Step 4: Reply style
    const style = await stepReplyStyle(rl);

    // ── Build config ──────────────────────────────────────────────────
    const config: Partial<Config> = {
      twitterApiKey: apiKey,
      twitterApiSecret: apiSecret,
      nicheKeywords: keywords,
      replyStyle: style,
    };

    if (oauth.clientId) {
      config.oauth2ClientId = oauth.clientId;
    }
    if (oauth.accessToken) {
      config.oauth2AccessToken = oauth.accessToken;
    }
    if (oauth.refreshToken) {
      config.oauth2RefreshToken = oauth.refreshToken;
    }
    if (oauth.tokenExpiresAt) {
      config.oauth2TokenExpiresAt = oauth.tokenExpiresAt;
    }

    // ── Confirm and save ──────────────────────────────────────────────
    printSaveSummary(config);

    const confirm = await askWithDefault(rl, "  Save configuration? (Y/n): ", "y");
    if (confirm.toLowerCase() === "n") {
      console.log("");
      console.log("  ❌ Setup cancelled. No changes saved.");
      return false;
    }

    updateEffectiveConfig(config);
    console.log("");
    const configPath = account ? getAccountConfigPath(account) : CONFIG_PATH;
    console.log(`  ✅  Configuration saved to ${configPath}`);
    console.log("");
    console.log("  You can now start the MCP server:");
    console.log("");
    console.log("     npx replyflow-mcp");
    console.log("");
    console.log("  Or re-run setup anytime:");
    console.log("");
    console.log("     npx replyflow-mcp setup");
    console.log("");

    return true;
  } finally {
    rl.close();
  }
}
