import "dotenv/config";
import dns from "dns";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import analyzeRoutes from "./routes/analyze.js";
import paymentsRoutes from "./routes/payments.js";

// Windows + some networks can break Node's built-in DNS resolver for SRV lookups
// (mongodb+srv://) even when the OS resolver works fine. Forcing Node to use
// Google's DNS directly works around it.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));

// Note: the webhook route itself uses express.raw() inline (see routes/payments.js)
// because Stripe needs the raw body to verify signatures — don't double-parse it here.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/analyze", analyzeRoutes);
app.use("/api/payments", paymentsRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
