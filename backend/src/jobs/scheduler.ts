import cron from "node-cron";
import { fetchAllAccounts } from "../meta/fetcher";
import { fetchAllGoogleAccounts } from "../google/fetcher";
import { classifyNewComments } from "../classifier/runner";
import { checkTokenExpiry } from "./token-monitor";
import { runRetention } from "./retention";
import { config } from "../config";
import { logger } from "../utils/logger";

export function startScheduler(): void {
  const minutes = Math.max(1, config.polling.intervalMinutes);
  const expr = `*/${minutes} * * * *`;

  logger.info("starting scheduler", { pollEvery: expr });

  cron.schedule(expr, async () => {
    try {
      const fetched = await fetchAllAccounts();
      logger.info("poll: meta fetch done", { results: fetched });
    } catch (err) {
      logger.error("poll: meta fetch error", { err: String(err) });
    }
    try {
      const fetchedG = await fetchAllGoogleAccounts();
      logger.info("poll: google fetch done", { results: fetchedG });
    } catch (err) {
      logger.error("poll: google fetch error", { err: String(err) });
    }
    try {
      const classified = await classifyNewComments(100);
      logger.info("poll: classify done", { classified });
    } catch (err) {
      logger.error("poll: classify error", { err: String(err) });
    }
  });

  // Daily at 06:00 — check token expiry.
  cron.schedule("0 6 * * *", async () => {
    try {
      await checkTokenExpiry();
    } catch (err) {
      logger.error("token-monitor error", { err: String(err) });
    }
  });

  // Daily at 03:15 — GDPR retention anonymization.
  cron.schedule("15 3 * * *", async () => {
    try {
      await runRetention();
    } catch (err) {
      logger.error("retention error", { err: String(err) });
    }
  });

  // Run once at startup (best-effort; don't block startup).
  setTimeout(() => {
    fetchAllAccounts().catch(() => undefined);
    fetchAllGoogleAccounts().catch(() => undefined);
    classifyNewComments(100).catch(() => undefined);
    checkTokenExpiry().catch(() => undefined);
  }, 5000);
}
