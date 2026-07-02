import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { logger } from "./lib/logger.js";

const GIFTS_PATH = path.resolve(process.cwd(), "gifts.json");
const CONFIG_PATH = path.resolve(process.cwd(), "price_config.json");

const STAR_USD = 0.013;

interface PriceConfig {
  baseTonUsd: number;
  lastUpdated: string;
}

function loadConfig(): PriceConfig | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as PriceConfig;
  } catch {
    return null;
  }
}

function saveConfig(cfg: PriceConfig): void {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

async function fetchTonUsd(): Promise<number> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      "https://fragment.com/stars/buy",
      {
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json",
        },
      }
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json() as { s?: { tonRate?: number } };
      const rate = json?.s?.tonRate;
      if (rate && rate > 0) {
        logger.info({ rate }, "TON/USD from Fragment");
        return rate;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Fragment fetch failed, trying tonapi fallback");
  }

  const ctrl2 = new AbortController();
  const timer2 = setTimeout(() => ctrl2.abort(), 8000);
  const res2 = await fetch(
    "https://tonapi.io/v2/rates?tokens=ton&currencies=usd",
    { signal: ctrl2.signal, headers: { Accept: "application/json" } }
  );
  clearTimeout(timer2);
  const json2 = await res2.json() as { rates?: { TON?: { prices?: { USD?: number } } } };
  const rate2 = json2?.rates?.TON?.prices?.USD;
  if (!rate2 || rate2 <= 0) throw new Error("Cannot fetch TON/USD rate");
  logger.info({ rate: rate2 }, "TON/USD from tonapi fallback");
  return rate2;
}

export async function updatePrices(): Promise<{ updated: number; oldRate: number; newRate: number }> {
  const newTonUsd = await fetchTonUsd();
  const cfg = loadConfig();

  const gifts: { name: string; price: number; image: string }[] = JSON.parse(
    readFileSync(GIFTS_PATH, "utf-8")
  );

  let updated = 0;
  let oldRate = newTonUsd;

  if (cfg && cfg.baseTonUsd > 0) {
    oldRate = cfg.baseTonUsd;
    const ratio = newTonUsd / cfg.baseTonUsd;

    if (Math.abs(ratio - 1) > 0.001) {
      for (const gift of gifts) {
        const newPrice = Math.max(1, Math.round(gift.price * ratio));
        if (newPrice !== gift.price) {
          gift.price = newPrice;
          updated++;
        }
      }
      writeFileSync(GIFTS_PATH, JSON.stringify(gifts, null, 2), "utf-8");
      logger.info({ updated, ratio: ratio.toFixed(4) }, "Gift prices updated");
    } else {
      logger.info("TON/USD change <0.1%, skipping price update");
    }
  } else {
    logger.info({ rate: newTonUsd }, "Initialising price_config.json with current rate");
  }

  saveConfig({ baseTonUsd: newTonUsd, lastUpdated: new Date().toISOString() });
  return { updated, oldRate, newRate: newTonUsd };
}

export function scheduleDaily(fn: () => Promise<void>): void {
  const run = () => {
    fn().catch((err) => logger.error({ err }, "Scheduled price update failed"));
  };

  const msUntilMidnight = () => {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(0, 5, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  };

  const schedule = () => {
    const delay = msUntilMidnight();
    logger.info({ hoursUntil: (delay / 3_600_000).toFixed(1) }, "Next price update scheduled");
    setTimeout(() => {
      run();
      setInterval(run, 24 * 60 * 60 * 1000);
    }, delay);
  };

  schedule();
}
