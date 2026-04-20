import cron from "node-cron";
import { fetchAllAccounts } from "../meta/fetcher";
import { classifyNewComments } from "../classifier/runner";
import { config } from "../config";
import { logger } from "../utils/logger";

export function startScheduler(): void {
  const minutes = Math.max(1, config.polling.intervalMinutes);
  const expr = `*/${minutes} * * * *`;

  logger.info("starting scheduler", { pollEvery: expr });

  cron.schedule(expr, async () => {
    try {
      const fetched = await fetchAllAccounts();
      logger.info("poll: fetch done", { results: fetched });
    } catch (err) {
      logger.error("poll: fetch error", { err: String(err) });
    }
    try {
      const classified = await classifyNewComments(100);
      logger.info("poll: classify done", { classified });
    } catch (err) {
      logger.error("poll: classify error", { err: String(err) });
    }
  });

  // Run once at startup (best-effort; don't block startup).
  setTimeout(() => {
    fetchAllAccounts().catch(() => undefined);
    classifyNewComments(100).catch(() => undefined);
  }, 5000);
}
