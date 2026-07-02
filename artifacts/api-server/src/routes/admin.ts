import { Router } from "express";
import { addGiftToInventory, getLuckMode } from "../db.js";
import { updatePrices } from "../priceUpdater.js";
import { clearGiftsCache } from "./gifts.js";

const router = Router();

const ADMIN_TOKEN = process.env["ADMIN_TELEGRAM_ID"] ?? "";

function checkAdmin(req: any, res: any): boolean {
  const token = req.headers["x-admin-token"] as string;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

router.post("/admin/give", (req, res) => {
  if (!checkAdmin(req, res)) return;
  const { telegram_id, gift_name } = req.body as { telegram_id: string; gift_name: string };
  if (!telegram_id || !gift_name) {
    res.status(400).json({ error: "telegram_id and gift_name required" });
    return;
  }
  addGiftToInventory(String(telegram_id), gift_name);
  res.json({ success: true });
});

router.get("/admin/status", (req, res) => {
  if (!checkAdmin(req, res)) return;
  res.json({ luck_mode: getLuckMode() });
});

router.post("/admin/update-prices", async (req, res) => {
  if (!checkAdmin(req, res)) return;
  try {
    clearGiftsCache();
    const result = await updatePrices();
    clearGiftsCache();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
