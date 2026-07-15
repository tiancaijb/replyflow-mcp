/**
 * replyflow_generate: LLM-powered tweet reply generation.
 *
 * Supports Claude API (primary) and OpenAI API (fallback).
 * Style system: casual / curious (default) / supportive / thoughtful / auto
 */

import * as https from "node:https";
import {
  Config,
  resolveAnthropicApiKey,
  resolveOpenAiApiKey,
  ReplyStyle,
} from "./config.js";
import { getTweetContext } from "./twitter.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type { ReplyStyle };

export interface Draft {
  id: string;
  text: string;
  reason: string;
}

export interface GenerateResult {
  tweetId: string;
  style: ReplyStyle;
  drafts: Draft[];
  error?: string;
}

// ── Style definitions ────────────────────────────────────────────────────────

interface StyleDef {
  label: string;
  instruction: string;
  examples: string[];
}

const STYLE_MAP: Record<Exclude<ReplyStyle, "auto">, StyleDef> = {
  casual: {
    label: "Casual",
    instruction: [
      "Write in a relaxed, conversational tone like a peer chatting.",
      "Be genuine, not hype-y. Use contractions (I'm, don't, it's).",
      "Prefer short sentences. Can start with 'oh', 'huh', 'nice'.",
      "Ask a light question or share a quick anecdote.",
    ].join("\n"),
    examples: [
      "oh nice, been exploring a similar setup. what stack are you on?",
      "huh, hadn't thought of it that way. gonna try that out.",
    ],
  },
  curious: {
    label: "Curious",
    instruction: [
      "Ask thoughtful questions that show you engaged with the content.",
      "Dig deeper: ask about tradeoffs, edge cases, or what they'd do differently.",
      "Show genuine interest in learning from their experience.",
      "Keep the focus on their post, not yourself.",
    ].join("\n"),
    examples: [
      "interesting — what made you pick this over the alternatives?",
      "did you run into any edge cases with that approach?",
    ],
  },
  supportive: {
    label: "Supportive",
    instruction: [
      "Acknowledge their effort or insight warmly.",
      "Be encouraging without being generic ('great post!').",
      "Share appreciation for a specific detail they mentioned.",
      "Can offer help if relevant, but keep it low-pressure.",
    ].join("\n"),
    examples: [
      "love how you broke this down — the bit about onboarding really clicked for me.",
      "glad someone's talking about this. the part about churn hits close to home.",
    ],
  },
  thoughtful: {
    label: "Thoughtful",
    instruction: [
      "Add a substantive observation or nuance to their point.",
      "Connect their idea to a broader pattern or your own experience.",
      "Be precise, avoid vague praise. Use specific language.",
      "It's ok to respectfully disagree if you have a solid counterpoint.",
    ].join("\n"),
    examples: [
      "the tradeoff I keep coming back to is speed vs flexibility — and it sounds like you optimized for the former. curious how that holds up at scale.",
      "this mirrors what I've seen too. one thing that surprised me was how much the team dynamic affected the outcome, more than the tech choice.",
    ],
  },
};

// ── Auto style detection ─────────────────────────────────────────────────────

/**
 * Infer the most appropriate reply style from the tweet's content and tone.
 */
function detectStyle(text: string): Exclude<ReplyStyle, "auto"> {
  const lower = text.toLowerCase();

  // Question / looking for advice
  if (
    lower.includes("how do you") ||
    lower.includes("what do you think") ||
    lower.includes("any tips") ||
    lower.includes("any advice") ||
    lower.includes("recommendation") ||
    lower.includes("should i") ||
    lower.includes("does anyone") ||
    lower.endsWith("?")
  ) {
    return "curious";
  }

  // Struggle / frustration → supportive
  if (
    lower.includes("struggling") ||
    lower.includes("failed") ||
    lower.includes("hard") ||
    lower.includes("difficult") ||
    lower.includes("tough") ||
    lower.includes("mistake") ||
    lower.includes("regret") ||
    lower.includes("burnout")
  ) {
    return "supportive";
  }

  // Insight / analysis → thoughtful
  if (
    lower.includes("analysis") ||
    lower.includes("thread") ||
    lower.includes("deep dive") ||
    lower.includes("break down") ||
    lower.includes("learned") ||
    lower.includes("lesson") ||
    lower.includes("reflection") ||
    lower.includes("here's how") ||
    text.length > 200
  ) {
    return "thoughtful";
  }

  // Default to casual for short / neutral posts
  return "casual";
}

