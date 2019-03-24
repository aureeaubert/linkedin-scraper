const Promise = require('bluebird');
const puppeteer = require('puppeteer');

const { loginToLinkedIn, readFile, writeInFile } = require('./utils');

/**
 * Function to evaluate to return all profile info
 */
const scrapePageProfileEvaluator = () => {
  const profileResult = {};

  profileResult.name = document.querySelector('.pv-top-card-section__name').innerText.trim();

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
 * Scrape a LinkedIn profile from a given username
 */
const scrapeProfile = async (
  browser,
  username,
) => {
  const linkedin = `https://www.linkedin.com/in/${username}/`;

  try {
    const page = await browser.newPage();
    const pageUrl = `https://www.linkedin.com/in/${username}/detail/contact-info/`;

    console.log(`Scrape page ${pageUrl}`);

    await page.goto(pageUrl);
    await page.waitForSelector('#artdeco-modal-outlet');

    const profileResult = await page.evaluate(scrapePageProfileEvaluator);
    profileResult.linkedin = linkedin;

    await page.close();

    console.log(`Found ${JSON.stringify(profileResult, null, 2)}`);

    return profileResult;
  } catch (e) {
    console.error(`Fail to scrape profile ${username}`);
    return { linkedin };
  }
};

/**
 * Scrape all profiles from a list of usernames
 */
const scrapeProfiles = async (
  browser,
  usernames,
) => Promise.map(
  usernames,
  username => scrapeProfile(browser, username),
  { concurrency: 4 },
);

const run = async () => {
  // Initialize puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 1000,
      height: 1000,
    },
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
  writeInFile('./profiles.json', oldResults.concat(newResults));
  writeInFile('./profile-usernames.json', usernamesData);

  await browser.close();
};

run();
