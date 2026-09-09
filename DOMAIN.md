# Moving QuicKcals onto its own domain

Everything below assumes the domain is bought and you can edit its DNS. The
app itself needs no code change — the only thing that knows the address is
`APP_BASE_URL`, and it is a secret, not a constant.

Do it in this order. Steps 1–4 are safe at any time and change nothing for
anyone using the app; step 5 is the switch.

## You do not need flyctl installed

Every `fly ...` command below has a point-and-click equivalent in the Fly
dashboard at <https://fly.io/dashboard>, and this deployment is set up so that
you never install the CLI: `.github/workflows/deploy.yml` runs it on GitHub's
runners instead. Open the app (`match-week-food-diary`) and use:

- **Certificates** — for `fly certs add` and `fly certs show`. Adding a
  hostname there prints the same DNS records the CLI does, and the page shows
  the certificate's status as it is issued.
- **Secrets** — for every `fly secrets set` below. Setting one restarts the
  app exactly as the CLI does.

The commands are given as commands because they are the shortest way to write
a step down, not because the CLI is required. The dashboard works from a
phone, which the CLI does not.

---

## 1. Point the domain at Fly

Fly needs to know the name before it can get a certificate for it.

```sh
fly certs add quickcals.com      # substitute the real domain throughout
fly certs add www.quickcals.com
```

Each prints the DNS records to create. They will look like:

| Type    | Name  | Value                                |
|---------|-------|--------------------------------------|
| `A`     | `@`   | the IPv4 Fly prints                  |
| `AAAA`  | `@`   | the IPv6 Fly prints                  |
| `CNAME` | `www` | `match-week-food-diary.fly.dev`      |

Add them at the registrar. Then wait — `fly certs show quickcals.com` tells
you when the certificate is issued. It is usually minutes; it can be an hour.

**Do not go on until both certificates say Ready.** Everything after this
assumes the domain answers over HTTPS.

## 2. Tell the app its own name

```sh
fly secrets set APP_BASE_URL=https://quickcals.com
```

This changes five things at once, which is why it comes before the accounts
below rather than after:

- the WHOOP OAuth callback
- password-reset links in email
- Stripe's success, cancel and portal return URLs
- share links (`/s/<token>`)
- referral invite links (`/?ref=<code>`)

Setting a secret restarts the app. Existing share links on the old address
keep working as long as the old address still resolves, which it does. So do
invite links: the code is what matters and it is read the same either way.
Referral codes themselves never change, so nothing anybody has already shared
is invalidated by the move.

## 3. Update the accounts that hold a copy of the URL

Three services store the callback address themselves and will refuse a
request that doesn't match. Each has to be edited by hand:

- **WHOOP** — developer dashboard, redirect URI → `https://quickcals.com/api/whoop/callback`.
  Add the new one before removing the old, so a connection in flight doesn't break.
- **Google sign-in** — Cloud Console → Credentials → the Web application client.
  Add `https://quickcals.com` to Authorised JavaScript origins.
- **Resend** — if password-reset email is on, verify the new domain and update
  `MAIL_FROM`. Until then reset links still send from the old sender, which
  works but looks wrong.

## 4. Turn on the canonical redirect

Once the domain is live and serving:

```sh
fly secrets set CANONICAL_HOST=true
```

Everything arriving on `www.` or on `*.fly.dev` is then 308'd to the apex.
Before this, the app answers on all three, which means three sets of cookies
and three PWA installs of the same thing.

Leave it off until the domain genuinely resolves. Turned on against a
hostname that isn't live, it redirects the whole app into nothing.

## 5. What this does to people already using it

- **Everyone is signed out.** Session cookies belong to the host that set
  them, and there is no way to carry them across. Worth a heads-up.
- **An installed PWA keeps working**, on the old address, redirected to the
  new one. It will not re-install itself; anyone who wants the icon pointing
  at the real domain has to add it again.
- **Old share links keep working** while the fly.dev name resolves, which is
  as long as the app is on Fly.

---

## Then, and only then: Stripe and AdSense

Both need a live domain, which is why they come last.

### Stripe

1. Create the four prices in the Stripe dashboard — Plus and Pro, monthly and
   yearly. The amounts are in `src/plans.ts`: £4.99 / £9.99 monthly, and nine
   times those yearly. Stripe holds the price; `plans.ts` holds what it buys.
2. Add the webhook endpoint: `https://quickcals.com/api/billing/webhook`,
   subscribed to `customer.subscription.created`, `.updated` and `.deleted`.
   Those three are the only events the app acts on.
3. Set the secrets:

```sh
fly secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_PLUS_MONTHLY=price_... \
  STRIPE_PRICE_PLUS_YEARLY=price_... \
  STRIPE_PRICE_PRO_MONTHLY=price_... \
  STRIPE_PRICE_PRO_YEARLY=price_...
```

Until all of `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set, the
billing surface reports itself off and no upgrade buttons appear. A key
without a webhook secret would take money and never hear that it had, which
is why both are required rather than either.

Test with Stripe's test keys first: a test-mode checkout, then check the
account moved plan in Settings. The plan changes when the webhook arrives,
not when the browser comes back.

### AdSense

1. Add the site in AdSense and verify it — verification needs the domain, not
   the fly.dev name.
2. Create a display unit for the Today screen; note its slot id.
3. Set the secrets:

```sh
fly secrets set ADSENSE_CLIENT_ID=ca-pub-... ADSENSE_SLOT_TODAY=...
```

Nothing loads until both are set. Turn on Google's own consent notice in the
AdSense account — the privacy policy already says it appears where the law
requires it, and that has to be true.

---

## Admin

```sh
fly secrets set ADMIN_USERNAMES=your-username
```

With that set, that account is the admin on every sign-in and every other
account has it taken away, whatever the database says. It is the only way to
make "I am the only admin" a fact rather than a state of affairs — a flag
granted in the UI can be granted again by whoever holds it.
