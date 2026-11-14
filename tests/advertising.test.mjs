import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/assets/advertising.js', import.meta.url), 'utf8');

// Run only our local bootstrap against fake DOM/CMP APIs. There is no browser,
// network, storage, advertising SDK or payment interaction in this harness.
function fixture({ settings = false, readyState = 'complete', existingAds = [] } = {}) {
  const timers = new Map();
  const documentListeners = new Map();
  const buttonListeners = new Map();
  const button = { disabled: true, addEventListener(name, callback) { buttonListeners.set(name, callback); } };
  const status = { textContent: '' };
  const slots = [0, 1].map(() => ({
    children: ['fake-ad-frame'],
    clears: 0,
    replaceChildren(...children) { this.children = children; this.clears++; },
    click() { assert.fail('Consent changes must never click an advertisement.'); },
  }));
  let timerId = 0;
  let consentListener;
  let registrations = 0;
  let revocations = 0;
  const document = {
    currentScript: { dataset: settings ? { adSettings: 'true' } : {} },
    readyState,
    getElementById(id) { return id === 'ad-choices' ? button : id === 'ad-choices-status' ? status : null; },
    addEventListener(name, callback) { documentListeners.set(name, callback); },
    querySelectorAll(selector) { assert.equal(selector, 'ins.adsbygoogle'); return slots; },
  };
  const window = {
    adsbygoogle: existingAds,
    googlefc: { callbackQueue: [] },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch() { assert.fail('The consent bootstrap must not send application data.'); },
  };
  for (const name of ['cookie', 'referrer', 'URL']) {
    Object.defineProperty(document, name, { get() { assert.fail(`The consent bootstrap must not read document.${name}.`); } });
  }
  for (const name of ['localStorage', 'sessionStorage', 'location']) {
    Object.defineProperty(window, name, { get() { assert.fail(`The consent bootstrap must not read window.${name}.`); } });
  }
  vm.runInNewContext(source, { window, document }, { filename: 'advertising.js', timeout: 1000 });
  return {
    window, button, status, slots, timers,
    get registrations() { return registrations; },
    get revocations() { return revocations; },
    ready({ api = true, throws = false, showChoices = true } = {}) {
      if (api) window.__tcfapi = (command, version, callback) => {
        assert.equal(command, 'addEventListener');
        assert.equal(version, 2);
        registrations++;
        if (throws) throw new Error('CMP unavailable');
        consentListener = callback;
      };
      else delete window.__tcfapi;
      if (showChoices) window.googlefc.showRevocationMessage = () => { revocations++; };
      else delete window.googlefc.showRevocationMessage;
      this.flushReadyQueue();
    },
    flushReadyQueue() {
      const queued = window.googlefc.callbackQueue.splice(0);
      for (const item of queued) {
        assert.equal(typeof item.CONSENT_API_READY, 'function');
        item.CONSENT_API_READY();
      }
    },
    consent(data, success = true) {
      assert.equal(typeof consentListener, 'function', 'TCF listener must be registered before reporting consent.');
      consentListener(data, success);
    },
    timeout(delay) {
      const pending = [...timers].filter(([, timer]) => timer.delay === delay);
      assert.ok(pending.length, `Expected a pending ${delay}ms deadline.`);
      for (const [id, timer] of pending) { timers.delete(id); timer.callback(); }
    },
    domReady() { documentListeners.get('DOMContentLoaded')?.(); },
    clickChoices() { buttonListeners.get('click')?.(); },
  };
}

function consent(overrides = {}) {
  return {
    cmpStatus: 'loaded', eventStatus: 'tcloaded', gdprApplies: true,
    purpose: { consents: { 1: true } }, vendor: { consents: { 755: true } },
    ...overrides,
  };
}

test('bootstrap synchronously pauses an existing queue and waits for the CMP readiness callback', () => {
  const queuedRequest = { existing: 'request' };
  const queue = [queuedRequest];
  queue.pauseAdRequests = 0;
  const page = fixture({ existingAds: queue });
  assert.equal(page.window.adsbygoogle, queue);
  assert.equal(queue.pauseAdRequests, 1);
  assert.equal(queue[0], queuedRequest);
  assert.equal(page.registrations, 0);
  assert.equal(page.window.googlefc.callbackQueue.length, 1);
  page.ready();
  assert.equal(page.registrations, 1);
  assert.equal(queue.pauseAdRequests, 1, 'API readiness alone is not consent.');
});

test('missing, throwing and timed-out CMP APIs fail closed', () => {
  for (const options of [{ api: false }, { throws: true }]) {
    const page = fixture({ settings: true });
    page.ready(options);
    assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
    assert.equal(page.button.disabled, true);
    assert.match(page.status.textContent, /unavailable|could not be checked/i);
  }
  const timedOut = fixture({ settings: true });
  timedOut.timeout(15000);
  assert.equal(timedOut.window.adsbygoogle.pauseAdRequests, 1);
  assert.equal(timedOut.button.disabled, true);
  assert.match(timedOut.status.textContent, /not loaded|unavailable/i);
  assert.equal(timedOut.revocations, 0);
});

test('homepage allows only stable loaded consent or an explicit non-GDPR region result', () => {
  for (const eventStatus of ['tcloaded', 'useractioncomplete']) {
    for (const data of [consent({ eventStatus }), consent({ eventStatus, gdprApplies: false, purpose: undefined, vendor: undefined })]) {
      const page = fixture();
      page.ready();
      page.consent(data);
      assert.equal(page.window.adsbygoogle.pauseAdRequests, 0);
      assert.equal(page.slots[0].clears, 0);
    }
  }
});

