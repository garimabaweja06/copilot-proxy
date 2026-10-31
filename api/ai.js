export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { system, user } = req.body;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  res.status(r.ok ? 200 : r.status).json({ text, error: r.ok ? undefined : data });
}
