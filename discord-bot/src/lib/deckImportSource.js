const SUPPORTED_SITES = ['Moxfield', 'Archidekt', 'TappedOut', 'MTGGoldfish'];

const DOMAIN_TO_SOURCE = [
  { domain: 'moxfield.com', source: 'moxfield' },
  { domain: 'archidekt.com', source: 'archidekt' },
  { domain: 'tappedout.net', source: 'tappedout' },
  { domain: 'mtggoldfish.com', source: 'mtggoldfish' }
];

function detectDeckImportSource(url) {
  const lower = url.toLowerCase();
  const match = DOMAIN_TO_SOURCE.find(({ domain }) => lower.includes(domain));
  return match ? match.source : null;
}

module.exports = { detectDeckImportSource, SUPPORTED_SITES };
