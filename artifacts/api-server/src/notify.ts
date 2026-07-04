const GROUP_CHAT_ID = process.env["GROUP_CHAT_ID"];
const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"]?.trim();

export async function notifyGroup(text: string): Promise<void> {
  if (!GROUP_CHAT_ID || !BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: GROUP_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_notification: true,
      }),
    });
  } catch {}
}
