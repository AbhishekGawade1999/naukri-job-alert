import axios from 'axios';
import axiosRetry from 'axios-retry';
import logger from './logger.js';

const client = axios.create();

axiosRetry(client, {
  retries: 3,
  retryDelay: (retryCount) => {
    logger.info(`Telegram API error, retry attempt #${retryCount}`);
    return retryCount * 1000;
  },
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response && error.response.status >= 500);
  },
});

async function sendTelegramMessage(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await client.post(url, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    logger.info('Telegram message sent successfully.');
  } catch (error) {
    const errorMessage = error.response
      ? `Error sending Telegram message: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`
      : `Error sending Telegram message: ${error.message}`;
    logger.error(errorMessage);
  }
}

export { sendTelegramMessage };
