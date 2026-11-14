(function () {
  'use strict';

  // This classic script must run synchronously before Google's loader.
  var isSettings = document.currentScript && document.currentScript.dataset.adSettings === 'true';
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 1;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];

  var apiReady = false;
  var listenerRegistered = false;
  var requestsAllowed = false;
  var regionApplies;
  var uiState = 'loading';
  var uiMessage = 'Loading Google’s advertising choices…';
  var openingTimer;

  function paintSettings() {
    if (!isSettings) return;
    var button = document.getElementById('ad-choices');
    var status = document.getElementById('ad-choices-status');
    if (button) button.disabled = !apiReady || typeof window.googlefc.showRevocationMessage !== 'function' || regionApplies === false || uiState === 'unavailable' || uiState === 'opening' || uiState === 'open';
    if (status) status.textContent = uiMessage;
  }

  function setStatus(state, message) {
    uiState = state;
    uiMessage = message;
    paintSettings();
  }

  function pauseRequests() {
    window.adsbygoogle.pauseAdRequests = 1;
    if (requestsAllowed) {
      // Remove visible slot contents after an allowed state is withdrawn.
      document.querySelectorAll('ins.adsbygoogle').forEach(function (slot) {
        slot.replaceChildren();
      });
    }
    requestsAllowed = false;
  }

  var startupTimer = window.setTimeout(function () {
    if (!apiReady) {
      pauseRequests();
      setStatus('unavailable', 'Google’s advertising choices have not loaded. The service may be unavailable or blocked by your browser. No choice has been changed here; you can retry below.');
    }
  }, 15000);

  function onConsentData(tcdata, success) {
    var complete = success === true && tcdata && tcdata.cmpStatus === 'loaded' && (tcdata.eventStatus === 'tcloaded' || tcdata.eventStatus === 'useractioncomplete');
    var consented = complete && tcdata.gdprApplies === true && tcdata.purpose && tcdata.purpose.consents && tcdata.purpose.consents[1] === true && tcdata.vendor && tcdata.vendor.consents && tcdata.vendor.consents[755] === true;
    var eligible = complete && (tcdata.gdprApplies === false || consented);

    if (!isSettings && eligible) {
      // This gate does not replace Google's checks for all other purposes.
      requestsAllowed = true;
      window.adsbygoogle.pauseAdRequests = 0;
    } else {
      pauseRequests();
    }

    if (!isSettings) return;
    if (success !== true || !tcdata || tcdata.cmpStatus === 'error') {
      window.clearTimeout(openingTimer);
      setStatus('unavailable', 'Google’s advertising choices could not be checked. No choice has been confirmed here. Please retry below.');
      return;
    }
    if (complete && tcdata.gdprApplies === false) {
      regionApplies = false;
      window.clearTimeout(openingTimer);
      setStatus('not-applicable', 'Google reports that its European consent choices do not apply to this visit. This button cannot open those choices here.');
      return;
    }
    if (tcdata.gdprApplies === true) regionApplies = true;
    if (tcdata.eventStatus === 'cmpuishown') {
      window.clearTimeout(openingTimer);
      setStatus('open', 'Google’s advertising choices are open. Use Google’s message to review or change them.');
    } else if (complete) {
      window.clearTimeout(openingTimer);
      setStatus('ready', 'Google’s advertising choices are available. Use the button to review or change them.');
    } else {
      paintSettings();
    }
  }

  function onConsentApiReady() {
    apiReady = true;
    window.clearTimeout(startupTimer);
    if (typeof window.__tcfapi !== 'function') {
      pauseRequests();
      setStatus('unavailable', 'Google’s European consent API is unavailable for this visit. No choice has been changed here; you can retry below.');
      return;
    }
    if (isSettings && typeof window.googlefc.showRevocationMessage !== 'function') {
      setStatus('unavailable', 'Google’s advertising choices are unavailable for this visit. Please retry below.');
      return;
    }
    setStatus('ready', 'Google’s advertising choices are available. Use the button to review or change them.');
    if (listenerRegistered) return;
    listenerRegistered = true;
    try {
      window.__tcfapi('addEventListener', 2, onConsentData);
    } catch (error) {
      pauseRequests();
      setStatus('unavailable', 'Google’s advertising choices could not be checked. Please retry below.');
    }
  }

  window.googlefc.callbackQueue.push({ CONSENT_API_READY: onConsentApiReady });

  function bindSettingsControls() {
    if (!isSettings) return;
    var button = document.getElementById('ad-choices');
    if (button) button.addEventListener('click', function () {
      if (button.disabled) return;
      pauseRequests();
      setStatus('opening', 'Asking Google to open your advertising choices…');
      openingTimer = window.setTimeout(function () {
        setStatus('unavailable', 'Google’s choices did not report opening. If no message appeared, retry below. This page cannot confirm a change to your choices.');
      }, 12000);
      window.googlefc.callbackQueue.push({ CONSENT_API_READY: function () {
        try {
          if (typeof window.googlefc.showRevocationMessage !== 'function') throw new Error('Choices unavailable');
          window.googlefc.showRevocationMessage();
        } catch (error) {
          window.clearTimeout(openingTimer);
          setStatus('unavailable', 'Google’s advertising choices could not be opened. Please retry below.');
        }
      } });
    });
    paintSettings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSettingsControls, { once: true });
  } else {
    bindSettingsControls();
  }
}());
