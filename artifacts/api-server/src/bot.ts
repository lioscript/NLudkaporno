import { createRequire } from "module";
import { addGiftToInventory, getLuckMode, setLuckMode } from "./db.js";
import { logger } from "./lib/logger.js";
import { readFileSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
const ADMIN_ID = process.env["ADMIN_TELEGRAM_ID"]?.replace(/\D/g, "") || undefined;

let bot: any = null;

// State: chatId → 'user_id' (waiting for user to type a Telegram ID)
const AWAITING: Map<string, string> = new Map();

const PER_PAGE = 8;

function getGifts(): { name: string; price: number }[] {
  try {
    const p = path.resolve(process.cwd(), "gifts.json");
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

function adminPanelMsg() {
  const mode = getLuckMode();
  const modeLabel =
    mode === "force_win" ? "🟢 Force WIN" :
    mode === "force_lose" ? "🔴 Force LOSE" : "⚪ Звичайний";
  return {
    text: `🛡 *Адмін панель*\nПоточний режим удачі: ${modeLabel}`,
    opts: {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Force WIN", callback_data: "a:win" }, { text: "🔴 Force LOSE", callback_data: "a:lose" }],
          [{ text: "⚪ Скинути удачу", callback_data: "a:reset" }],
          [{ text: "🎁 Видати подарок гравцю", callback_data: "a:give" }],
        ]
      }
    }
  };
}

function giftsKeyboard(targetId: string, page: number) {
  const gifts = getGifts();
  const totalPages = Math.ceil(gifts.length / PER_PAGE);
  const slice = gifts.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const rows: any[] = slice.map((g, i) => {
    const idx = page * PER_PAGE + i;
    return [{ text: `🎁 ${g.name}  ⭐${g.price}`, callback_data: `g:${targetId}:${idx}` }];
  });

  const nav: any[] = [];
  if (page > 0) nav.push({ text: "◀ Назад", callback_data: `gp:${targetId}:${page - 1}` });
  nav.push({ text: `${page + 1} / ${totalPages}`, callback_data: "noop" });
  if (page < totalPages - 1) nav.push({ text: "Далі ▶", callback_data: `gp:${targetId}:${page + 1}` });
  rows.push(nav);
  rows.push([{ text: "🔙 До панелі", callback_data: "a:panel" }]);

  return { inline_keyboard: rows };
}

export function startBot(): void {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return;
  }

  const TelegramBot = require("node-telegram-bot-api");
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  // /start
  bot.onText(/\/start/, (msg: any) => {
    const chatId = msg.chat.id;
    const miniAppUrl = process.env["MINI_APP_URL"] ?? "https://t.me";
    bot.sendMessage(chatId, "🎁 Ласкаво просимо до NFT Gift Upgrader!\n\nНатисніть кнопку нижче щоб відкрити додаток.", {
      reply_markup: {
        inline_keyboard: [[{ text: "🎰 Відкрити апгрейдер", web_app: { url: miniAppUrl } }]]
      }
    });
  });

  // /myid
  bot.onText(/\/myid/, (msg: any) => {
    bot.sendMessage(msg.chat.id, `🆔 Ваш Telegram ID: \`${msg.from?.id}\``, { parse_mode: "Markdown" });
  });

  // /adm
  bot.onText(/\/adm/, (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.sendMessage(chatId, `❌ Немає доступу.\nВаш ID: \`${msg.from?.id}\``, { parse_mode: "Markdown" });
      return;
    }
    AWAITING.delete(chatId); // clear any pending state
    const { text, opts } = adminPanelMsg();
    bot.sendMessage(chatId, text, opts);
  });

  // Callback queries
  bot.on("callback_query", (query: any) => {
    const chatId = String(query.message.chat.id);
    const userId = String(query.from?.id);
    const data: string = query.data ?? "";

    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.answerCallbackQuery(query.id, { text: "Немає доступу." });
      return;
    }
    bot.answerCallbackQuery(query.id);

    // Admin panel actions: a:win / a:lose / a:reset / a:give / a:panel
    if (data === "a:win") {
      setLuckMode("force_win");
      bot.sendMessage(chatId, "✅ Режим Force WIN активовано. Всі апгрейди виграють.");
    } else if (data === "a:lose") {
      setLuckMode("force_lose");
      bot.sendMessage(chatId, "✅ Режим Force LOSE активовано. Всі апгрейди програють.");
    } else if (data === "a:reset") {
      setLuckMode("normal");
      bot.sendMessage(chatId, "✅ Удача скинута до звичайного режиму.");
    } else if (data === "a:panel") {
      AWAITING.delete(chatId);
      const { text, opts } = adminPanelMsg();
      bot.sendMessage(chatId, text, opts);

    // Give gift: ask for user ID
    } else if (data === "a:give") {
      AWAITING.set(chatId, "user_id");
      bot.sendMessage(chatId, "👤 Введіть Telegram ID гравця, якому видаємо подарок:", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Скасувати", callback_data: "a:panel" }]] }
      });

    // Gift page navigation: gp:{targetId}:{page}
    } else if (data.startsWith("gp:")) {
      const [, targetId, pageStr] = data.split(":");
      const page = parseInt(pageStr, 10);
      bot.sendMessage(chatId, `🎁 Оберіть подарок для гравця \`${targetId}\` (стор. ${page + 1}):`, {
        parse_mode: "Markdown",
        reply_markup: giftsKeyboard(targetId, page),
      });

    // Give specific gift: g:{targetId}:{giftIndex}
    } else if (data.startsWith("g:")) {
      const parts = data.split(":");
      const targetId = parts[1];
      const idx = parseInt(parts[2], 10);
      const gifts = getGifts();
      const gift = gifts[idx];
      if (!gift) {
        bot.sendMessage(chatId, "❌ Подарок не знайдено.");
        return;
      }
      addGiftToInventory(targetId, gift.name);
      bot.sendMessage(chatId,
        `✅ Подарок *${gift.name}* (⭐${gift.price}) видано гравцю \`${targetId}\`!`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // Text messages — only used when waiting for user ID input
  bot.on("message", (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) return;
    if (!msg.text || msg.text.startsWith("/")) return;
    if (AWAITING.get(chatId) !== "user_id") return;

    const targetId = msg.text.trim().replace(/\D/g, "");
    if (!targetId) {
      bot.sendMessage(chatId, "❌ Невірний ID. Введіть тільки цифри (наприклад: 123456789):", {
        reply_markup: { inline_keyboard: [[{ text: "❌ Скасувати", callback_data: "a:panel" }]] }
      });
      return;
    }

    AWAITING.delete(chatId);
    bot.sendMessage(chatId, `👤 Гравець \`${targetId}\`\n\n🎁 Оберіть подарок:`, {
      parse_mode: "Markdown",
      reply_markup: giftsKeyboard(targetId, 0),
    });
  });

  logger.info("Telegram bot started");
}

export function stopBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}
