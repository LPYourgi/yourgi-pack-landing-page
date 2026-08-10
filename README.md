# Subscription Landing Page ("Yourgi Membership")

A standalone subscription landing page — visitor picks one of three membership tiers, enters their contact info, and **completes a real purchase through Stripe**. Tests whether customers will sign up for a recurring pet-care plan.

Seeded from the [Concierge Landing Page](../Concierge%20Landing%20Page) repo on 2026-08-10. Same brand shell, nav/footer, analytics wiring, zip market gate, and form validation — different offer and, critically, a **real payment flow instead of a manual concierge follow-up**.

**New here? → Read [`docs/handoff.md`](docs/handoff.md) first.**

## Files

- `index.html` — the prototype (canonical). Double-click to open, or serve it (see below).
- `deploy/index.html` — identical copy, ready to drop into a static host. Keep in sync.
- `test/prototype.test.mjs` — 72 headless checks. See "Testing".
- `docs/handoff.md` — start-here onboarding, open decisions, and the Stripe wiring steps.

## Status

**Prototype, not production.** It runs in **dry-run mode** out of the box: no Stripe links are configured, so "Continue to payment" captures the lead and shows the confirmation screen without charging anyone. Nothing on this page has been priced, brand-reviewed, or approved.

## Blocking decisions — nothing ships until these land

| # | Decision | Owner |
|---|----------|-------|
| 1 | **Tier names, prices, and what's actually included.** All three tiers are placeholders. | Kai |
| 2 | **Rollover policy for unused visits.** The FAQ flags this as the question that decides signups. | Kai |
| 3 | **Cancellation policy** — immediate or end-of-cycle, and any proration on plan switches. | Kai / Legal |
| 4 | **Who owns the Stripe account and products**, and who has Dashboard access. | Jeff / Finance |
| 5 | **How a subscription becomes a real customer record.** Stripe is currently the only record — see handoff. | Jeff |
| 6 | **Where signup notifications land.** Deliberately unset; must NOT reuse the concierge team's booking channel. | Kai / Jeff |
| 7 | **Guarantee wording for a recurring plan.** Legal boundaries are undocumented. | Legal |
| 8 | Page slug (`yourgi.com/join`?) and National 2 font + official logo lockup | Webflow / brand |

## Running it

Open `index.html` directly, or serve it to exercise the JS:

```bash
python3 -m http.server 8137
```

To see the post-Stripe screens without a real payment, append `?checkout=success` or `?checkout=cancel` to the URL.

## Testing

```bash
npm install jsdom && node test/prototype.test.mjs
```

Covers tier switching, validation, phone/zip masking, the market gate, dry-run behavior, Stripe URL construction, out-of-market handling, webhook payload and failure, and both return-from-Stripe states. The suite stubs Mixpanel, Segment, and `fetch`, so **it never fires a real side effect** — keep it that way.

---
_Related: [Concierge Landing Page](../Concierge%20Landing%20Page) — the flat-rate test this page was seeded from._