// ── Prompt builder ───────────────────────────────────────────────────────────

interface PromptInput {
  style: ReplyStyle;
  post: string;
  context?: { root: string; replies: string[] };
}

function buildSystemPrompt(input: PromptInput): string {
  const { style: rawStyle, post, context } = input;
  const effectiveStyle = rawStyle === "auto" ? detectStyle(post) : rawStyle;
  const styleDef = STYLE_MAP[effectiveStyle];

  const lines: string[] = [
    "You are an expert at writing Twitter replies for independent developers who build in public.",
    "",
    "## Goal",
    "Help them write authentic, engaging replies that start conversations or add value.",
    "",
    "## Constraints",
    "- Each reply MUST be under 280 characters (Twitter's character limit).",
    "- DO NOT write empty platitudes like 'Great post!' or 'Love this!'.",
    "- Prefer asking a question or sharing a specific observation.",
    "- Sound like a real human, not a marketing bot.",
    "- Do not use emojis unless the original post uses them.",
    "",
    "## Style",
    styleDef.instruction,
    "",
    "## Examples of this style (for reference, do not copy verbatim)",
    ...styleDef.examples.map((e) => `- "${e}"`),
    "",
  ];

  if (context && context.replies.length > 0) {
    lines.push(
      "## Conversation Context",
      `Original post: "${context.root}"`,
      `Replies so far: ${context.replies.map((r) => `"${r}"`).join(", ")}`,
      "",
      "Make sure your reply fits naturally as part of this existing conversation.",
    );
  } else if (context) {
    lines.push(
      "## Conversation Context",
      `Original post: "${context.root}"`,
      "No other replies yet — you're the first to respond.",
    );
  }

  lines.push(
    "",
    "## Output Format",
    'Return a JSON object with a "drafts" array. Each draft has:',
    '- "text": the reply text (under 280 chars)',
    '- "reason": a short explanation (under 100 chars, for the user to see)',
    "",
    "Generate exactly 3 drafts. Example:",
    JSON.stringify(
      {
        drafts: [
          {
            text: "oh nice, been exploring this too. what surprised you most?",
            reason: "asks for their takeaway",
          },
          {
            text: "the tradeoff I keep hitting is speed vs flexibility. how'd you navigate that?",
            reason: "specific tradeoff question",
          },
          {
            text: "love the breakdown. the bit about onboarding really resonated.",
            reason: "points to a specific detail",
          },
        ],
      },
      null,
      2,
    ),
  );

  return lines.join("\n");
}

function buildUserPrompt(post: string): string {
  return `Write 3 reply drafts for this tweet:\n\n"${post}"`;
}

// ── LLM provider helpers ─────────────────────────────────────────────────────

type LLMProvider = "anthropic" | "openai";

