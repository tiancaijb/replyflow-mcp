import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TwitterApi } from "twitter-api-v2";

const CONFIG_PATH = join(homedir(), ".replyflow", "config.json");
const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

const key = process.env.TWITTER_API_KEY || cfg.twitterApiKey;
const secret = process.env.TWITTER_API_SECRET || cfg.twitterApiSecret;

console.log("Key:", key?.slice(0, 8) + "...");

const client = new TwitterApi({ appKey: key, appSecret: secret });
const bearer = await client.appLogin();
const result = await bearer.v2.search('"indie dev" -is:retweet lang:en', {
  "tweet.fields": ["public_metrics"],
  "user.fields": ["username"],
  expansions: ["author_id"],
  max_results: 5,
});
console.log("Tweets found:", result.tweets?.length || 0);
if (result.tweets?.length) {
  for (const t of result.tweets.slice(0, 3)) {
    console.log("-", t.text?.slice(0, 120));
  }
}
