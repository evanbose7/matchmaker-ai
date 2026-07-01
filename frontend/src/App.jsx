import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const sessionId = (() => {
  let id = localStorage.getItem("mm_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mm_session", id);
  }
  return id;
})();

export default function App() {
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState("");
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!bio && !photos && !interests) {
      setError("Give me at least a bio or a photo description to work with.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, bio, photos, interests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      navigate(`/results/${data.analysisId}`, { state: { preview: data } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[1040px] mx-auto px-6">
      <nav className="flex items-center justify-between py-7">
        <div className="font-display text-xl">
          Match<span className="text-accent">Maker</span> AI
        </div>
        <div className="text-xs text-muted border border-white/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
          Profile audit, not a horoscope
        </div>
      </nav>

      <header className="pt-6 pb-2">
        <div className="text-accent2 text-xs font-semibold tracking-widest uppercase mb-3">
          Free first read · Paid full breakdown
        </div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight max-w-xl mb-4">
          Find out why your <em className="text-accent not-italic font-display italic">bio</em> isn't landing matches.
        </h1>
        <p className="text-muted max-w-md leading-relaxed mb-9">
          Paste what you've got. Get a blunt, specific read on what's working, what's quietly
          killing your matches, and exactly how to fix it.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-panel border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
      >
        <label className="block text-sm font-semibold text-muted mb-2">Your bio</label>
        <textarea
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="e.g. 28, love hiking and dogs, looking for someone real..."
          className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-3 text-sm mb-5 focus:outline-none focus:border-accent"
        />

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-muted mb-2">
              Photo lineup (describe what you've got)
            </label>
            <textarea
              rows={3}
              value={photos}
              onChange={(e) => setPhotos(e.target.value)}
              placeholder="e.g. Photo 1: gym mirror selfie. Photo 2: group photo..."
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-muted mb-2">Interests / prompts</label>
            <textarea
              rows={3}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. Travel, craft beer, my Sunday plans..."
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3.5 py-3 text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-br from-accent to-orange-400 text-[#2a1014] font-bold text-sm px-6 py-3.5 rounded-lg disabled:opacity-50"
          >
            {loading ? "Reading your profile..." : "Audit my profile"}
          </button>
          <span className="text-sm text-muted">No signup required for the free read.</span>
        </div>
        {error && <p className="text-red-300 text-sm mt-3">{error}</p>}
      </form>

      <footer className="py-14 text-center text-muted text-xs">
        MatchMaker AI is a feedback tool, not a guarantee. Be honest in the form — vague answers
        get vague advice.
      </footer>
    </div>
  );
}
