/*
 * Remembers how somebody arrived, until they sign up.
 *
 * Two jobs: where they came from, and any invite they were carrying.
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
  // The key app.js already reads for a referral code. Writing the same one
  // means an invite followed to any page reaches the sign-up form intact.
  var REFERRAL_KEY = "referralCode";
  var TEAM_KEY = "quickcals.teamInvite";

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
  var params = new URLSearchParams(window.location.search);

  if (read() === null) {
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

  /*
   * Invites.
   *
   * The bug this fixes: "/?ref=CODE" serves the landing page to anybody
   * without an account — which is everybody an invite is sent to — and that
   * page read no parameters and linked onward to "/?app=1", dropping the code.
   * Every referral link ever sent lost its code before the sign-up form.
   *
   * Captured here rather than on the sign-up screen because this script runs
   * on every public page, so an invite still counts if the person reads two
   * guides and the pricing before they get round to signing up.
   */
  var ref = params.get("ref");
  if (ref) {
    try { window.localStorage.setItem(REFERRAL_KEY, ref.trim().slice(0, 32)); } catch (e) {}
  }
  var team = params.get("team");
  if (team) {
    try { window.localStorage.setItem(TEAM_KEY, team.trim().slice(0, 20)); } catch (e) {}
  }

  /** A team invite waiting to be accepted, or null. */
  window.quickcalsTeamInvite = function () {
    try { return window.localStorage.getItem(TEAM_KEY) || null; } catch (e) { return null; }
  };
  window.quickcalsClearTeamInvite = function () {
    try { window.localStorage.removeItem(TEAM_KEY); } catch (e) {}
  };

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
