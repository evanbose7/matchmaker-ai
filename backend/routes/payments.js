import express from "express";
import Stripe from "stripe";
import Analysis from "../models/Analysis.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/payments/create-checkout-session
// Body: { analysisId }
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { analysisId } = req.body;
    const record = await Analysis.findById(analysisId);
    if (!record) return res.status(404).json({ error: "Analysis not found" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // $4.99 one-time price configured in Stripe dashboard
          quantity: 1,
        },
      ],
      metadata: { analysisId: String(record._id) },
      success_url: `${process.env.CLIENT_URL}/results/${record._id}?paid=1`,
      cancel_url: `${process.env.CLIENT_URL}/results/${record._id}?paid=0`,
    });

    record.stripeSessionId = session.id;
    await record.save();

    res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    res.status(500).json({ error: "Could not start checkout" });
  }
});

// POST /api/payments/webhook
// IMPORTANT: this route must use express.raw() body parsing — see server.js
router.post("/webhook",  async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const analysisId = session.metadata?.analysisId;
    if (analysisId) {
      await Analysis.findByIdAndUpdate(analysisId, {
        paid: true,
        stripePaymentIntentId: session.payment_intent,
      });
    }
  }

  res.json({ received: true });
});

// GET /api/payments/unlock/:analysisId
// Frontend polls/calls this after redirect back from Stripe to fetch full results
router.get("/unlock/:analysisId", async (req, res) => {
  const record = await Analysis.findById(req.params.analysisId);
  if (!record) return res.status(404).json({ error: "Analysis not found" });

  // If already marked paid in DB, return immediately
  if (record.paid) {
    return res.json({
      analysisId: record._id,
      score: record.score,
      scoreDesc: record.scoreDesc,
      strengths: record.strengths,
      redFlags: record.redFlags,
      improvements: record.improvements,
      rewriteSample: record.rewriteSample,
      paid: true,
    });
  }

  // Not marked paid yet — check Stripe directly in case webhook hasn't fired
  if (record.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(record.stripeSessionId);
      if (session.payment_status === "paid") {
        // Mark paid in DB now
        record.paid = true;
        record.stripePaymentIntentId = session.payment_intent;
        await record.save();
        return res.json({
          analysisId: record._id,
          score: record.score,
          scoreDesc: record.scoreDesc,
          strengths: record.strengths,
          redFlags: record.redFlags,
          improvements: record.improvements,
          rewriteSample: record.rewriteSample,
          paid: true,
        });
      }
    } catch (err) {
      console.error("Stripe session check error:", err);
    }
  }

  return res.status(402).json({ error: "Payment required" });
});

export default router;
