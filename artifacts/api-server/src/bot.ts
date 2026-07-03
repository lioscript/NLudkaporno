import { createRequire } from "module";
import { addGiftToInventory, getLuckMode, setLuckMode } from "./db.js";
import { logger } from "./lib/logger.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { updatePrices } from "./priceUpdater.js";
import { clearGiftsCache } from "./routes/gifts.js";

const require = createRequire(import.meta.url);

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
const ADMIN_ID = process.env["ADMIN_TELEGRAM_ID"]?.replace(/\D/g, "") || undefined;

let bot: any = null;

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

function playerPanelMsg(targetId: string) {
  const mode = getLuckMode();
  const modeLabel =
    mode === "force_win" ? "🟢 Force WIN" :
    mode === "force_lose" ? "🔴 Force LOSE" : "⚪ Обычный";
  return {
    text: `👤 Игрок: \`${targetId}\`\n\nТекущий режим удачи: ${modeLabel}`,
    opts: {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🎁 Выдать подарок", callback_data: `a:give:${targetId}` }],
          [
            { text: "🟢 Force WIN", callback_data: `a:win:${targetId}` },
            { text: "🔴 Force LOSE", callback_data: `a:lose:${targetId}` },
          ],
          [{ text: "⚪ Сбросить удачу", callback_data: `a:reset:${targetId}` }],
          [{ text: "🔙 Сменить игрока", callback_data: "a:back" }],
        ],
      },
    },
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
  if (page < totalPages - 1) nav.push({ text: "Далее ▶", callback_data: `gp:${targetId}:${page + 1}` });
  rows.push(nav);
  rows.push([{ text: "🔙 К игроку", callback_data: `a:panel:${targetId}` }]);

  return { inline_keyboard: rows };
}

function askForPlayerId(chatId: string) {
  AWAITING.set(chatId, "player_id");
  bot.sendMessage(chatId, "👤 Введите Telegram ID игрока:", {
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Отмена", callback_data: "a:cancel" }]],
    },
  });
}

