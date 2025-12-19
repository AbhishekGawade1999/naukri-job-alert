import 'dotenv/config';
import { fetchJobs } from './src/naukriClient.js';
import { sendTelegramMessage } from './src/telegramClient.js';
import { init, getSeenJobs, addSeenJobs } from './src/database.js';
import logger from './src/logger.js';

// ==== CONFIG ====
const SEARCH_URL = process.env.SEARCH_URL || "https://www.naukri.com/react-dot-js-nextjs-jobs-in-delhi-ncr?k=react.js%2C%20nextjs&l=delhi%20%2F%20ncr%2C%20hyderabad%2C%20pune&nignbevent_src=jobsearchDeskGNB&jobAge=1&experience=4&ctcFilter=10to15&ctcFilter=15to25&ctcFilter=6to10&ctcFilter=25to50";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// ===============

async function main() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.error("Telegram bot token or chat ID is not set. Please check your .env file.");
    return;
  }

  try {
    await init();
  } catch (error) {
    logger.error("Database initialization failed. Please check your database connection details.", error);
    process.exit(1); // Exit if the database cannot be initialized
  }

  const seen = await getSeenJobs();
  const seenUrls = new Set(seen.map(s => s.url));

  const jobs = await fetchJobs(SEARCH_URL);
  const newJobs = jobs.filter(j => !seenUrls.has(j.url));

  logger.info(`${newJobs.length} new jobs found.`);

  if (newJobs.length > 0) {
    const notificationPromises = newJobs.map(job =>
      sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `🚀 *New Job:* ${job.title}\n🔗 ${job.url}`)
    );

    await Promise.all(notificationPromises);
    await addSeenJobs(newJobs);

  } else {
    logger.info("No new jobs to notify.");
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, "No new jobs found On Naukri 📉");
  }
}

main().catch(error => {
  logger.error("An unexpected error occurred in main execution:", error);
});
