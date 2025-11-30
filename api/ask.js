export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Only POST allowed" });
    }

    try {
        const body = JSON.parse(req.body);
        const { messages } = body;

        if (!
            import.meta.env.VITE_OPENAI_API_KEY) {
            return res.status(500).json({ error: "OPENAI_API_KEY not configured on Vercel" });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("OpenAI API Error:", data);
            return res.status(response.status).json({ error: data.error ? .message || "OpenAI API error" });
        }

        return res.status(200).json(data);

    } catch (err) {
        console.error("Handler error:", err);
        return res.status(500).json({ error: err.message });
    }
}