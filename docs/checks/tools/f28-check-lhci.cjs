// F28 check: the repo's lighthouserc.cjs, with the F28 pages and an optional dark theme.
// LHCI_THEME=dark adds --blink-settings=preferredColorScheme=0 (verified: matches dark).
// Usage: LHCI_THEME=light|dark npx lhci autorun --config=docs/checks/tools/f28-check-lhci.cjs
const base = require('../../../lighthouserc.cjs');
const dark = process.env.LHCI_THEME === 'dark';
const flags = '--headless=new --no-sandbox' + (dark ? ' --blink-settings=preferredColorScheme=0' : '');
module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      url: ['/', '/garden/', '/rising-water/', '/about/', '/404.html'].map((p) => `http://localhost${p}`),
      settings: { chromeFlags: flags },
    },
    upload: { target: 'filesystem', outputDir: `./docs/checks/F28b/attempt-1/lhci-${dark ? 'dark' : 'light'}` },
  },
};
