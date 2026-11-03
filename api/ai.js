export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { system, user } = body;
  if (!user) return res.status(400).json({ error: "missing user" });

// 1) Try Groq first (Gemini has been overloaded)
  const q = await groq(system, user);
  if (q.ok) {
    console.log("provider: groq");
    return res.status(200).json({ text: q.text });
  }

  // 2) Groq failed, so try Gemini
  const g = await gemini(system, user);
  if (g.ok) {
    console.log("provider: gemini (groq status " + q.status + ")");
    return res.status(200).json({ text: g.text });
  }

  console.log("both failed: groq " + q.status + ", gemini " + g.status);
  return res.status(q.status === 429 || g.status === 429 ? 429 : 503).json({ error: "all providers failed" });

async function gemini(system, user) {
  try {
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY || "",
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system || "" }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );
    if (!r.ok) return { ok: false, status: r.status };
    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, status: 502 };
    return { ok: true, status: 200, text };
  } catch (e) {
    return { ok: false, status: 500 };
  }
}

async function groq(system, user) {
  try {
    if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
      return { ok: false, status: 0 };
    }
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL,
        messages: [
          { role: "system", content: system || "" },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        max_completion_tokens: 1024,
      }),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, status: 502 };
    return { ok: true, status: 200, text };
  } catch (e) {
    return { ok: false, status: 500 };
  }
}
