import { Router } from "express";
import { getUserInventory, addGiftToInventory, removeGiftFromInventory, getLuckMode, getRecentWins } from "../db.js";
import { verifyInitData, extractUserId } from "../lib/telegram.js";
import { loadGifts } from "./gifts.js";

const router = Router();

router.post("/inventory/sell", (req, res) => {
  const { initData, giftName } = req.body as { initData: string; giftName: string };
  if (!initData || !giftName) { res.status(400).json({ error: "initData and giftName required" }); return; }
  if (!verifyInitData(initData)) { res.status(401).json({ error: "Invalid initData" }); return; }
  const userId = extractUserId(initData);
  if (!userId) { res.status(400).json({ error: "Cannot extract user ID" }); return; }
  const removed = removeGiftFromInventory(userId, giftName);
  if (!removed) { res.status(400).json({ error: "Gift not in inventory" }); return; }
  const gifts = loadGifts();
  const giftMap = new Map(gifts.map((g: any) => [g.name, g]));
  const newInventory = getUserInventory(userId).map((n) => giftMap.get(n)).filter(Boolean);
  res.json({ ok: true, newInventory });
});

router.post("/upgrade", (req, res) => {
  const { initData, betGiftName, targetGiftName, targetUserId } = req.body as {
    initData: string;
    betGiftName: string;
    targetGiftName: string;
    targetUserId?: string;
  };

  if (!initData || !betGiftName || !targetGiftName) {
    res.status(400).json({ error: "initData, betGiftName, and targetGiftName required" });
    return;
  }

  if (!verifyInitData(initData)) {
    res.status(401).json({ error: "Invalid initData" });
    return;
  }

  const callerUserId = extractUserId(initData);
  if (!callerUserId) {
    res.status(400).json({ error: "Cannot extract user ID" });
    return;
  }
  // targetUserId is reserved for admin use only — ignore it from the client to prevent IDOR
  const userId = callerUserId;

  const gifts = loadGifts();
  const giftMap = new Map(gifts.map((g: any) => [g.name, g]));

  const betGift = giftMap.get(betGiftName);
  const targetGift = giftMap.get(targetGiftName);

  if (!betGift) {
    res.status(400).json({ error: "Bet gift not found" });
    return;
  }
  if (!targetGift) {
    res.status(400).json({ error: "Target gift not found" });
    return;
  }
  if (betGift.price >= targetGift.price) {
    res.status(400).json({ error: "Target gift must be more expensive than bet gift" });
    return;
  }

  const inventory = getUserInventory(userId);
  if (!inventory.includes(betGiftName)) {
    res.status(400).json({ error: "Bet gift not in inventory" });
    return;
  }

  // Calculate win chance (capped at 82%)
  const chance = Math.min((betGift.price / targetGift.price) * 100, 82);

  // Determine outcome
  const luckMode = getLuckMode();
  let win: boolean;
  if (luckMode === "force_win") {
    win = true;
  } else if (luckMode === "force_lose") {
    win = false;
  } else {
    const HOUSE_EDGE = 0.75; // 82% displayed → ~61.5% real
    const roll = Math.random() * 100;
    win = roll < chance * HOUSE_EDGE;
  }

  // Remove bet gift
  removeGiftFromInventory(userId, betGiftName);

  // If win, add target gift
  if (win) {
    addGiftToInventory(userId, targetGiftName);
  }

  // Return updated inventory
  const updatedNames = getUserInventory(userId);
  const newInventory = updatedNames.map((name) => giftMap.get(name)).filter(Boolean);

  res.json({ win, chance: Math.round(chance * 100) / 100, newInventory });
});

router.get("/live-wins", (_req, res) => {
  res.json(getRecentWins(30));
});

export default router;
