export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { system, user } = req.body;
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const options = {
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
  };
  let r = await fetch(url, options);
  if (r.status === 503) {
    await new Promise((ok) => setTimeout(ok, 1000));
    r = await fetch(url, options);
  }
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ error: data });
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  res.status(200).json({ text });
}
