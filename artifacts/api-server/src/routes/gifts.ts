import { Router } from "express";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getUserInventory } from "../db.js";
import { verifyInitData, extractUserId } from "../lib/telegram.js";

const router = Router();

let giftsCache: any[] | null = null;

function loadGifts(): any[] {
  if (giftsCache) return giftsCache;
  const giftsPath = path.resolve(process.cwd(), "gifts.json");
  giftsCache = JSON.parse(readFileSync(giftsPath, "utf-8"));
  return giftsCache!;
}

export function clearGiftsCache(): void {
  giftsCache = null;
}

router.get("/gifts", (_req, res) => {
  const gifts = loadGifts();
  const sorted = [...gifts].sort((a, b) => a.price - b.price);
  res.json(sorted);
});

router.get("/inventory", (req, res) => {
  const initData = req.query["initData"] as string;

  if (!initData) {
    res.status(400).json({ error: "initData required" });
    return;
  }

  if (!verifyInitData(initData)) {
    res.status(401).json({ error: "Invalid initData" });
    return;
  }

  const userId = extractUserId(initData);
  if (!userId) {
    res.status(400).json({ error: "Cannot extract user ID" });
    return;
  }

  const gifts = loadGifts();
  const giftMap = new Map(gifts.map((g) => [g.name, g]));
  const inventoryNames = getUserInventory(userId);
  const inventory = inventoryNames.map((name) => giftMap.get(name)).filter(Boolean);

  res.json({ inventory });
});

export { loadGifts };
export default router;
