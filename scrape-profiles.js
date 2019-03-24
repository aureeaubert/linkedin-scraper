const Promise = require('bluebird');
const puppeteer = require('puppeteer');

const { loginToLinkedIn, readFile, writeFile } = require('./utils');

/**
 * Function to evaluate to return all profile info
 */
const scrapePageProfileEvaluator = () => {
  const profileResult = {};

  profileResult.name = document.querySelector('.pv-top-card-section__name').innerText;

  const jobInfoElement = document.querySelector('.profile-detail .pv-profile-section__section-info .pv-profile-section__list-item .pv-entity__summary-info');

  if (jobInfoElement) {
    profileResult.jobTitle = jobInfoElement.querySelector('h3').innerText;
    profileResult.companyName = jobInfoElement.querySelector('.pv-entity__secondary-title').innerText;
  }

  document
    .querySelector('#artdeco-modal-outlet .pv-profile-section__section-info')
    .querySelectorAll('.pv-contact-info__contact-type:not(.ci-vanity-url)')
    .forEach((profileDataElement) => {
      const key = profileDataElement.querySelector('header').textContent;
      const data = profileDataElement.querySelector('.pv-contact-info__contact-item, .pv-contact-info__contact-link, .pv-contact-info__ci-container span').textContent.trim();
      profileResult[key.toLowerCase()] = data;
    });

  return profileResult;
};

/**
 * Scrape all profiles from a list of usernames
 */
const scrapeProfiles = async (
  browser,
  usernames,
) => Promise.map(usernames, async (username) => {
  const page = await browser.newPage();
  const pageUrl = `https://www.linkedin.com/in/${username}/detail/contact-info/`;

  console.log(`Scrape page ${pageUrl}`);

  await page.goto(pageUrl);
  await page.waitForSelector('#artdeco-modal-outlet');
  await page.evaluate(() => {
    window.scrollBy(0, 1200);
  });
  await page.waitForSelector('.profile-detail .pv-profile-section__section-info .pv-profile-section__list-item');

  const profileResult = await page.evaluate(scrapePageProfileEvaluator);
  profileResult.linkedin = `https://www.linkedin.com/in/${username}/`;

  await page.close();

  console.log(`Found ${JSON.stringify(profileResult, null, 2)}`);

  return profileResult;
}, { concurrency: 4 });

const run = async () => {
  // Initialize puppeteer
  const browser = await puppeteer.launch({
    headless: true,
  });

  if (!process.argv[2]) {
    throw new Error('Missing input params');
  }

  // Script params
  const sessionCookie = process.argv[2];

  // Read results in a file
  const oldResultsStr = readFile('./profiles.json', 'utf8');
  const usernamesDataStr = readFile('./profile-usernames.json', 'utf8');

  const oldResults = JSON.parse(oldResultsStr || '[]');
  const usernamesData = JSON.parse(usernamesDataStr);
  const usernames = usernamesData.results.slice(
    usernamesData.offset,
    usernamesData.offset + usernamesData.limit,
  );
  usernamesData.offset += usernamesData.limit;

  // Login to LinkedIn
  await loginToLinkedIn(browser, sessionCookie);

  // Scrape all profiles from the given usernames list
  const newResults = await scrapeProfiles(browser, usernames);

  // Write results in a file
  writeFile('./profiles.json', oldResults.concat(newResults));
  writeFile('./profile-usernames.json', usernamesData);

  await browser.close();
};

run();
