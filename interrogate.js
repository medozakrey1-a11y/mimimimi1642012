
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { systemPrompt, messages } = req.body || {};

    if (!systemPrompt || !Array.isArray(messages) || !messages.length) {
      return res.status(400).json({
        error: "بيانات الاستجواب غير مكتملة."
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "مفتاح Gemini غير موجود على الخادم."
      });
    }

    const contents = messages
      .slice(-30)
      .filter(m =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
      )
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 6000) }]
      }));

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt.slice(0, 24000) }]
          },
          contents,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 700
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(502).json({
        error: data?.error?.message || "فشل الاتصال بـ Gemini."
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "لم يتم الحصول على رد من Gemini."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: "حدث خطأ داخلي في الخادم."
    });
  }
};
