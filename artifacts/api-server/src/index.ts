import app from "./app.js";
import { logger } from "./lib/logger.js";
import { startBot } from "./bot.js";
import { updatePrices, scheduleDaily } from "./priceUpdater.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startBot();

  updatePrices()
    .then(({ updated, oldRate, newRate }) =>
      logger.info({ updated, oldRate, newRate }, "Startup price sync done")
    )
    .catch((err) => logger.warn({ err }, "Startup price sync failed — will retry next day"));

  scheduleDaily(async () => {
    const { clearGiftsCache } = await import("./routes/gifts.js");
    clearGiftsCache();
    await updatePrices();
    clearGiftsCache();
  });
});
