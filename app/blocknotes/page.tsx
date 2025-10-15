"use client";
import React from "react";

type SavedItem = {
  title: string;
  url: string;
  createdAt: string;
};

export default function BlockNotesPage() {
  const [note, setNote] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [loading, setLoading] = React.useState<"idle" | "summarize" | "upload">("idle");
  const [history, setHistory] = React.useState<SavedItem[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("blocknotes_history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("blocknotes_history", JSON.stringify(history));
    } catch {}
  }, [history]);

  async function handleSummarize() {
    if (!note.trim()) return;
    setLoading("summarize");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const data = await res.json();
      console.log(data);
      if (!res.ok) throw new Error(data?.error || "Failed to summarize");
      setSummary(data.summary || "");
    } catch (e) {
      setSummary("Summarization failed. Try again.");
    } finally {
      setLoading("idle");
    }
  }

  async function handleUpload() {
    if (!note.trim()) return;
    setLoading("upload");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, summary: summary || "" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      const title = note.split("\n")[0].slice(0, 80) || "Untitled";
      const entry: SavedItem = { title, url: data.url, createdAt: new Date().toISOString() };
      setHistory([entry, ...history].slice(0, 50));

      // After upload succeeds, auto-run summarize in the background
      setLoading("summarize");
      try {
        await handleSummarize();
      } catch {}
    } catch (e) {
      alert("Upload failed. Check your LIGHTHOUSE_API_KEY in .env and try again.");
    } finally {
      setLoading("idle");
    }
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">BlockNotes</h1>
        <div className="rounded-xl p-4 shadow-lg bg-white">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write your note here..."
            className="w-full h-40 p-3 rounded-md bg-white text-black placeholder:opacity-60 focus:outline-none border border-black/10"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={handleSummarize} disabled={loading !== "idle"} className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50 border border-black">
              {loading === "summarize" ? "Summarizing..." : "Summarize with AI"}
            </button>
            <button onClick={handleUpload} disabled={loading !== "idle"} className="px-4 py-2 rounded-md bg-white text-black disabled:opacity-50 border border-black">
              {loading === "upload" ? "Saving..." : "Save to IPFS"}
            </button>
          </div>
          <div className="mt-4 p-3 rounded-md bg-black text-white min-h-[64px] border border-white/20">
            <div className="text-sm">{summary || "AI summary will appear here."}</div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white mt-8 mb-3">Previous Notes</h2>
        <div className="space-y-2">
          {history.length === 0 && (
            <div className="text-white/80">No saved notes yet.</div>
          )}
          {history.map((item, idx) => (
            <div key={idx} className="rounded-md p-3 flex items-center justify-between bg-white">
              <div>
                <div className="text-black font-medium">{item.title}</div>
                <div className="text-black/60 text-sm">{new Date(item.createdAt).toLocaleString()}</div>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer" className="text-black underline">View</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


