import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true },
    bio: String,
    photos: String,
    interests: String,

    score: Number,
    scoreDesc: String,
    strengths: [String],
    redFlags: [String],
    improvements: [String],
    rewriteSample: String,

    paid: { type: Boolean, default: false },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },

    email: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Analysis", analysisSchema);
