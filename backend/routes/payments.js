import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Analysis from "../models/Analysis.js";

const router = express.Router();
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PRICE_INR_PAISE = 41500; // ~$4.99 in INR paise (₹415 = 41500 paise)

// POST /api/payments/create-order
router.post("/create-order", async (req, res) => {
  try {
    const { analysisId } = req.body;
    const record = await Analysis.findById(analysisId);
    if (!record) return res.status(404).json({ error: "Analysis not found" });

    const order = await razorpay.orders.create({
      amount: PRICE_INR_PAISE,
      currency: "INR",
      receipt: String(record._id),
      notes: { analysisId: String(record._id) },
    });

    record.stripeSessionId = order.id;
    await record.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      analysisId: String(record._id),
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Could not create payment order" });
  }
});

// POST /api/payments/verify
router.post("/verify", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, analysisId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const record = await Analysis.findByIdAndUpdate(
      analysisId,
      { paid: true, stripePaymentIntentId: razorpay_payment_id },
      { new: true }
    );

    if (!record) return res.status(404).json({ error: "Analysis not found" });

    res.json({ success: true, analysisId });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});

// GET /api/payments/unlock/:analysisId
router.get("/unlock/:analysisId", async (req, res) => {
  const record = await Analysis.findById(req.params.analysisId);
  if (!record) return res.status(404).json({ error: "Analysis not found" });
  if (!record.paid) return res.status(402).json({ error: "Payment required" });

  res.json({
    analysisId: record._id,
    score: record.score,
    scoreDesc: record.scoreDesc,
    strengths: record.strengths,
    redFlags: record.redFlags,
    improvements: record.improvements,
    rewriteSample: record.rewriteSample,
    paid: true,
  });
});

export default router;