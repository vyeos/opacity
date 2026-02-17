import { loadConfig } from "./shared/config.js";
import { startTelegramWebhookServer } from "./bot/webhookServer.js";

async function main(): Promise<void> {
  const config = loadConfig();

  if (!config.TELEGRAM_BOT_TOKEN) {
    console.error("TELEGRAM_BOT_TOKEN is required to run webhook server");
    process.exit(1);
  }

  await startTelegramWebhookServer(config);
}

main().catch((error: unknown) => {
  console.error("Fatal webhook server error", error);
  process.exitCode = 1;
});
