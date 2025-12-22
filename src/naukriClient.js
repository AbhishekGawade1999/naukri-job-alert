import puppeteer from 'puppeteer';
import logger from './logger.js';

async function fetchJobs(searchUrl) {
  logger.info("Fetching jobs from:", searchUrl);
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 }); // Wait for network to be idle

    // Wait for the job listings to appear on the page
    try {
      await page.waitForSelector('div.row1', { timeout: 20000 });
    } catch (e) {
      logger.warn(`Timeout waiting for selector 'div.row1' on ${searchUrl}. Assuming no jobs found or page structure changed.`);
      return [];
    }

    // Add a short timeout to ensure all dynamic content has rendered
    await new Promise(resolve => setTimeout(resolve, 3000));

    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('div.row1');
      const extractedJobs = [];

      jobElements.forEach(element => {
        const titleElement = element.querySelector('h2 > a.title');
        if (titleElement) {
          const title = titleElement.innerText.trim();
          const url = titleElement.href;
          if (title && url) {
            extractedJobs.push({ title, url });
          }
        }
      });
      return extractedJobs;
    });

    logger.info(`Found ${jobs.length} jobs.`);
    return jobs;
  } catch (error) {
    logger.error("Failed to fetch or parse jobs with Puppeteer:", error.message);
    throw error; // Rethrow to allow calling function to handle it
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export { fetchJobs };