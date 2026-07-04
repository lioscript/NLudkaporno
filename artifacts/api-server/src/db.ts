import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { mkdirSync } from "node:fs";

const dbDir = path.resolve(process.cwd(), "data");
mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, "upgrader.sqlite");

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    gift_name TEXT NOT NULL,
    acquired_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS upgrade_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT NOT NULL,
    winner_name TEXT NOT NULL DEFAULT 'Игрок',
    bet_gift TEXT NOT NULL,
    target_gift TEXT NOT NULL,
    target_price INTEGER NOT NULL,
    won_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('luck_mode', 'normal');
`);

export function getUserInventory(telegramId: string): string[] {
  const stmt = db.prepare("SELECT gift_name FROM inventory WHERE telegram_id = ?");
  const rows = stmt.all(telegramId) as { gift_name: string }[];
  return rows.map((r) => r.gift_name);
}

export function addGiftToInventory(telegramId: string, giftName: string): void {
  db.prepare("INSERT INTO inventory (telegram_id, gift_name) VALUES (?, ?)").run(telegramId, giftName);
}

export function removeGiftFromInventory(telegramId: string, giftName: string): boolean {
  const stmt = db.prepare("SELECT id FROM inventory WHERE telegram_id = ? AND gift_name = ? LIMIT 1");
  const row = stmt.get(telegramId, giftName) as { id: number } | undefined;
  if (!row) return false;
  db.prepare("DELETE FROM inventory WHERE id = ?").run(row.id);
  return true;
}

export function getLuckMode(userId?: string): string {
  if (userId) {
    const stmt = db.prepare("SELECT value FROM admin_settings WHERE key = ?");
    const row = stmt.get(`luck_mode_${userId}`) as { value: string } | undefined;
    if (row) return row.value;
  }
  const stmt = db.prepare("SELECT value FROM admin_settings WHERE key = 'luck_mode'");
  const row = stmt.get() as { value: string } | undefined;
  return row?.value ?? "normal";
}

export function setLuckMode(mode: "normal" | "force_win" | "force_lose", userId?: string): void {
  const key = userId ? `luck_mode_${userId}` : "luck_mode";
  if (mode === "normal") {
    db.prepare("DELETE FROM admin_settings WHERE key = ?").run(key);
  } else {
    db.prepare("INSERT OR REPLACE INTO admin_settings (key, value) VALUES (?, ?)").run(key, mode);
  }
}

export function recordWin(
  telegramId: string,
  winnerName: string,
  betGift: string,
  targetGift: string,
  targetPrice: number
): void {
  db.prepare(
    "INSERT INTO upgrade_history (telegram_id, winner_name, bet_gift, target_gift, target_price) VALUES (?, ?, ?, ?, ?)"
  ).run(telegramId, winnerName, betGift, targetGift, targetPrice);
}

export function getRecentWins(limit = 20): { winner_name: string; bet_gift: string; target_gift: string; target_price: number; won_at: string }[] {
  return db
    .prepare("SELECT winner_name, bet_gift, target_gift, target_price, won_at FROM upgrade_history ORDER BY id DESC LIMIT ?")
    .all(limit) as any[];
}

export default db;