export async function startBot(): Promise<void> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return;
  }

  const TelegramBot = require("node-telegram-bot-api");

  // Delete any existing webhook so polling works correctly
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    logger.info("Webhook deleted, starting polling");
  } catch (e) {
    logger.warn({ e }, "Could not delete webhook");
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  // /start
  bot.onText(/\/start/, (msg: any) => {
    const chatId = msg.chat.id;
    const replitDomain = process.env["REPLIT_DEV_DOMAIN"];
    const miniAppUrl = replitDomain
      ? `https://${replitDomain}/api`
      : (process.env["MINI_APP_URL"] ?? "https://t.me");
    bot.sendMessage(
      chatId,
      "🎁 Добро пожаловать в NFT Gift Upgrader!\n\nНажмите кнопку ниже, чтобы открыть приложение.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎰 Открыть апгрейдер", web_app: { url: miniAppUrl } }],
          ],
        },
      }
    );
  });

  // /myid
  bot.onText(/\/myid/, (msg: any) => {
    bot.sendMessage(msg.chat.id, `🆔 Ваш Telegram ID: \`${msg.from?.id}\``, {
      parse_mode: "Markdown",
    });
  });

  // /adm — ask for player ID first
  bot.onText(/\/adm/, (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.sendMessage(chatId, `❌ Нет доступа.\nВаш ID: \`${msg.from?.id}\``, {
        parse_mode: "Markdown",
      });
      return;
    }
    askForPlayerId(chatId);
  });

  // /prices — manually trigger price update
  bot.onText(/\/prices/, async (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.sendMessage(chatId, `❌ Нет доступа.`);
      return;
    }
    const wait = await bot.sendMessage(chatId, "⏳ Обновляю цены по курсу TON/USD...");
    try {
      clearGiftsCache();
      const { updated, oldRate, newRate } = await updatePrices();
      clearGiftsCache();
      const pct = ((newRate / oldRate - 1) * 100).toFixed(2);
      const sign = parseFloat(pct) >= 0 ? "+" : "";
      bot.editMessageText(
        `✅ *Цены обновлены*\n\n` +
        `💹 TON/USD: $${oldRate.toFixed(4)} → $${newRate.toFixed(4)} (${sign}${pct}%)\n` +
        `🎁 Изменено: ${updated} из ${getGifts().length} подарков`,
        {
          chat_id: chatId,
          message_id: wait.message_id,
          parse_mode: "Markdown",
        }
      );
    } catch (err: any) {
      bot.editMessageText(
        `❌ Ошибка обновления цен:\n\`${err.message}\``,
        { chat_id: chatId, message_id: wait.message_id, parse_mode: "Markdown" }
      );
    }
  });

  // Callback queries
  bot.on("callback_query", (query: any) => {
    const chatId = String(query.message.chat.id);
    const userId = String(query.from?.id);
    const data: string = query.data ?? "";

    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.answerCallbackQuery(query.id, { text: "Нет доступа." });
      return;
    }
    bot.answerCallbackQuery(query.id);

    // Cancel or back → ask for player ID
    if (data === "a:cancel" || data === "a:back") {
      askForPlayerId(chatId);

    // Show player panel: a:panel:{targetId}
    } else if (data.startsWith("a:panel:")) {
      const targetId = data.slice("a:panel:".length);
      const { text, opts } = playerPanelMsg(targetId);
      bot.sendMessage(chatId, text, opts);

    // Force WIN: a:win:{targetId}
    } else if (data.startsWith("a:win:")) {
      const targetId = data.slice("a:win:".length);
      setLuckMode("force_win");
      const { text, opts } = playerPanelMsg(targetId);
      bot.sendMessage(chatId, "✅ Режим Force WIN активирован.");
      bot.sendMessage(chatId, text, opts);

    // Force LOSE: a:lose:{targetId}
    } else if (data.startsWith("a:lose:")) {
      const targetId = data.slice("a:lose:".length);
      setLuckMode("force_lose");
      const { text, opts } = playerPanelMsg(targetId);
      bot.sendMessage(chatId, "✅ Режим Force LOSE активирован.");
      bot.sendMessage(chatId, text, opts);

    // Reset luck: a:reset:{targetId}
    } else if (data.startsWith("a:reset:")) {
      const targetId = data.slice("a:reset:".length);
      setLuckMode("normal");
      const { text, opts } = playerPanelMsg(targetId);
      bot.sendMessage(chatId, "✅ Удача сброшена до обычного режима.");
      bot.sendMessage(chatId, text, opts);

    // Give gift → show paginated gift list: a:give:{targetId}
    } else if (data.startsWith("a:give:")) {
      const targetId = data.slice("a:give:".length);
      bot.sendMessage(chatId, `🎁 Выберите подарок для игрока \`${targetId}\`:`, {
        parse_mode: "Markdown",
        reply_markup: giftsKeyboard(targetId, 0),
      });

    // Gift page navigation: gp:{targetId}:{page}
    } else if (data.startsWith("gp:")) {
      const parts = data.split(":");
      const targetId = parts[1];
      const page = parseInt(parts[2], 10);
      bot.editMessageReplyMarkup(giftsKeyboard(targetId, page), {
        chat_id: chatId,
        message_id: query.message.message_id,
      });

    // Give specific gift: g:{targetId}:{giftIndex}
    } else if (data.startsWith("g:")) {
      const parts = data.split(":");
      const targetId = parts[1];
      const idx = parseInt(parts[2], 10);
      const gifts = getGifts();
      const gift = gifts[idx];
      if (!gift) {
        bot.sendMessage(chatId, "❌ Подарок не найден.");
        return;
      }
      addGiftToInventory(targetId, gift.name);
      bot.sendMessage(
        chatId,
        `✅ Подарок *${gift.name}* (⭐${gift.price}) выдан игроку \`${targetId}\`!`,
        { parse_mode: "Markdown" }
      );
      const { text, opts } = playerPanelMsg(targetId);
      bot.sendMessage(chatId, text, opts);
    }
  });

  // Text messages — used only when waiting for player ID input
  bot.on("message", (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) return;
    if (!msg.text || msg.text.startsWith("/")) return;
    if (AWAITING.get(chatId) !== "player_id") return;

    const targetId = msg.text.trim().replace(/\D/g, "");
    if (!targetId) {
      bot.sendMessage(
        chatId,
        "❌ Неверный ID. Введите только цифры (например: 123456789):",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "❌ Отмена", callback_data: "a:cancel" }]],
          },
        }
      );
      return;
    }

    AWAITING.delete(chatId);
    const { text, opts } = playerPanelMsg(targetId);
    bot.sendMessage(chatId, text, opts);
  });

  logger.info("Telegram bot started");
}

export function stopBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}
