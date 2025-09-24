const axios = require("axios");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest"; // fallback to widely available model
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta"; // can be set to 'v1' if enabled

// Simple in-process protections to reduce 429s
let lastCallAt = 0;
const MIN_INTERVAL_MS = Number(process.env.GEMINI_MIN_INTERVAL_MS || 800); // min ms between calls
const aiCache = new Map(); // key -> { move, result, insights, exp }
const CACHE_TTL_MS = Number(process.env.GEMINI_CACHE_TTL_MS || 15000);

function now() {
  return Date.now();
}
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function randomMove() {
  const moves = ["rock", "paper", "scissors"];
  return moves[Math.floor(Math.random() * 3)];
}

function decideWinner(playerMove, aiMove) {
  if (playerMove === aiMove) return "draw";
  if (
    (playerMove === "rock" && aiMove === "scissors") ||
    (playerMove === "paper" && aiMove === "rock") ||
    (playerMove === "scissors" && aiMove === "paper")
  )
    return "win";
  return "lose";
}

function buildPrompt(playerHistory) {
  return `You are an AI for rock-paper-scissors. Analyze the player's move history: [${playerHistory.join(
    ", "
  )}].
    1. Pick your next move (rock, paper, or scissors).
    2. Predict the result if the player chooses their most likely next move.
    3. Give insights: most frequent move, streaks, randomness, prediction, and a short coaching hint.`;
}

async function getAIMove(playerHistory) {
  if (!GEMINI_API_KEY) {
    const ai_move = randomMove();
    return {
      move: ai_move,
      result: "draw",
      insights: "No Gemini API key set. Using random AI.",
    };
  }
  try {
    const prompt = buildPrompt(playerHistory);
    const url = `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    // Cache by history to avoid duplicate calls in quick succession
    const historyKey = Array.isArray(playerHistory) && playerHistory.length
      ? playerHistory.join(",")
      : "_none_";
    const cached = aiCache.get(historyKey);
    if (cached && cached.exp > now()) {
      return { ...cached, fromCache: true };
    }

    // Cooldown guard: if last call too recent, skip external call
    const since = now() - lastCallAt;
    if (since < MIN_INTERVAL_MS) {
      const ai_move = randomMove();
      return {
        move: ai_move,
        result: "draw",
        insights: "AI cooling down to respect rate limits. Using random AI.",
      };
    }

    // Exponential backoff wrapper for 429/503
    async function callWithRetry(maxRetries = 2) {
      let attempt = 0;
      // note the time of first attempt for cooldown
      lastCallAt = now();
      while (true) {
        try {
          const response = await axios.post(
            url,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { "Content-Type": "application/json" }, timeout: 5000 }
          );
          return response;
        } catch (error) {
          const status = error?.response?.status;
          if ((status === 429 || status === 503) && attempt < maxRetries) {
            // Honor Retry-After when present
            const ra = Number(error?.response?.headers?.["retry-after"]) || 0;
            const base = Math.pow(2, attempt) * 500;
            const jitter = Math.floor(Math.random() * 200);
            const delay = Math.max(ra * 1000, base + jitter);
            console.warn(`[gemini] ${status} rate limited, retrying in ${delay}ms (attempt ${attempt + 1})`);
            await sleep(delay);
            attempt++;
            continue;
          }
          // Non-retryable or maxed out
          throw error;
        }
      }
    }

    const response = await callWithRetry(2);

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    let ai_move = "rock",
      result = "draw",
      insights = "";
    const moveMatch = text.match(/move\s*[:\-]?\s*(rock|paper|scissors)/i);
    if (moveMatch) ai_move = moveMatch[1].toLowerCase();
    const resultMatch = text.match(/result\s*[:\-]?\s*(win|lose|draw)/i);
    if (resultMatch) result = resultMatch[1].toLowerCase();
    const insightsMatch = text.match(/insights\s*[:\-]?\s*(.*)/i);
    insights = insightsMatch ? insightsMatch[1] : text;
    const out = {
      move: ai_move,
      result,
      insights,
    };
    aiCache.set(historyKey, { ...out, exp: now() + CACHE_TTL_MS });
    return out;
  } catch (error) {
    // Sanitize logs to avoid leaking API Key (which would otherwise appear in axios error.url)
    const status = error?.response?.status;
    const msg = error?.response?.data?.error?.message || error?.message;
    console.warn(`[gemini] API error ${status || ""}: ${msg}`);
    // Helpful hint when 404/401 occurs
    if (error?.response?.status === 404) {
      console.error(`Gemini model not found. Tried: ${GEMINI_API_VERSION}/${GEMINI_MODEL}. Set GEMINI_MODEL or GEMINI_API_VERSION in .env to a supported model/version.`);
    }
    const ai_move = randomMove();
    return {
      move: ai_move,
      result: "draw",
      insights: status === 429
        ? "Gemini rate limit (429). Using random AI."
        : "Gemini API error. Using random AI.",
    };
  }
}

module.exports = { getAIMove };
