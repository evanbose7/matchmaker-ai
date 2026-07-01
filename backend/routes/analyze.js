import express from "express";
import OpenAI from "openai";
import Analysis from "../models/Analysis.js";

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
function buildPrompt({ bio, photos, interests }) {
  return `You are a blunt, specific dating profile optimization expert. A stranger swiping fast should be your mental model. Analyze this dating profile:

Bio: ${bio || "(not provided)"}
Photo lineup: ${photos || "(not provided)"}
Interests/prompts: ${interests || "(not provided)"}

Respond with ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "score": <integer 1-100>,
  "scoreDesc": "<one short sentence justifying the score>",
  "strengths": ["<short specific strength>", "<short specific strength>"],
  "redFlags": ["<short specific red flag>", "<short specific red flag>", "<short specific red flag>"],
  "improvements": ["<actionable improvement>", "<actionable improvement>", "<actionable improvement>", "<actionable improvement>", "<actionable improvement>"],
  "rewriteSample": "<a rewritten bio, 2-4 sentences, natural human voice>"
}
Be specific to what they actually wrote, not generic advice. If a field was not provided, note that honestly instead of inventing details.`;
}

function safeParseJSON(text) {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

// POST /api/analyze
// Body: { sessionId, bio, photos, interests }
// Runs the full analysis once, stores it, but only returns the FREE preview slice.
// The full result stays in the DB, gated behind /api/payments/unlock/:analysisId
router.post("/", async (req, res) => {
  try {
    const { sessionId, bio, photos, interests } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing sessionId" });
    }
    if (!bio && !photos && !interests) {
      return res.status(400).json({ error: "Provide at least a bio, photo description, or interests" });
    }

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [{ role: "user", content: buildPrompt({ bio, photos, interests }) }],
    });
    const text = completion.choices[0].message.content;
    const parsed = safeParseJSON(text);

    const record = await Analysis.create({
      sessionId,
      bio,
      photos,
      interests,
      score: parsed.score,
      scoreDesc: parsed.scoreDesc,
      strengths: parsed.strengths || [],
      redFlags: parsed.redFlags || [],
      improvements: parsed.improvements || [],
      rewriteSample: parsed.rewriteSample || "",
    });

    // Free preview: score + all strengths + only first red flag
    res.json({
      analysisId: record._id,
      score: record.score,
      scoreDesc: record.scoreDesc,
      strengths: record.strengths,
      redFlagsPreview: record.redFlags.slice(0, 1),
      redFlagsRemaining: Math.max(record.redFlags.length - 1, 0),
      paid: false,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    res.status(500).json({ error: "Could not complete the audit. Try again shortly." });
  }
});

export default router;