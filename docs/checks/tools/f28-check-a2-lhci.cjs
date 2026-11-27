// F28b attempt-2 check: repo lighthouserc.cjs on / and /garden/ only, light or dark.
// LHCI_THEME=dark adds --blink-settings=preferredColorScheme=0.
// Usage: LHCI_THEME=light|dark npx lhci autorun --config=docs/checks/tools/f28-check-a2-lhci.cjs
const base = require('../../../lighthouserc.cjs');
const dark = process.env.LHCI_THEME === 'dark';
const flags = '--headless=new --no-sandbox' + (dark ? ' --blink-settings=preferredColorScheme=0' : '');
module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      url: ['/', '/garden/'].map((p) => `http://localhost${p}`),
      settings: { chromeFlags: flags },
    },
    upload: { target: 'filesystem', outputDir: `./docs/checks/F28b/attempt-2/lhci-${dark ? 'dark' : 'light'}` },
  },
};
