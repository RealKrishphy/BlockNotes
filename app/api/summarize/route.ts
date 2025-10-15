import { NextRequest, NextResponse } from "next/server";
// Using direct REST call to Gemini v1 to avoid SDK/version issues

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const note: string = body?.note ?? "";
    if (!note || typeof note !== "string") {
      return NextResponse.json({ error: "Missing note" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing GEMINI_API_KEY" }, { status: 500 });
    }
    const truncated = note.length > 4000 ? note.slice(0, 4000) : note;
    const prompt = `Summarize this note concisely in 1-2 sentences.\n\nNote:\n${truncated}`;

    // Prefer stable v1 model IDs
    const models = [
      "gemini-1.5-flash-002",
      "gemini-1.5-pro-002",
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}` , {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error?.message || `Gemini ${resp.status}`);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
        if (text) return NextResponse.json({ summary: text });
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError ?? new Error("Failed to summarize");
  } catch (err: unknown) {
    console.error("[summarize] error", err);
    const message = err instanceof Error ? err.message : "Summarization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


