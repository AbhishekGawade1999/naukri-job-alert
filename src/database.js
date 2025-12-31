import pg from "pg";
import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (err, client) => {
  logger.error(`Unexpected error on idle client: ${err.message}`);
  process.exit(-1);
});

async function init() {
  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS seen_jobs (
        id SERIAL PRIMARY KEY,
        url VARCHAR(255) UNIQUE NOT NULL,
        title TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    logger.info("Database table initialized successfully.");
  } catch (err) {
    logger.error(`Error initializing database table: ${err.message}`);
    throw err; // Propagate error to stop the application
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function getSeenJobs() {
  let client;
  try {
    client = await pool.connect();
    const res = await client.query("SELECT url, title FROM seen_jobs");
    return res.rows;
  } catch (err) {
    logger.error(`Error fetching seen jobs from database: ${err.message}`);
    return []; // Return empty array on error
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function addSeenJobs(jobs) {
  if (jobs.length === 0) {
    return;
  }

  const client = await pool.connect();
  try {
    const values = jobs.flatMap((job) => [job.url, job.title]);
    const placeholders = jobs
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
      .join(", ");

    const query = {
      text: `INSERT INTO seen_jobs (url, title) VALUES ${placeholders} ON CONFLICT (url) DO NOTHING`,
      values,
    };

    await client.query("BEGIN");
    await client.query(query);
    await client.query("COMMIT");

    logger.info(`Successfully processed ${jobs.length} jobs.`);
  } catch (err) {
    logger.error(`Error adding seen jobs to database: ${err.message}`);
    await client.query("ROLLBACK");
    throw err; // Re-throw the error to be caught by the main execution handler
  } finally {
    client.release();
  }
}

export { init, getSeenJobs, addSeenJobs };
