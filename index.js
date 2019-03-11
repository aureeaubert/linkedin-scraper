const puppeteer = require("puppeteer");
const Promise = require("bluebird");
const _ = require("lodash");
const { URL } = require("url");

const linkedinLogin = async (page, sessionCookie) => {
  await page.setCookie({
    name: "li_at",
    value: sessionCookie,
    domain: "www.linkedin.com"
  });

  await page.goto("https://www.linkedin.com/feed/");

  if (/www.linkedin.com\/m\/login/.test(page.url())) {
    throw new Error("Can't sign in with this session cookie");
  }
};

const scrapeProfileResults = async (browser, searchPage, profileUsernames) => {
  return Promise.map(profileUsernames, async profileUsername => {
    const page = await browser.newPage();

    console.info("search.profileResults.profile.start", { page: searchPage, username: profileUsername });

    await page.goto(`https://www.linkedin.com/in/${profileUsername}/detail/contact-info/`);
    await page.waitForSelector("#artdeco-modal-outlet");
    await page.evaluate(() => {
      window.scrollBy(0, 1200);
    });
    await page.waitForSelector(".profile-detail .pv-profile-section__section-info .pv-profile-section__list-item");

    const profileResult = await page.evaluate(scrapeProfileResultEvaluator);
    profileResult["Linkedin"] = `https://www.linkedin.com/in/${profileUsername}/`;

    console.info("search.profileResults.profile.end", { page: searchPage, username: profileUsername, result: profileResult });

    await page.close();

    return profileResult;
  }, { concurrency: 4 })
};

const scrapeProfileUsernamesEvaluator = () => {
  return Array.from(
    document.querySelectorAll(".search-result__info .search-result__result-link")
  ).map(userElement => (
    userElement.href.match(/www.linkedin.com\/in\/(.*)\//)[1]
  ));
};

const scrapeProfileResultEvaluator = () => {
  const profileResult = {};

  const jobInfoElement = document.querySelector(".profile-detail .pv-profile-section__section-info .pv-profile-section__list-item .pv-entity__summary-info");
  
  if (jobInfoElement) {
    profileResult["JobTitle"] = jobInfoElement.querySelector("h3").innerText;
    profileResult["CompanyName"] = jobInfoElement.querySelector(".pv-entity__secondary-title").innerText;
  }

  document
    .querySelector("#artdeco-modal-outlet .pv-profile-section__section-info")
    .querySelectorAll(".pv-contact-info__contact-type:not(.ci-vanity-url)")
    .forEach(profileDataElement => {
      const key = profileDataElement.querySelector("header").textContent;
      const data = profileDataElement.querySelector(".pv-contact-info__contact-item, .pv-contact-info__contact-link, .pv-contact-info__ci-container span").textContent.trim();

      profileResult[key] = data;
  });
  
  return profileResult;
};

;(async () => {
  const browser = await puppeteer.launch({
    headless: false
  });

  try {
    const sessionCookie = process.argv[2];
    const searchUrl = new URL(process.argv[3]);
    let searchPage = 1;
    let newProfileResults = [];
    const profileResults = [];

    const page = await browser.newPage();

    console.info("signin.start");

    await linkedinLogin(page, sessionCookie);

    console.info("signin.end");

    do {
      console.info("search.start", { page: searchPage });

      searchUrl.searchParams.set("page", searchPage);

      await page.goto(searchUrl.href);
      await page.waitForSelector(".search-results-page");
      await page.evaluate(() => {
        window.scrollBy(0, 1200);
      });
      await page.waitFor(2000);

      console.info("search.profileUsernames.start", { page: searchPage });
  
      const newProfileUsernames = await page.evaluate(scrapeProfileUsernamesEvaluator);

      console.info("search.profileUsernames.end", { page: searchPage, usernames: newProfileUsernames });

      console.info("search.profileResults.start", { page: searchPage });
  
      const newProfileResults = await scrapeProfileResults(browser, searchPage, newProfileUsernames);

      console.info("search.profileResutls.end", { page: searchPage, results: newProfileResults });

      profileResults.push(newProfileResults);

      console.info("search.end", { page: searchPage });

      searchPage += 1;
    } while (newProfileResults.length !== 0);
    
  } catch (e) {
    console.error(e.message);
  }

  await browser.close();
})();