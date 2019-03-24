const fs = require('fs');

/**
 * Read file content
 */
const readFile = (filename, encoding) => {
  try {
    return fs.readFileSync(filename, encoding);
  } catch (e) {
    return null;
  }
};

/**
 * Write a given object in a file
 */
const writeInFile = (filename, object) => {
  fs.writeFileSync(filename, JSON.stringify(object, null, 2));
};

/**
 * Login to LinkedIn
 */
const loginToLinkedIn = async (browser, sessionCookie) => {
  console.log('Login to LinkedIn');

  const page = await browser.newPage();
  await page.setCookie({
    name: 'li_at',
    value: sessionCookie,
    domain: 'www.linkedin.com',
  });

  await page.goto('https://www.linkedin.com/feed/');

  // If we're redirect to the login page, session cookie is not valid
  if (/www.linkedin.com\/m\/login/.test(page.url())) {
    throw new Error("Can't sign in with this session cookie");
  }

  await page.close();
};

module.exports = {
  readFile,
  writeInFile,
  loginToLinkedIn,
};
