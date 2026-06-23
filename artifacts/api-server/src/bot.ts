import { createRequire } from "module";
import { addGiftToInventory, getLuckMode, setLuckMode } from "./db.js";
import { logger } from "./lib/logger.js";

const require = createRequire(import.meta.url);

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]?.trim();
const ADMIN_ID = process.env["ADMIN_TELEGRAM_ID"]?.trim();

let bot: any = null;
const ADMIN_AWAITING: Map<string, string> = new Map();

export function startBot(): void {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — bot will not start");
    return;
  }

  const TelegramBot = require("node-telegram-bot-api");
  bot = new TelegramBot(BOT_TOKEN, { polling: true });

  bot.onText(/\/start/, (msg: any) => {
    const chatId = msg.chat.id;
    const miniAppUrl = process.env["MINI_APP_URL"] ?? "https://t.me";
    bot.sendMessage(chatId, "🎁 Welcome to NFT Gift Upgrader!\n\nTap the button below to open the app.", {
      reply_markup: {
        inline_keyboard: [[
          { text: "🎰 Open Upgrader", web_app: { url: miniAppUrl } }
        ]]
      }
    });
  });

  bot.onText(/\/myid/, (msg: any) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🆔 Your Telegram ID: \`${msg.from?.id}\``, { parse_mode: "Markdown" });
  });

  bot.onText(/\/adm/, (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.sendMessage(chatId, `❌ Not authorized.\nYour ID: \`${msg.from?.id}\`\nExpected: \`${ADMIN_ID ?? "not set"}\``, { parse_mode: "Markdown" });
      return;
    }
    const luckMode = getLuckMode();
    const modeLabel =
      luckMode === "force_win" ? "🟢 Force WIN" :
      luckMode === "force_lose" ? "🔴 Force LOSE" : "⚪ Normal";

    bot.sendMessage(chatId, `🛡 Admin Panel\nCurrent mode: ${modeLabel}`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🟢 Force WIN", callback_data: "adm_force_win" }],
          [{ text: "🔴 Force LOSE", callback_data: "adm_force_lose" }],
          [{ text: "⚪ Reset luck", callback_data: "adm_reset" }],
          [{ text: "🎁 Give gift", callback_data: "adm_give" }],
          [{ text: "❌ Cancel", callback_data: "adm_cancel" }],
        ]
      }
    });
  });

  bot.on("callback_query", (query: any) => {
    const chatId = String(query.message.chat.id);
    const userId = String(query.from?.id);
    const data = query.data;

    if (!ADMIN_ID || userId !== ADMIN_ID) {
      bot.answerCallbackQuery(query.id, { text: "Not authorized." });
      return;
    }
    bot.answerCallbackQuery(query.id);

    if (data === "adm_force_win") {
      setLuckMode("force_win");
      bot.sendMessage(chatId, "✅ Force WIN mode activated. All upgrades will WIN.");
    } else if (data === "adm_force_lose") {
      setLuckMode("force_lose");
      bot.sendMessage(chatId, "✅ Force LOSE mode activated. All upgrades will LOSE.");
    } else if (data === "adm_reset") {
      setLuckMode("normal");
      bot.sendMessage(chatId, "✅ Luck reset to normal random mode.");
    } else if (data === "adm_give") {
      ADMIN_AWAITING.set(chatId, "give_gift");
      bot.sendMessage(chatId, "📋 Enter Telegram ID and gift name:\nFormat: `123456789 Witch Hat`", { parse_mode: "Markdown" });
    } else if (data === "adm_cancel") {
      ADMIN_AWAITING.delete(chatId);
      bot.sendMessage(chatId, "✅ Cancelled.");
    }
  });

  bot.on("message", (msg: any) => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id);
    if (!ADMIN_ID || userId !== ADMIN_ID) return;
    if (!ADMIN_AWAITING.has(chatId)) return;

    const action = ADMIN_AWAITING.get(chatId);
    ADMIN_AWAITING.delete(chatId);

    if (action === "give_gift") {
      const text = msg.text?.trim() ?? "";
      const spaceIdx = text.indexOf(" ");
      if (spaceIdx === -1) {
        bot.sendMessage(chatId, "❌ Invalid format. Use: 123456789 Witch Hat");
        return;
      }
      const targetId = text.substring(0, spaceIdx).trim();
      const giftName = text.substring(spaceIdx + 1).trim();
      if (!targetId || !giftName) {
        bot.sendMessage(chatId, "❌ Invalid format. Use: 123456789 Witch Hat");
        return;
      }
      addGiftToInventory(targetId, giftName);
      bot.sendMessage(chatId, `✅ Added "${giftName}" to user ${targetId}'s inventory.`);
    }
  });

  logger.info("Telegram bot started");
}

export function stopBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}
