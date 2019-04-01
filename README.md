# LinkedIn scraper

## How to use it

### Install dependencies

```bash
npm install
# or
yarn
```

### Prerequisites

`session cookie` below corresponds to the LinkedIn authentication cookie named `li_at`. You can easily find it in the *Application > Storage > Cookies* tab of your Chrome devtool.

The process of scraping is splitted in two steps (scrap usernames list, scrap users info).

### Get the LinkedIn profile usernames list that should be scraped

```bash
node ./scrape-profile-usernames.js <session cookie>
```

This script will retrieve usernames list from the `https://www.linkedin.com/mynetwork/invite-connect/connections/` URL.

*OR*

```bash
node ./scrape-profile-usernames-search.js <session cookie> <search url>
```

This script will retrieve usernames list from a personalized search URL `https://www.linkedin.com/search/results/people/`.

Both scripts will store their result in a `profile-usernames.json` file.

### Get information of each profile

```bash
node ./scrape-profiles.js <session cookie>
```

This script will read the `profile-usernames.json` file and scrap one by one each user profile to retrieve their info. It will scrap profiles by bucket of 100 items and append the result in a `profiles.json` file.

Due to LinkedIn rate limiting on the number of profiles seen by day, this script must be launch at spaced times.