test('purpose 1 and vendor 755 must both be true booleans when GDPR applies', () => {
  for (const purpose of [true, false, undefined, 1, 'true']) {
    for (const vendor of [true, false, undefined, 1, 'true']) {
      const page = fixture();
      page.ready();
      page.consent(consent({ purpose: { consents: { 1: purpose } }, vendor: { consents: { 755: vendor } } }));
      assert.equal(page.window.adsbygoogle.pauseAdRequests, purpose === true && vendor === true ? 0 : 1, `purpose=${purpose}, vendor=${vendor}`);
    }
  }
});

test('missing, incomplete, failed and error-state responses stay paused', () => {
  const responses = [
    [null], [undefined], [{}],
    [consent(), false], [consent(), 'true'],
    [consent({ cmpStatus: 'error' })], [consent({ cmpStatus: 'loading' })], [consent({ cmpStatus: undefined })],
    [consent({ eventStatus: 'cmpuishown' })], [consent({ eventStatus: 'unknown' })],
    [consent({ gdprApplies: undefined })], [consent({ gdprApplies: 'false' })],
    [consent({ purpose: undefined })], [consent({ vendor: undefined })],
    [consent({ purpose: { consents: { 2: true } } })], [consent({ vendor: { consents: { 99: true } } })],
  ];
  for (const [data, success = true] of responses) {
    const page = fixture();
    page.ready();
    page.consent(data, success);
    assert.equal(page.window.adsbygoogle.pauseAdRequests, 1, JSON.stringify({ data, success }));
  }
});

test('withdrawal pauses requests and removes visible ad content without ad clicks', () => {
  const page = fixture();
  page.ready();
  page.consent(consent());
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 0);
  page.consent(consent({ eventStatus: 'useractioncomplete', purpose: { consents: { 1: false } } }));
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
  for (const slot of page.slots) {
    assert.equal(slot.children.length, 0);
    assert.equal(slot.clears, 1);
  }
  page.consent(consent({ vendor: { consents: { 755: false } } }));
  assert.equal(page.slots[0].clears, 1, 'Repeated denied events must not repeatedly modify slots.');
  assert.equal(page.revocations, 0, 'Withdrawal processing must not reopen Google choices by itself.');
});

test('a failed or unknown response after consent also withdraws permission immediately', () => {
  for (const [data, success] of [[null, false], [consent({ cmpStatus: 'error' }), true], [consent({ eventStatus: 'cmpuishown' }), true]]) {
    const page = fixture();
    page.ready();
    page.consent(consent());
    page.consent(data, success);
    assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
    assert.equal(page.slots[0].children.length, 0);
  }
});

test('standalone settings never enable ads even with complete consent or a non-GDPR visit', () => {
  for (const data of [consent(), consent({ eventStatus: 'useractioncomplete' }), consent({ gdprApplies: false })]) {
    const page = fixture({ settings: true });
    page.ready();
    page.consent(data);
    assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
    assert.equal(page.revocations, 0);
    assert.equal(page.slots[0].clears, 0);
  }
});

test('settings controls are unavailable until the real Google API can open choices', () => {
  const page = fixture({ settings: true, readyState: 'loading' });
  assert.equal(page.button.disabled, true);
  page.domReady();
  page.clickChoices();
  assert.equal(page.window.googlefc.callbackQueue.length, 1, 'A premature click must not queue a request to open choices.');
  page.ready({ showChoices: false });
  assert.equal(page.button.disabled, true);
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
  assert.match(page.status.textContent, /unavailable/i);
  page.clickChoices();
  assert.equal(page.revocations, 0);
});

test('settings opens choices only on a user click through the Google readiness queue', () => {
  const page = fixture({ settings: true });
  page.ready();
  page.consent(consent());
  assert.equal(page.button.disabled, false);
  assert.equal(page.revocations, 0);
  page.clickChoices();
  assert.equal(page.button.disabled, true);
  assert.equal(page.revocations, 0, 'The action must wait for the consent API readiness queue.');
  assert.match(page.status.textContent, /Asking Google/i);
  page.flushReadyQueue();
  assert.equal(page.revocations, 1);
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
  page.consent(consent({ eventStatus: 'cmpuishown' }));
  assert.match(page.status.textContent, /are open/i);
  page.consent(consent({ eventStatus: 'useractioncomplete' }));
  assert.equal(page.button.disabled, false);
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
});

test('settings does not claim a saved choice after an opening timeout or failed call', () => {
  const page = fixture({ settings: true });
  page.ready();
  page.consent(consent());
  page.clickChoices();
  page.flushReadyQueue();
  page.timeout(12000);
  assert.equal(page.button.disabled, true);
  assert.match(page.status.textContent, /cannot confirm|did not report opening/i);
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
  const failed = fixture({ settings: true });
  failed.ready();
  failed.consent(consent());
  failed.window.googlefc.showRevocationMessage = () => { throw new Error('Google unavailable'); };
  failed.clickChoices();
  failed.flushReadyQueue();
  assert.match(failed.status.textContent, /could not be opened/i);
  assert.equal(failed.button.disabled, true);
  assert.equal(failed.window.adsbygoogle.pauseAdRequests, 1);
});

test('non-applicable regional settings remain paused and explain why choices cannot open', () => {
  const page = fixture({ settings: true });
  page.ready();
  page.consent(consent({ gdprApplies: false }));
  assert.equal(page.button.disabled, true);
  assert.match(page.status.textContent, /do not apply|cannot open/i);
  page.clickChoices();
  assert.equal(page.revocations, 0);
  assert.equal(page.window.adsbygoogle.pauseAdRequests, 1);
});
