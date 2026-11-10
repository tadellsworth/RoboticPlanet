// Finds the Chrome binary the renders were made with: Chrome for Testing 153.0.8010.12.
// Order: $CHROME, then ./chrome (installed by `npm run install-chrome`), then /usr/bin/google-chrome.
const fs = require('fs'), path = require('path');
const BUILD = '153.0.8010.12';
module.exports = function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  try {
    const { computeExecutablePath, Browser } = require('@puppeteer/browsers');
    const p = computeExecutablePath({ browser: Browser.CHROME, buildId: BUILD, cacheDir: path.join(__dirname, 'chrome') });
    if (fs.existsSync(p)) return p;
  } catch (e) { /* fall through */ }
  return '/usr/bin/google-chrome';
};
module.exports.BUILD = BUILD;
