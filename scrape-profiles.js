const fs = require('fs');
const Promise = require('bluebird');
const puppeteer = require('puppeteer');

/**
 * Read file
 */
const readFile = (filename, encoding) => {
  try {
    return fs.readFileSync(filename, encoding);
  }
  catch (e) {
    return null;
  }
};

/**
 * Write file
 */
const writeFile = (filename, object) => {
  fs.writeFileSync(filename, JSON.stringify(object, null, 2));
};

/**
 * Login to LinkedIn
 */
const loginToLinkedIn = async (puppeteerBrowser, sessionCookie) => {
  console.log('Login to LinkedIn');

  const puppeteerPage = await puppeteerBrowser.newPage();
  await puppeteerPage.setCookie({
    name: 'li_at',
    value: sessionCookie,
    domain: 'www.linkedin.com',
  });

  await puppeteerPage.goto('https://www.linkedin.com/feed/');

  // If we're redirect to the login page, session cookie is not valid
  if (/www.linkedin.com\/m\/login/.test(puppeteerPage.url())) {
    throw new Error("Can't sign in with this session cookie");
  }

  await puppeteerPage.close();
};

/**
 * Function to evaluate to return all profile info
 */
const scrapePageProfileEvaluator = () => {
  const profileResult = {};

  profileResult.name = document.querySelector(".pv-top-card-section__name").innerText;

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
  puppeteerBrowser,
  usernames,
) => Promise.map(usernames, async (username) => {
  const puppeteerPage = await puppeteerBrowser.newPage();
  const pageUrl = `https://www.linkedin.com/in/${username}/detail/contact-info/`;

  console.log(`Scrape page ${pageUrl}`);

  await puppeteerPage.goto(pageUrl);
  await puppeteerPage.waitForSelector('#artdeco-modal-outlet');
  await puppeteerPage.evaluate(() => {
    window.scrollBy(0, 1200);
  });
  await puppeteerPage.waitForSelector('.profile-detail .pv-profile-section__section-info .pv-profile-section__list-item');

  const profileResult = await puppeteerPage.evaluate(scrapePageProfileEvaluator);
  profileResult.linkedin = `https://www.linkedin.com/in/${username}/`;

  await puppeteerPage.close();

  console.log(`Found ${JSON.stringify(profileResult, null, 2)}`);

  return profileResult;
}, { concurrency: 4 });

const run = async () => {
  // Initialize puppeteer
  const puppeteerBrowser = await puppeteer.launch({
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
    usernamesData.offset + usernamesData.limit
  );
  usernamesData.offset = usernamesData.offset + usernamesData.limit;

  // Login to LinkedIn
  await loginToLinkedIn(puppeteerBrowser, sessionCookie);

  // Scrape all profiles from the given usernames list
  const newResults = await scrapeProfiles(puppeteerBrowser, usernames);

  // Write results in a file
  writeFile('./profiles.json', oldResults.concat(newResults));
  writeFile('./profile-usernames.json', usernamesData);

  await puppeteerBrowser.close();
};

run();
