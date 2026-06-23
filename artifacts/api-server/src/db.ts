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

export function getLuckMode(): string {
  const stmt = db.prepare("SELECT value FROM admin_settings WHERE key = 'luck_mode'");
  const row = stmt.get() as { value: string } | undefined;
  return row?.value ?? "normal";
}

export function setLuckMode(mode: "normal" | "force_win" | "force_lose"): void {
  db.prepare("INSERT OR REPLACE INTO admin_settings (key, value) VALUES ('luck_mode', ?)").run(mode);
}

export default db;
