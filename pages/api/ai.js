import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).end();

  const { messages, context } = req.body;

  if (!messages || !context) {
    return res.status(400).json({ error: "Missing messages or context" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: context,
        messages: messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error("Anthropic error:", err);
      return res.status(500).json({ error: "Anthropic API error", detail: err });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || "";

    if (!text) {
      console.error("Empty response from Anthropic:", JSON.stringify(data));
      return res.status(500).json({ error: "Empty response", raw: data });
    }

    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error("AI handler error:", err);
    return res.status(500).json({ error: "Server error", detail: err.message });
  }
}
