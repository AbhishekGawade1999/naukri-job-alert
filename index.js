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
    logger.error(`Database initialization failed. Please check your database connection details. ${error.message}`);
    process.exit(1); // Exit if the database cannot be initialized
  }

  const seen = await getSeenJobs();
  const seenUrls = new Set(seen.map(s => s.url));

  // Parse SEARCH_URL: "url1|Place1, url2|Place2"
  const searchConfigs = SEARCH_URL.split(',').map(entry => {
    const [url, place] = entry.split('|');
    return { url: url.trim(), place: place ? place.trim() : null };
  });

  let allNewJobs = [];
  let placeResults = [];

  for (const config of searchConfigs) {
    try {
      const jobs = await fetchJobs(config.url);
      const newJobs = jobs.filter(j => !seenUrls.has(j.url));

      // Attach place to job object (optional, for debugging or future use)
      newJobs.forEach(j => j.place = config.place);

      allNewJobs = [...allNewJobs, ...newJobs];
      // Add newly found jobs to seenUrls to avoid duplicates across different search URLs if any
      newJobs.forEach(j => seenUrls.add(j.url));

      placeResults.push({
        place: config.place || "Naukri", // Default to "Naukri" if no place specified
        jobs: newJobs
      });

    } catch (error) {
      logger.error(`Error fetching jobs for URL: ${config.url} - ${error.message}`);
      placeResults.push({
        place: config.place || "Unknown",
        error: true
      });
    }

    // Add a random delay between 5 to 15 seconds between requests, but not after the last one
    if (searchConfigs.indexOf(config) < searchConfigs.length - 1) {
      const delay = Math.floor(Math.random() * (15000 - 5000 + 1) + 5000);
      logger.info(`Waiting for ${delay / 1000} seconds before next request...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.info(`${allNewJobs.length} new jobs found across all searches.`);

  // Construct consolidated message
  let messageLines = [];

  // Add header with timestamp and summary
  const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  if (allNewJobs.length > 0) {
    messageLines.push(`🔔 *Naukri Job Alert* - ${allNewJobs.length} new job(s) found!`);
  } else {
    messageLines.push(`✅ *Naukri Job Alert* - No new jobs found`);
  }
  messageLines.push(`⏰ _${now}_`);
  messageLines.push(""); // Add spacing

  for (const result of placeResults) {
    if (result.error) {
      messageLines.push(`*${result.place}* - ERROR NAUKRI ⚠️`);
      messageLines.push(""); // Add spacing
      continue;
    }

    if (result.jobs.length > 0) {
      messageLines.push(`*${result.place}* -`);
      result.jobs.forEach((job, index) => {
        messageLines.push(`${index + 1}) [${job.title}](${job.url})`);
      });
    } else {
      messageLines.push(`*${result.place}* - No New Jobs Found 📉`);
    }
    messageLines.push(""); // Add spacing between places
  }

  // Always send message
  const fullMessage = messageLines.join("\n");
  logger.info(`Sending Telegram message to chat ${TELEGRAM_CHAT_ID}:\n${fullMessage}`);
  await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, fullMessage);

  if (allNewJobs.length > 0) {
    await addSeenJobs(allNewJobs);
  }
}

main().catch(error => {
  logger.error(`An unexpected error occurred in main execution: ${error.message}`);
});
