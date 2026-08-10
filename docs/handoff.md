# Handoff — Subscription Landing Page ("Yourgi Membership")

**From:** Lauren Palma · **Created:** 10 August 2026

---

> **Read `project-context.md` in this folder first.** It's synthesized from the 10 Aug 2026 team discussion and is the authoritative source on the offer (working name: **"Yourgi Prime"**). This prototype was scaffolded before that doc existed, and several of its placeholders contradict it — the README lists the conflicts. Where the two disagree, the context doc wins.

## What this is

A standalone landing page testing one question: **will customers sign up for a recurring pet-care subscription?**

It was seeded from the Concierge Landing Page ("Best Care Guarantee"), which tested a flat-rate, human-in-the-loop booking model. This page reuses that page's brand shell, nav, footer, reviews, Mixpanel/Segment wiring, zip market gate, and form validation.

**The one difference that matters:** the concierge page was deliberately a "fake front end" — a real person followed up manually and no money moved. This page **takes real money**. That changes what can be a placeholder and what can't.

## What was carried over vs. built new

| Carried over unchanged | Built new for this page |
|---|---|
| Brand CSS (colors, type, buttons, `.band` sections) | Three-tier picker + benefits list |
| Nav (incl. overflow menu) and footer | Stripe Payment Link handoff |
| Mixpanel + Segment snippets | Return-from-Stripe states (success / cancel) |
| Zip market gate (CO, ME, MA, NH, OR, TX, WA) | "How it works" and FAQ sections |
| Phone/zip/email validation and masking | Dry-run mode |
| Reviews and the Yourgi Guarantee band | |

**Deliberately dropped:** the date-range calendar and all quote math — a subscription has neither.

## Current status

**Dry-run.** `STRIPE_PAYMENT_LINKS` is empty, so "Continue to payment" captures the lead and shows the confirmation screen **without charging anyone**. 72 headless checks pass. Every price, tier name, benefit, and FAQ answer on the page is a labeled placeholder.

## How the flow works

1. Visitor picks a tier and enters zip, phone, email, pet count.
2. Validation runs. Bad input blocks the submit and fires `Validation Failed`.
3. **Zip gate.** Out of market → the lead is captured, an interest screen shows, and the visitor is **never sent to Stripe**. Nobody pays for a plan we can't staff.
4. In market → the lead is captured *first* (Teams + Segment `Lead Captured`), *then* the visitor goes to Stripe. Capturing first means an abandoned checkout still tells us who was interested and in which tier.
5. Stripe redirects back with `?checkout=success` or `?checkout=cancel`.

## Wiring up Stripe (the remaining build work)

The page uses **Stripe Payment Links** — one hosted link per tier. Why: a Payment Link needs no server and no secret key, so the page stays a single static file that drops into Webflow custom code, and card entry happens on Stripe's domain, never on ours. This matches the plan in `project-context.md` §4: a Webflow page linking out to Stripe-hosted checkout, with Stripe handling billing notices and cancellation.

**Check what already exists before building.** `project-context.md` §4 says a Stripe subscription page *has already been prototyped and is connected to Yourgi's Stripe account, unpublished*. Find it before creating new Products — you may only need to publish and grab links. Lauren still needs Stripe access provisioned (§8 gap 9).

1. In the Stripe Dashboard, create three recurring **Products** matching the approved tiers.
2. For each, create a **Payment Link**, and set its "After payment" behavior to redirect to this page's URL with `?checkout=success` appended.
3. Paste the three links into `STRIPE_PAYMENT_LINKS` at the top of the `<script>` block in `index.html`.
4. Set `TEAMS_WEBHOOK_URL` to a **new** Power Automate flow with its own Teams channel.
5. Re-run `node test/prototype.test.mjs`.

**Do not** paste a Stripe *secret* key (`sk_live_…`/`sk_test_…`) into this file. Payment Links and publishable keys are safe in page source; secret keys are not. The test suite asserts no secret key is present.

## Things a reviewer should push on

- **`?checkout=success` is a UI signal, not proof of payment.** Anyone can type it into the URL bar. The `Subscription Started` event is tagged `verified: false` for exactly this reason. **Stripe's Dashboard is the source of truth for who actually subscribed** — do not report signup counts from Mixpanel alone. The planned fix is already in `project-context.md` §4: a **Stripe webhook** posting each signup into a dedicated Teams channel. That webhook, not this page, is what makes signups trustworthy.
- **`TEAMS_WEBHOOK_URL` is intentionally empty**, and given the above it may stay that way — if the Stripe webhook handles notifications server-side, this page's client-side post is redundant. Either way it must not reuse the concierge team's order-form channel (§7 q6 leans to a new, separate channel).
- **Fulfillment is manual and unscoped.** §4 says staff issue coupons by hand to zero out each subscriber's bookings, and follow up individually to set up services. §8 gap 6 notes nobody has estimated how many signups that survives. This is the operational ceiling on the whole test.
- **Subsidy exposure is a live risk.** §6 flags that pros get paid their full rate while the subscriber's cost is zeroed — the worked example is someone booking $200/night house-sitting on a $50 flat fee. Guardrails aren't defined yet.
- **Taking real payments raises the bar on copy.** The concierge page could ship with placeholder rates because nobody was charged. Here, the price, what's included, rollover, and cancellation terms are the product — they need Kai and Legal sign-off, not a placeholder label.
- **Segment reuses the concierge page's write key**, distinguished by `form_type: 'subscription_landing_page'`. Confirm that's the right source before launch.
- **Event names need a lexicon check.** `Plan Selected`, `Checkout Started`, `Subscription Started`, `Checkout Abandoned`, and `Membership Checkout Clicked` are new; the concierge page's events were renamed once already to match the org lexicon.

## Editing

Plain HTML/CSS/JS, no build step. Keep `deploy/index.html` in sync with the canonical `index.html`. Run all customer-facing copy through the `yourgi-brand` skill.

Questions → Lauren Palma (lauren.palma@destpet.com).
