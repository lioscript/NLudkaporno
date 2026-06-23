import crypto from "node:crypto";

const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] ?? "";

export function verifyInitData(initData: string): boolean {
  // In dev mode without a token, allow all requests
  if (!BOT_TOKEN) return true;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    params.delete("hash");

    const dataCheckArr: string[] = [];
    const sortedKeys = Array.from(params.keys()).sort();
    for (const key of sortedKeys) {
      dataCheckArr.push(`${key}=${params.get(key)}`);
    }
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(BOT_TOKEN)
      .digest();

    const hmac = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return hmac === hash;
  } catch {
    return false;
  }
}

export function extractUserId(initData: string): string | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get("user");
    if (!userStr) {
      // Fallback: if no user param (e.g. dev mode), use a mock ID
      const id = params.get("id");
      return id ?? "dev_user";
    }
    const user = JSON.parse(userStr);
    return String(user.id);
  } catch {
    return "dev_user";
  }
}
