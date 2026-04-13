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
    } catch {
      return res.status(500).json({ error: "Failed to load data" });
    }
  }

  if (req.method === "POST") {
    try {
      await redis.set(KEY, req.body);
      return res.status(200).json({ ok: true });
    } catch {
      return res.status(500).json({ error: "Failed to save data" });
    }
  }

  return res.status(405).end();
}
