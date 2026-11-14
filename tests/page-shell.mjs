import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';

// Fetch local HTML/headers only. Host headers exercise the production gates;
// redirects, scripts, images, Google resources and ads are never followed.
const base = localBase(process.env.TEST_BASE_URL || 'http://127.0.0.1:8789');
const disabledBase = optionalBase('TEST_ADS_DISABLED_BASE_URL');
const enabledBase = optionalBase('TEST_ADS_ENABLED_BASE_URL');
const cmpOnlyBase = optionalBase('TEST_CMP_ONLY_BASE_URL');
const publisher = 'ca-pub-8610536439975607';
const adScript = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`;
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function optionalBase(name) { return process.env[name] ? localBase(process.env[name]) : null; }
function localBase(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Page-shell tests only connect to localhost.');
  return url.origin;
}
function read(path = '/', { host = 'searchpals.co.uk', cookie, origin = enabledBase || base } = {}) {
  const target = new URL(path, origin);
  if (target.origin !== origin) throw new Error('Test requests must stay on the local server.');
  return new Promise((resolve, reject) => {
    const client = target.protocol === 'https:' ? https : http;
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
function documentChecks(page, label, { requireScripts = true } = {}) {
  check(page.status === 200, `${label}: expected HTML 200, got ${page.status}. Build release-upload first.`);
  check(String(page.headers['content-type']).startsWith('text/html'), `${label}: content must be HTML.`);
  check(/no-store/i.test(String(page.headers['cache-control'])), `${label}: personalised page selection must not be cached.`);
  check(/\bcookie\b/i.test(String(page.headers.vary)), `${label}: cache variation must include Cookie.`);
  check(page.headers['x-content-type-options'] === 'nosniff', `${label}: MIME sniffing must be disabled.`);
  check(page.headers['referrer-policy'] === 'strict-origin', `${label}: outgoing referrers must exclude page paths and queries.`);
  check(!page.headers['set-cookie'], `${label}: loading a page must not create a profile cookie.`);
  const scripts = Array.from(page.html.matchAll(/<script\b([^>]*)>/gi));
  if (requireScripts) check(scripts.length > 0, `${label}: expected a built application or consent script.`);
  const nonces = scripts.map(match => {
    const values = Array.from(match[1].matchAll(/\bnonce="([^"]+)"/gi));
    check(values.length === 1, `${label}: every script needs exactly one nonce.`);
    check(/^[A-Za-z0-9+/]+={0,2}$/.test(values[0][1]) && Buffer.from(values[0][1], 'base64').length >= 16, `${label}: nonce must contain at least 128 random bits.`);
    return values[0][1];
  });
  check(nonces.every(value => value === nonces[0]), `${label}: script nonces must match within a document.`);
  return { scripts, nonce: nonces[0], csp: String(page.headers['content-security-policy'] || '') };
}
function noGoogleMarkup(page, label) {
  check(!/googlesyndication\.com|fundingchoicesmessages\.google\.com|google-adsense-account|adsbygoogle\.js/i.test(page.html), `${label}: Google loaders and publisher verification meta must be absent.`);
}
function hasGoogle(page, label, { settings = false } = {}) {
  const document = documentChecks(page, label);
  const loaders = document.scripts.filter(match => match[1].includes(adScript));
  check(loaders.length === 1, `${label}: expected exactly the configured Google loader.`);
  check(/\basync\b/.test(loaders[0][1]) && /crossorigin="anonymous"/.test(loaders[0][1]), `${label}: Google loader attributes must match the integration.`);
  const bootstrap = document.scripts.filter(match => /\bsrc="\/assets\/advertising\.js"/.test(match[1]));
  check(bootstrap.length === 1, `${label}: consent bootstrap must load exactly once.`);
  check(!/\b(?:async|defer)\b|type="module"/.test(bootstrap[0][1]), `${label}: consent pause must execute synchronously before Google.`);
  check(document.scripts.indexOf(bootstrap[0]) < document.scripts.indexOf(loaders[0]), `${label}: consent bootstrap must precede Google.`);
  check(/data-ad-settings="true"/.test(bootstrap[0][1]) === settings, `${label}: settings mode must be explicit and must never opt the home into settings mode.`);
  if (!settings) check(page.html.includes(`name="google-adsense-account" content="${publisher}"`), `${label}: publisher verification meta must be present on the ad homepage.`);
  check(document.csp.includes(`'nonce-${document.nonce}'`) && document.csp.includes("'strict-dynamic'"), `${label}: CSP must authorise the matching nonce.`);
  check(document.csp.includes("object-src 'none'") && document.csp.includes("base-uri 'none'"), `${label}: Google-enabled CSP must retain object and base restrictions.`);
  check(document.csp.includes("frame-ancestors 'self'"), `${label}: frame restrictions must remain enabled.`);
  return document.nonce;
}
function noAds(page, label, options = {}) {
  const document = documentChecks(page, label, options);
  noGoogleMarkup(page, label);
  check(!/\/assets\/advertising\.js/.test(page.html), `${label}: ordinary private/default-off documents must not initialise advertising.`);
  check(/(?:^|;)\s*default-src 'self'\s*(?:;|$)/.test(document.csp) && /(?:^|;)\s*script-src 'self'\s*(?:;|$)/.test(document.csp), `${label}: private page must retain the restrictive application CSP.`);
  check(!document.csp.includes("'strict-dynamic'") && !document.csp.includes("'unsafe-eval'"), `${label}: Google script permissions must not reach this page.`);
  return document.nonce;
}
function cleanRedirect(page, destination, label, secret = '') {
  check(page.status === 303, `${label}: query/alias must redirect before serving any document.`);
  check(page.headers.location === destination, `${label}: redirect must use the fixed clean local destination.`);
  check(page.headers['referrer-policy'] === 'no-referrer', `${label}: redirect must suppress the incoming private URL as a referrer.`);
  check(/no-store/i.test(String(page.headers['cache-control'])), `${label}: redirect must not be cached.`);
  check(!/<script\b/i.test(page.html), `${label}: redirect must not execute scripts.`);
  noGoogleMarkup(page, label);
  if (secret) check(!JSON.stringify(page).includes(secret), `${label}: the incoming query must not be echoed in headers or HTML.`);
}
function settingsChecks(page, label, google) {
  if (google) hasGoogle(page, label, { settings: true });
  else noAds(page, label, { requireScripts: false });
  check(!/<script\b[^>]*type="module"/i.test(page.html), `${label}: settings must not load the React application.`);
  const sources = Array.from(page.html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi), match => match[1]);
  check(sources.every(src => src === '/assets/advertising.js' || src === adScript), `${label}: standalone settings may load only the consent bootstrap and configured Google script.`);
  check(!/<ins\b[^>]*adsbygoogle/i.test(page.html), `${label}: settings must not contain an ad placement.`);
  check(page.html.includes('href="/privacy"') && page.html.includes('href="/cookies"'), `${label}: settings must link to readable privacy and cookie information.`);
}

noAds(await read('/', { origin: base }), 'Advertising is off by default');
const homepageCheck = enabledBase ? hasGoogle : noAds;
const firstHomeNonce = homepageCheck(await read('/'), 'Anonymous public home');
const secondHomeNonce = homepageCheck(await read('/'), 'Second anonymous public home');
check(firstHomeNonce !== secondHomeNonce, 'Separate HTML responses must receive fresh unpredictable nonces.');
homepageCheck(await read('/index.html'), 'Clean HTML home alias');
homepageCheck(await read('/index.php'), 'Clean PHP home alias');
homepageCheck(await read('/', { host: 'www.searchpals.co.uk' }), 'Explicitly allowed www host');
homepageCheck(await read('/', { cookie: 'sp_guest_extra=not-a-member-cookie' }), 'Unrelated cookie does not impersonate a guest profile');

for (const path of ['/?search=TESTCODE', '/?search=', '/?SEARCH=TESTCODE', '/?search[]=TESTCODE', '/?%73earch=TESTCODE', '/?demo=1', '/?demo=0', '/?create=1', '/?app=1', '/?app[]=1', '/?privacy=1', '/?PRIVACY=1', '/?privacy[]=1', '/?search=TESTCODE&utm_source=campaign', '/search/TESTCODE', '/anything-private']) {
  noAds(await read(path), `Private route ${path}`);
}
for (const cookie of ['sp_guest=' + 'A'.repeat(43), 'sp_guest=not-a-real-session', 'sp_guest=', 'sp_guest[key]=value']) {
  noAds(await read('/', { cookie }), `Homepage with guest-cookie form ${cookie.slice(0, 24)}`);
}
for (const host of ['localhost:8789', 'localhost.:8789', 'preview.localhost:8789', '127.0.0.1:8789', '127.1.2.3:8789', '[::1]:8789', 'searchparty.test', 'preview.searchpals.co.uk', 'searchpals.co.uk.evil.example', 'evilsearchpals.co.uk', 'exquisite-cyan-aardvark.91-204-209-67.cpanel.site']) {
  noAds(await read('/', { host }), `Excluded host ${host}`);
  settingsChecks(await read('/ad-settings', { host }), `Settings on excluded host ${host}`, false);
}

for (const origin of [...new Set([base, enabledBase, disabledBase, cmpOnlyBase].filter(Boolean))]) {
  for (const path of ['/?utm_source=private-marker-49182', '/?unknown=private-marker-49182', '/?utm_source[]=private-marker-49182']) {
    cleanRedirect(await read(path, { origin }), '/', `Campaign query ${path}`, 'private-marker-49182');
  }
  for (const path of ['/ad-settings?search=private-marker-49182', '/ad-settings/?room=private-marker-49182', '/ad-settings.html?private-marker-49182', '/ad-settings?app=1&privacy=private-marker-49182']) {
    cleanRedirect(await read(path, { origin }), '/ad-settings', `Settings query ${path}`, 'private-marker-49182');
  }
  for (const path of ['/ad-settings/', '/ad-settings.html']) {
    cleanRedirect(await read(path, { origin }), '/ad-settings', `Settings alias ${path}`);
  }
}

settingsChecks(await read('/ad-settings', { origin: base }), 'Settings are inert before CMP readiness', false);
settingsChecks(await read('/ad-settings'), 'Standalone public settings', Boolean(enabledBase));
if (enabledBase) settingsChecks(await read('/ad-settings', { cookie: 'sp_guest=existing-member' }), 'Existing members can manage consent on clean settings', true);
if (disabledBase) {
  noAds(await read('/', { origin: disabledBase }), 'Advertising blocked without CMP readiness');
  settingsChecks(await read('/ad-settings', { origin: disabledBase }), 'Settings blocked without CMP readiness', false);
} else {
  console.log('ADS-only gate skipped: set TEST_ADS_DISABLED_BASE_URL to a local server with ADSENSE_ENABLED=1 and CMP_READY=0.');
}
if (cmpOnlyBase) {
  noAds(await read('/', { origin: cmpOnlyBase }), 'CMP readiness alone cannot enable homepage ads');
  settingsChecks(await read('/ad-settings', { origin: cmpOnlyBase }), 'CMP-only server still allows consent management', true);
  settingsChecks(await read('/ad-settings', { origin: cmpOnlyBase, cookie: 'sp_guest=existing-member' }), 'CMP-only settings remain available to existing members', true);
} else {
  console.log('CMP-only gate skipped: set TEST_CMP_ONLY_BASE_URL to a local server with CMP_READY=1 and ADSENSE_ENABLED=0.');
}
for (const slug of ['privacy', 'cookies', 'terms', 'safety']) {
  for (const path of [`/${slug}`, `/${slug}/`, `/${slug}.html`]) {
    const page = await read(path);
    check(page.status === 200, `${path}: readable policy page must exist.`);
    check(page.html.includes('Simon Woolston'), `${path}: operator identity must be present in the document.`);
    check(!/<script\b|googlesyndication\.com|adsbygoogle\.js/i.test(page.html), `${path}: policies require neither JavaScript nor advertising.`);
    check(!page.headers['set-cookie'], `${path}: reading policies must not create a guest cookie.`);
    check(page.headers['referrer-policy'] === 'strict-origin', `${path}: policies must strip path/query referrers.`);
    check(String(page.headers['content-security-policy']).includes("default-src 'none'"), `${path}: static policies must have a restrictive CSP.`);
    check(page.html.includes('href="/privacy"') && page.html.includes('href="/terms"'), `${path}: policy navigation must remain available.`);
  }
}
console.log(`Passed ${checks} page-shell assertions. Only local HTML/headers were fetched; no Google resources were loaded.`);
