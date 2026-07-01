import React, { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";

const API = "https://matchmaker-ai-production.up.railway.app";

export default function ResultsPage() {
  const { analysisId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const justPaid = searchParams.get("paid") === "1";

  const [data, setData] = useState(location.state?.preview || null);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [waitingForPayment, setWaitingForPayment] = useState(justPaid);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!justPaid) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 6;
    async function poll() {
      attempts += 1;
      try {
        const res = await fetch(`${API}/api/payments/unlock/${analysisId}`);
        const full = await res.json();
        if (cancelled) return;
        if (res.ok && full.paid) {
          setData(full);
          setUnlocked(true);
          setWaitingForPayment(false);
          return;
        }
      } catch {}
      if (attempts < maxAttempts) setTimeout(poll, 1000);
      else if (!cancelled) {
        setWaitingForPayment(false);
        setError("Payment is processing — refresh this page in a few seconds.");
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [justPaid, analysisId]);

  async function handleUnlock() {
    setCheckingOut(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "Could not create order");

      // Load Razorpay script dynamically
      await new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "MatchMaker AI",
        description: "Full Profile Audit",
        order_id: order.orderId,
        handler: async (response) => {
          // Verify payment on backend
          const verifyRes = await fetch(`${API}/api/payments/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              analysisId,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            // Fetch full results
            const unlockRes = await fetch(`${API}/api/payments/unlock/${analysisId}`);
            const full = await unlockRes.json();
            if (full.paid) {
              setData(full);
              setUnlocked(true);
            }
          } else {
            setError("Payment verification failed — contact support.");
          }
        },
        prefill: { name: "", email: "" },
        theme: { color: "#ff6b5e" },
        modal: {
          ondismiss: () => setCheckingOut(false),
        },
      });
      rzp.open();
    } catch (err) {
      setError(err.message);
      setCheckingOut(false);
    }
  }

  if (waitingForPayment) {
    return (
      <div className="max-w-[1040px] mx-auto px-6 py-20 text-center text-muted">
        Confirming your payment...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-[1040px] mx-auto px-6 py-20 text-center text-muted">
        No results loaded directly — go back and{" "}
        <Link to="/" className="text-accent underline">run an audit</Link>.
      </div>
    );
  }

  const circumference = 226;
  const score = Math.max(1, Math.min(100, Number(data.score) || 50));
  const offset = circumference - (circumference * score) / 100;

  return (
    <div className="max-w-[1040px] mx-auto px-6">
      <nav className="py-7">
        <Link to="/" className="font-display text-xl">
          Match<span className="text-accent">Maker</span> AI
        </Link>
      </nav>

      <div className="bg-panel border border-white/10 rounded-2xl p-8">
        <div className="flex items-center gap-6 py-5 border-y border-white/10 mb-6">
          <div className="relative w-[84px] h-[84px] flex-none">
            <svg width="84" height="84" viewBox="0 0 84 84" className="-rotate-90">
              <circle cx="42" cy="42" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="42" cy="42" r="36" fill="none" stroke="#ff6b5e" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-display text-xl">{score}</div>
          </div>
          <div>
            <div className="font-display text-lg mb-1">Attraction Score</div>
            <div className="text-muted text-sm">{data.scoreDesc}</div>
          </div>
        </div>

        <div className="text-xs uppercase tracking-widest text-accent2 font-bold mb-3">What's working</div>
        <ul className="mb-7">
          {(data.strengths || []).map((s, i) => (
            <li key={i} className="py-2.5 text-sm border-b border-dashed border-white/10 last:border-0">+ {s}</li>
          ))}
        </ul>

        <div className="text-xs uppercase tracking-widest text-accent2 font-bold mb-3">
          {unlocked ? "All red flags" : "Red flags (free preview)"}
        </div>
        <ul className="mb-7">
          {(unlocked ? data.redFlags : data.redFlagsPreview || []).map((f, i) => (
            <li key={i} className="py-2.5 text-sm border-b border-dashed border-white/10 last:border-0">! {f}</li>
          ))}
          {!unlocked && data.redFlagsRemaining > 0 && (
            <li className="py-2.5 text-sm opacity-40">
              {data.redFlagsRemaining} more red flag{data.redFlagsRemaining > 1 ? "s" : ""} — unlock to see
            </li>
          )}
        </ul>

        {!unlocked && (
          <div className="border border-accent2/30 bg-accent2/5 rounded-xl p-6">
            <div className="font-display text-xl mb-2">The full audit is still locked.</div>
            <p className="text-muted text-sm mb-4 max-w-md">
              Unlock every red flag, all 5 specific rewrites, and a ready-to-paste bio — written in your voice, not a template.
            </p>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-display text-3xl text-accent2">$4.99</span>
              <span className="text-sm text-muted">one-time · this profile</span>
            </div>
            <button onClick={handleUnlock} disabled={checkingOut}
              className="bg-accent2 text-[#3a2300] font-bold text-sm px-5 py-3 rounded-lg disabled:opacity-50">
              {checkingOut ? "Opening payment..." : "Unlock full audit"}
            </button>
            {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
          </div>
        )}

        {unlocked && (
          <>
            <div className="text-xs uppercase tracking-widest text-accent2 font-bold mb-3">5 specific improvements</div>
            <ul className="mb-7">
              {(data.improvements || []).map((s, i) => (
                <li key={i} className="py-2.5 text-sm border-b border-dashed border-white/10 last:border-0">+ {s}</li>
              ))}
            </ul>
            <div className="text-xs uppercase tracking-widest text-accent2 font-bold mb-3">Rewritten bio sample</div>
            <div className="bg-black/20 border border-white/10 rounded-xl px-5 py-4 italic text-sm leading-relaxed">
              {data.rewriteSample}
            </div>
          </>
        )}
      </div>
    </div>
  );
}