const axios = require("axios");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
    const moves = ["rock", "paper", "scissors"];
    const ai_move = moves[Math.floor(Math.random() * 3)];
    return {
      move: ai_move,
      result: "draw",
      insights: "No Gemini API key set. Using random AI.",
    };
  }
  try {
    const prompt = buildPrompt(playerHistory);
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
      {
        contents: [{ parts: [{ text: prompt }] }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GEMINI_API_KEY}`,
        },
      }
    );

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
    return {
      move: ai_move,
      result,
      insights,
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    const moves = ["rock", "paper", "scissors"];
    const ai_move = moves[Math.floor(Math.random() * 3)];
    return {
      move: ai_move,
      result: "draw",
      insights: "Gemini API error. Using random AI.",
    };
  }
}

module.exports = { getAIMove };
