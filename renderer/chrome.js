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
  // Claude Code cloud sessions: the pre-installed Playwright browser is this same build.
  try {
    for (const d of fs.readdirSync('/opt/pw-browsers')) {
      const p = path.join('/opt/pw-browsers', d, 'chrome-linux64', 'chrome');
      if (/^chromium-\d+$/.test(d) && fs.existsSync(p)) return p;
    }
  } catch (e) { /* none */ }
  return '/usr/bin/google-chrome';
};
module.exports.BUILD = BUILD;
