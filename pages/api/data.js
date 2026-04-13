import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = "project20l:data";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    try {
      const data = await redis.get(KEY);
      return res.status(200).json({ data: data || null });
    } catch (err) {
      console.error("Redis GET error:", err);
      return res.status(500).json({ error: "Failed to load data" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body;
      await redis.set(KEY, JSON.stringify(body));
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Redis SET error:", err);
      return res.status(500).json({ error: "Failed to save data" });
    }
  }

  return res.status(405).end();
}