function detectProvider(config: Config): LLMProvider {
  const key = resolveAnthropicApiKey(config);
  if (key) return "anthropic";

  // Only check for OpenAI key if there's no Anthropic key
  const openaiKey = resolveOpenAiApiKey(config);
  if (openaiKey) return "openai";

  throw new Error(
    "No LLM API key found. Set ANTHROPIC_API_KEY or OPENAI_API_KEY " +
      "environment variable, or add 'anthropicApiKey' / 'openaiApiKey' " +
      "to ~/.replyflow/config.json",
  );
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * Minimal HTTPS POST helper. Returns the full response body as a string.
 */
function httpsPost(
  hostname: string,
  path: string,
  headers: Record<string, string>,
  body: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const req = https.request(
      `https://${hostname}${path}`,
      { method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(
                `LLM API returned HTTP ${res.statusCode}: ${data.slice(0, 500)}`,
              ),
            );
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Claude API ───────────────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = await httpsPost("api.anthropic.com", "/v1/messages", {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }, body);

  const parsed = JSON.parse(raw);
  const text = parsed.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Anthropic response missing content[0].text");
  }
  return text;
}

// ── OpenAI API ───────────────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const body = JSON.stringify({
    model: "gpt-4o",
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = await httpsPost("api.openai.com", "/v1/chat/completions", {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }, body);

  const parsed = JSON.parse(raw);
  const text = parsed.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("OpenAI response missing choices[0].message.content");
  }
  return text;
}

// ── JSON extraction helpers ──────────────────────────────────────────────────

/**
 * Try to extract a JSON object from LLM output.
 * The model may wrap it in markdown fences or add preamble text.
 */
function extractJson(raw: string): string {
  // Try to find ```json ... ``` block first
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find {...} directly (greedy, from first { to last })
  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];

  throw new Error("Could not extract JSON from LLM response");
}

/**
 * Parse and validate the LLM's drafts JSON.
 */
function parseDrafts(
  tweetId: string,
  rawJson: string,
): Draft[] {
  const cleaned = extractJson(rawJson);
  const parsed = JSON.parse(cleaned);

  if (!parsed.drafts || !Array.isArray(parsed.drafts)) {
    throw new Error("LLM response missing 'drafts' array");
  }

  const drafts: Draft[] = [];
  for (let i = 0; i < parsed.drafts.length; i++) {
    const d = parsed.drafts[i];
    const text = typeof d === "string" ? d : d?.text;
    const reason = typeof d === "string" ? "" : d?.reason ?? "";

    if (typeof text !== "string" || text.length === 0) continue;
    if (text.length > 280) continue; // skip over-long drafts

    drafts.push({
      id: `${tweetId}_${drafts.length + 1}`,
      text,
      reason: typeof reason === "string" ? reason : "",
    });
  }

  if (drafts.length === 0) {
    throw new Error("No valid drafts after filtering (all exceeded 280 chars or empty)");
  }

  return drafts;
}

// ── Main entry point ─────────────────────────────────────────────────────────

/**
 * Generate 2-3 reply drafts for a given tweet.
 *
 * 1. Fetches the tweet + context chain via Twitter API.
 * 2. Detects or uses the requested reply style.
 * 3. Calls the LLM (Claude → OpenAI) with a structured prompt.
 * 4. Returns validated drafts with reasons.
 */
export async function generateReply(
  config: Config,
  tweetId: string,
  style: ReplyStyle = "curious",
): Promise<GenerateResult> {
  try {
    // 1. Fetch tweet and its conversation context
    const context = await getTweetContext(config, tweetId);
    const post = context.root.text;

    // 2. Build prompt
    const effectiveStyle = style === "auto" ? detectStyle(post) : style;
    const contextForPrompt = {
      root: context.root.text,
      replies: context.replies.map((r) => r.text),
    };

    const systemPrompt = buildSystemPrompt({
      style,
      post,
      context: contextForPrompt,
    });

    const userPrompt = buildUserPrompt(post);

    // 3. Determine provider and call LLM
    const provider = detectProvider(config);
    const apiKey =
      provider === "anthropic"
        ? resolveAnthropicApiKey(config)!
        : resolveOpenAiApiKey(config)!;

    const rawResponse =
      provider === "anthropic"
        ? await callAnthropic(apiKey, systemPrompt, userPrompt)
        : await callOpenAI(apiKey, systemPrompt, userPrompt);

    // 4. Parse and validate drafts
    const drafts = parseDrafts(tweetId, rawResponse);

    return {
      tweetId,
      style: effectiveStyle,
      drafts: drafts.slice(0, 3),
    };
  } catch (err) {
    return {
      tweetId,
      style,
      drafts: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
