import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';

// Inspect only HTML and response headers from a local PHP server. No scripts,
// images, redirects, Google resources or advertisements are ever executed/fetched.
const base = localBase(process.env.TEST_BASE_URL || 'http://127.0.0.1:8789');
const disabledBase = process.env.TEST_ADS_DISABLED_BASE_URL ? localBase(process.env.TEST_ADS_DISABLED_BASE_URL) : null;
const publisher = 'ca-pub-8610536439975607';
const adScript = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function localBase(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Page-shell tests only connect to localhost.');
  return url.origin;
}
function read(path = '/', { host = 'searchparty.test', cookie, origin = base } = {}) {
  const target = new URL(path, origin);
  if (target.origin !== origin) throw new Error('Test requests must stay on the local server.');
  return new Promise((resolve, reject) => {
    const client = target.protocol === 'https:' ? https : http;
    // Override only Host for PHP's page classification. The actual connection
    // stays on the checked localhost target, without DNS for searchparty.test.
    const request = client.request(target, { method: 'GET', headers: { Host: host, ...(cookie === undefined ? {} : { Cookie: cookie }) } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, html: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('Local page-shell request timed out.')));
    request.on('error', reject);
    request.end();
  });
}
function documentChecks(page, label) {
  check(page.status === 200, `${label}: expected a successful HTML document, got ${page.status}. Build release-upload first.`);
  check(String(page.headers['content-type']).startsWith('text/html'), `${label}: content must be HTML.`);
  check(/no-store/i.test(String(page.headers['cache-control'])), `${label}: personalised page selection must not be cached.`);
  check(/\bcookie\b/i.test(String(page.headers.vary)), `${label}: cache variation must include Cookie.`);
  check(page.headers['x-content-type-options'] === 'nosniff', `${label}: MIME sniffing must be disabled.`);
  const scripts = Array.from(page.html.matchAll(/<script\b([^>]*)>/gi));
  check(scripts.length > 0, `${label}: built application script must be present.`);
  const nonces = scripts.map(match => {
    const values = Array.from(match[1].matchAll(/\bnonce="([^"]+)"/gi));
    check(values.length === 1, `${label}: every script needs exactly one nonce.`);
    return values[0][1];
  });
  check(nonces.every(value => value === nonces[0]), `${label}: script nonces must match within a document.`);
  check(/^[A-Za-z0-9+/]+={0,2}$/.test(nonces[0]) && Buffer.from(nonces[0], 'base64').length >= 16, `${label}: nonce must contain at least 128 random bits.`);
  return { scripts, nonce: nonces[0], csp: String(page.headers['content-security-policy'] || '') };
}
function hasAds(page, label) {
  const document = documentChecks(page, label);
  const loaders = document.scripts.filter(match => match[1].includes(adScript));
  check(loaders.length === 1, `${label}: public home must include exactly the configured AdSense loader.`);
  check(/\basync\b/.test(loaders[0][1]) && /crossorigin="anonymous"/.test(loaders[0][1]), `${label}: loader attributes must match the integration.`);
  check(page.html.includes(`name="google-adsense-account" content="${publisher}"`), `${label}: publisher verification meta must be present.`);
  check(document.csp.includes(`'nonce-${document.nonce}'`) && document.csp.includes("'strict-dynamic'"), `${label}: CSP must authorise the matching nonce.`);
  check(document.csp.includes("object-src 'none'") && document.csp.includes("base-uri 'none'"), `${label}: public CSP must retain object and base restrictions.`);
  return document.nonce;
}
function noAds(page, label) {
  const document = documentChecks(page, label);
  check(!/googlesyndication\.com|google-adsense-account|adsbygoogle\.js/i.test(page.html), `${label}: advertising code and verification meta must be absent.`);
  check(/(?:^|;)\s*default-src 'self'\s*(?:;|$)/.test(document.csp) && /(?:^|;)\s*script-src 'self'\s*(?:;|$)/.test(document.csp), `${label}: private page must retain the restrictive application CSP.`);
  check(!document.csp.includes("'strict-dynamic'") && !document.csp.includes("'unsafe-eval'"), `${label}: advertising script permissions must not reach this page.`);
}

const firstHomeNonce = hasAds(await read('/'), 'Anonymous public home');
const secondHomeNonce = hasAds(await read('/'), 'Second anonymous public home');
check(firstHomeNonce !== secondHomeNonce, 'Separate HTML responses must receive fresh unpredictable nonces.');
hasAds(await read('/index.html'), 'HTML entry alias');
hasAds(await read('/index.php'), 'PHP entry alias');
hasAds(await read('/?utm_source=local-shell-test'), 'Public home with an ordinary campaign parameter');
hasAds(await read('/', { cookie: 'sp_guest_extra=not-a-member-cookie' }), 'Unrelated cookie does not impersonate a guest profile');

for (const path of ['/?search=TESTCODE', '/?search=', '/?SEARCH=TESTCODE', '/?search[]=TESTCODE', '/?%73earch=TESTCODE', '/?demo=1', '/?demo=0', '/?create=1', '/?app=1', '/?app[]=1', '/search/TESTCODE', '/anything-private']) {
  noAds(await read(path), `Private route ${path}`);
}
for (const cookie of ['sp_guest=' + 'A'.repeat(43), 'sp_guest=not-a-real-session', 'sp_guest=', 'sp_guest[key]=value']) {
  noAds(await read('/', { cookie }), `Homepage with guest-cookie form ${cookie.slice(0, 24)}`);
}
for (const host of ['localhost:8789', 'localhost.:8789', 'preview.localhost:8789', '127.0.0.1:8789', '127.1.2.3:8789', '[::1]:8789']) {
  noAds(await read('/', { host }), `Local host ${host}`);
}

if (disabledBase) {
  noAds(await read('/', { origin: disabledBase }), 'Advertising disabled by server environment');
} else {
  console.log('Environment-disable case skipped: set TEST_ADS_DISABLED_BASE_URL to a second local server started with SEARCHPARTY_ADSENSE_ENABLED=0.');
}
console.log(`Passed ${checks} page-shell assertions. Only local HTML/headers were fetched; no Google resources were loaded.`);
