/*
 * Remembers where somebody first arrived from, until they sign up.
 *
 * Loaded by every public page — the landing page, the guides, and the app
 * shell — because the first page of a visit can be any of them, and the whole
 * point is to record the *first* one rather than whichever page happened to
 * hold the sign-up button. See src/attribution.ts for what the server does
 * with it and why it keeps so little.
 *
 * No third-party script, no cookie, no identifier that follows anybody
 * anywhere. One object in this browser's own storage, sent once with the
 * sign-up request and then deleted.
 */
(function () {
  var KEY = "quickcals.attribution";

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      // Private window, or site data blocked. Attribution is a nicety; the
      // page it is running on is not, so nothing here may throw upwards.
      return null;
    }
  }

  function write(value) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(value));
    } catch (error) {
      /* not essential */
    }
  }

  // First touch wins: if there is already something stored, this visit is a
  // later page of a journey that started somewhere else, and overwriting it
  // would credit the signup to our own site.
  if (read() === null) {
    var params = new URLSearchParams(window.location.search);
    write({
      referrer: document.referrer || undefined,
      // An explicit tag beats an inferred one, and it is the only thing that
      // can identify a link pasted into a group chat — those arrive with no
      // referrer at all and are otherwise indistinguishable from somebody
      // typing the address in.
      source: params.get("utm_source") || params.get("ref_source") || undefined,
      campaign: params.get("utm_campaign") || undefined,
      landing: window.location.pathname || undefined,
    });
  }

  /** What to send with a sign-up, or null if there is nothing worth sending. */
  window.quickcalsAttribution = read;

  /** Spent once the account exists, so the next account on this device is its own. */
  window.quickcalsClearAttribution = function () {
    try {
      window.localStorage.removeItem(KEY);
    } catch (error) {
      /* nothing depends on it */
    }
  };
})();
