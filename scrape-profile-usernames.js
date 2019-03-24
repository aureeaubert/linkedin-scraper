const puppeteer = require('puppeteer');

const { loginToLinkedIn, writeInFile } = require('./utils');

/**
 * Function to evaluate to return all usernames in the page
 */
const extractUsernames = () => {
  return Array.from(
    document.querySelectorAll('.mn-connection-card .mn-connection-card__link'),
  ).map((userElement) => {
    // Get "username" in "/in/username/"
    return userElement.href.match(/\/in\/(.*)\//)[1];
  });
};

/**
 * Find all usernames in the page with infinite scroll loading
 */
const scrapeProfileUsernamesWithScroll = async (page, pageNumber) => {
  // Retrieve profile usernames in the current page
  const usernames = await page.evaluate(extractUsernames);

  // If all usernames aren't loaded
  if (pageNumber > 0) {
    // Scroll down to load more results
    console.log(`${usernames.length} results loaded, load more...`);
    const previousHeight = await page.evaluate('document.body.scrollHeight');
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
    await page.waitFor(() => !document.querySelector('.mn-connections .loader'));
    return scrapeProfileUsernamesWithScroll(page, pageNumber - 1);
  }

  return usernames;
};

/**
 * Find all usernames in the page
 */
const scrapeProfileUsernames = async (browser) => {
  const page = await browser.newPage();

  // Go and wait the connections page
  await page.goto('https://www.linkedin.com/mynetwork/invite-connect/connections/');
  await page.waitForSelector('.mn-connections__header');

  // Retrieve connections total count
  const connectionsCount = await page.evaluate(() => {
    const connectionsHeaderText = document.querySelector('.mn-connections__header').innerText;
    return Number(connectionsHeaderText.split(' ')[0]);
  });

  // Scrape results
  const results = await scrapeProfileUsernamesWithScroll(page, connectionsCount / 40);

  await page.close();

  return results;
};

const run = async () => {
  // Initialize puppeteer
  const browser = await puppeteer.launch({
    headless: true,
  });

  if (!process.argv[2]) {
    throw new Error('Missing session cookie param');
  }
  const sessionCookie = process.argv[2];

  // Login to LinkedIn
  await loginToLinkedIn(browser, sessionCookie);

  // Launch scraping
  const usernames = await scrapeProfileUsernames(browser);

  console.log('Results ->', usernames);

  // Write results in a file
  writeInFile(
    './profile-usernames.json',
    { results: usernames, offset: 0, limit: 100 },
  );

  // Close browser
  await browser.close();
};

run();
