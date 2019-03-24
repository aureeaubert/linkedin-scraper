const puppeteer = require('puppeteer');
const { URL } = require('url');

const { loginToLinkedIn, writeInFile } = require('./utils');

/**
 * Function to evaluate to return all usernames in the page
 */
const scrapePageProfileUsernamesEvaluator = () => Array.from(
  document.querySelectorAll('.search-result__info .search-result__result-link'),
).map(userElement => (
  userElement.href.match(/www.linkedin.com\/in\/(.*)\//)[1]
));

/**
 * Find all usernames by browsing search pages recursively
 */
const scrapeProfileUsernames = async (
  puppeteerPage,
  searchUrl,
  pageIndex = 1,
  usernamesResults = [],
) => {
  // Set page number query param in the search URL
  searchUrl.searchParams.set('page', pageIndex);

  console.info(`Scrape page ${searchUrl}`);

  // Go and wait the results page
  await puppeteerPage.goto(searchUrl.href);
  await puppeteerPage.waitForSelector('.search-results-page');

  // Retrieve profile usernames in the current page
  const pageUsernames = await puppeteerPage.evaluate(scrapePageProfileUsernamesEvaluator);

  // If we don't find new usernames, return current usernames list
  if (!pageUsernames || pageUsernames.length === 0) {
    console.log(`No username found on page ${searchUrl}`);
    return usernamesResults;
  }

  console.log(`Found ${pageUsernames.length} usernames on page ${searchUrl}:`, pageUsernames);

  // Current usernames list + new usernames found
  const newUsernamesResults = [...usernamesResults, ...pageUsernames];

  // Scrape the next page
  return scrapeProfileUsernames(
    puppeteerPage,
    searchUrl,
    pageIndex + 1,
    newUsernamesResults,
  );
};

const run = async () => {
  // Initialize puppeteer
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: {
      width: 1000,
      height: 3000,
    },
  });

  if (!process.argv[2] || !process.argv[3]) {
    throw new Error('Missing input params');
  }

  // Script params
  const sessionCookie = process.argv[2];
  const searchUrl = new URL(process.argv[3]);

  // Login to LinkedIn
  await loginToLinkedIn(browser, sessionCookie);

  // Scrape all profile usernames from the given search URL
  const page = await browser.newPage();
  const usernames = await scrapeProfileUsernames(page, searchUrl);

  console.log('Results ->', usernames);

  // Write results in a file
  writeInFile(
    './profile-usernames.json',
    { results: usernames, offset: 0, limit: 200 },
  );

  // Close browser
  await page.close();
  await browser.close();
};

run();
