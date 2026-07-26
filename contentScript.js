// contentScript.js
// Runs on Avala pages and sends the page title (and url) to the background script
(function () {
  try {
    // Try several selectors for a meaningful project/title
    const metaOg = document.querySelector('meta[property="og:title"]')?.content;
    const metaName = document.querySelector('meta[name="og:title"]')?.content;
    const metaTwitter = document.querySelector('meta[name="twitter:title"]')?.content;
    const h1 = document.querySelector('h1')?.innerText;
    const possibleSelectors = [
      '[data-test="project-title"]',
      '.project-title',
      '.title',
      'h1',
      '.slice-title'
    ];

    let title = metaOg || metaName || metaTwitter || h1 || document.title || '';
    for (const sel of possibleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 0) {
        title = el.innerText.trim();
        break;
      }
    }

    // Additional metadata: find dataset/sequence from DOM if present
    const datasetEl = document.querySelector('[data-dataset]') || document.querySelector('.dataset');
    const dataset = datasetEl?.getAttribute('data-dataset') || datasetEl?.innerText || '';

    chrome.runtime.sendMessage({ type: 'PAGE_METADATA', title: title, url: location.href, dataset });
  } catch (e) {
    // ignore
  }
})();
