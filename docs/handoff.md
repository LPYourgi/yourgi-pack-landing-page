# Handoff — Subscription Landing Page ("Yourgi Pack")

**From:** Lauren Palma · **Created:** 10 August 2026 · **Reconciled against the PRD:** 10 August 2026

---

> **Read `project-context.md` in this folder first.** It's synthesized from the 10 Aug 2026 team discussion
> and is the authoritative source on the offer. The page has now been reconciled against it — where the two
> disagree, the context doc wins and the page is wrong.

## What this is

A standalone landing page testing one question: **will people sign up for a recurring pet-care plan?**

It was seeded from the Concierge Landing Page ("Best Care Guarantee"), which tested a flat-rate,
human-in-the-loop booking model. This page reuses that page's brand shell, footer, reviews,
Mixpanel/Segment wiring, zip gate, and form validation. It does **not** reuse the site nav — see
"Deliberately dropped" below.

**The one difference that matters:** the concierge page was deliberately a "fake front end" — a real person
followed up manually and no money moved. This page **takes real money**. That changes what can be a
placeholder and what can't. A price, what's included, rollover, and cancellation terms aren't decoration
here; they're the product.

## The offer, and why it's shaped this way

Three capped, walking-led plans at $49 / $99 / $399. Every structural choice traces to the PRD:

| Choice | Why | Source |
|---|---|---|
| ~~$99–$199, no $49 plan~~ → **$49 / $99 / $399** | **OVERRIDDEN 12 Aug 2026** (Figma pass, Lauren's call). §7 q1 rejected $50 as too low and floated $100–$200; the entry plan is now $49. Re-open with David — see the pricing note in README.md | §7 q1 |
| Capped, never "unlimited" | The cap **is** the subsidy guardrail — an unlimited plan is the $200/night house-sitting exposure | §6 |
| Walking on every plan, daycare only at the top | Walking is repeatable and the best subscription fit | §7 q3 |
| Boarding/overnight explicitly excluded, and the FAQ says so | Occasional and trip-driven — a poor subscription fit | §7 q3 |
| **No Guarantee claim anywhere on the page** | Coverage is undetermined and legally risky | §8 gap 4 |
| Beta framing above the fold | Enrolled subscribers need an off-ramp and honest comms | §8 gap 5 |
| One optional "which days?" free-text box | Concierge sets each subscriber up by hand and needs this to make the call | §4, §7 q4 |

**The Guarantee band from the concierge page is gone.** A Guarantee band on a page taking recurring money
reads as a coverage claim whether or not it says so. It was replaced with a "Straight up: this plan is new"
band that does the trust job honestly. If Legal confirms coverage, that band is where the Guarantee goes
back. A test asserts the claim hasn't crept back in.

## What was carried over vs. built new

| Carried over unchanged | Built new for this page |
|---|---|
| Brand CSS (colors, type, buttons, `.band` sections) | Three-plan picker + benefits list |
| Footer | Stripe Payment Link handoff, one link per plan |
| Mixpanel + Segment snippets | Return-from-Stripe states (success / cancel) |
| Zip gate (CO, ME, MA, NH, OR, TX, WA) | Beta ribbon + honest-beta band |
| Phone/zip/email validation and masking | Optional "which days do you need?" field |
| Reviews | "How Yourgi Pack works" and FAQ |

**Deliberately dropped:**

- The date-range calendar and all quote math — a plan has neither.
- The Guarantee band (above).
- **The whole site nav.** This page stands on its own; §6 has it decoupled from the app with no
  authentication. Nav links would only leak people out of the one page whose entire job is measuring
  whether they sign up. What's left is the logo, linked to yourgi.com so someone about to hand over a card
  can confirm who they're paying. Tests assert the nav holds exactly one link and that no dead nav CSS or JS
  lingers — if a reviewer asks for "Book now" back, that's a conversion decision, not a cleanup.

## Current status

**Dry-run.** `STRIPE_PAYMENT_LINKS` is empty, so "Continue to payment" captures the lead and shows the
confirmation screen **without charging anyone**. 137 headless checks pass.

## How the flow works

1. Visitor picks a plan and enters zip and email (required), plus phone, dog count, and which days they
   need (all optional).
2. Validation runs. Bad input blocks the submit and fires `Validation Failed`.
3. **Zip gate.** Out of market → the lead is captured, an honest "no Pros there yet" screen shows, and the
   visitor is **never sent to Stripe**. Nobody pays for a plan we can't run.
4. In market → the lead is captured *first* (Teams + Segment `Lead Captured`), *then* the visitor goes to
   Stripe. Capturing first means an abandoned checkout still tells us who was interested and in which plan —
   which, for an experiment measuring willingness to pay, is most of the signal.
5. Stripe redirects back with `?checkout=success` or `?checkout=cancel`.

## Wiring up Stripe (the remaining build work)

The page uses **Stripe Payment Links** — one hosted link per plan. Why: a Payment Link needs no server and
no secret key, so the page stays a single static file that drops into Webflow custom code, and card entry
happens on Stripe's domain, never on ours. This matches §4: a Webflow page linking out to Stripe-hosted
checkout, with Stripe handling billing notices and cancellation.

**Check what already exists before building.** §4 says a Stripe subscription page *has already been
prototyped and is connected to Yourgi's Stripe account, unpublished*. Find it before creating new Products —
you may only need to publish it and grab the links. Lauren still needs Stripe access provisioned (§8 gap 9).

1. In the Stripe Dashboard, create three recurring **Products** matching the approved plans.
2. For each, create a **Payment Link**, and set its "After payment" behavior to redirect to this page's URL
   with `?checkout=success` appended.
3. Paste the three links into `STRIPE_PAYMENT_LINKS` at the top of the `<script>` block in `index.html`.
   The keys are `weekly`, `twice`, `weekdays` and must match the `data-tier` attributes — a typo here
   silently bills someone the wrong price, so run the suite after (it checks each plan routes to its own link).
4. Set `TEAMS_WEBHOOK_URL` to a **new** Power Automate flow with its own Teams channel.
5. Re-run `node test/prototype.test.mjs`, then `cp index.html deploy/index.html`.

**Do not** paste a Stripe *secret* key (`sk_live_…`/`sk_test_…`) into this file. Payment Links and
publishable keys are safe in page source; secret keys are not. The test suite asserts no secret key is present.

## Things a reviewer should push on

- **`?checkout=success` is a UI signal, not proof of payment.** Anyone can type it into the URL bar. The
  `Subscription Started` event is tagged `verified: false` for exactly this reason. **Stripe's Dashboard is
  the source of truth for who actually subscribed** — do not report signup counts from Mixpanel alone. The
  planned fix is already in §4: a **Stripe webhook** posting each signup into a dedicated Teams channel.
  That webhook, not this page, is what makes signups trustworthy.
- **`TEAMS_WEBHOOK_URL` is intentionally empty**, and given the above it may stay that way — if the Stripe
  webhook handles notifications server-side, this page's client-side post is redundant and should be dropped
  rather than duplicated. Either way it must not reuse the concierge team's order-form channel (§7 q6).
- **The default plan gives away 56%, and the value ladder is inverted.** The comparison table computes
  savings from `LIST_RATES`. Under the $49 / $99 / $399 pricing the exposure sits on the cheap plans, not the
  top one: Once a Week gives away $76 (61%), Twice a Week — the pre-selected default — gives away $126 (56%),
  and Weekdays only $41 (9%), with Pros still paid full rate (§6). So **the plan most people will buy is the
  most expensive one to serve.** Separately, per-walk cost now *rises* with plan size ($9.80 → $11 → $28.50),
  and Weekdays at $28.50 is above the $25 pay-as-you-go walk rate — the top plan is worse than booking one at
  a time for anyone who checks. §5 permits running underwater, so this may be intentional — but it should be
  chosen, not inherited. **The savings row is a subsidy check as much as a conversion device; read it that way
  when the real rates land.**
- **`LIST_RATES` is a placeholder that customers can see.** It drives the per-walk price, the savings
  callout, and the table. Wrong rates mean an overstated discount on a page taking real money. David's real
  pay-as-you-go numbers go in before launch.
- **Phone is optional now**, so some leads arrive without one. Turn on **phone collection in the Stripe
  Payment Link** so anyone who actually subscribes still gives concierge a number. Out-of-market leads may
  only leave an email — the Teams card says so rather than showing a blank field.
- **The rollover answer on the page is PROPOSED, not approved.** It follows ClassPass — roll forward, capped
  at one cycle. If Legal or David lands somewhere else, the FAQ and the plan benefits both need updating, and
  a test enforces that they can't contradict each other.
- **The page makes three promises the concierge team has to keep.** A callback within one business day, one
  matched Pro who stays on your days, and a named backup on the top plan. §8 gap 6 says nobody has scoped
  that load. Either confirm the team can hold these or soften the copy — don't ship a promise nobody agreed to.
- **Rollover is still unanswered** and is flagged PLACEHOLDER in the FAQ. It's the question most likely to
  decide whether someone signs up, and the plan benefits deliberately do *not* promise it — a test enforces
  that the two can't contradict each other. This needs a real answer, not a vague one.
- **The zip gate is an inherited assumption** (§8 gap 8 says geography is undefined). It's kept because
  charging someone we can't staff is the worse failure. Confirm the market list before launch.
- **The reviews are real but wrong.** They're boarding and cat-sitting reviews on a dog-walking page. Swap in
  walking reviews.
- **Segment reuses the concierge page's write key**, distinguished by `form_type: 'subscription_landing_page'`.
  Confirm that's the right source before launch.
- **Event names need a lexicon check.** `Plan Selected`, `Checkout Started`, `Subscription Started`,
  `Checkout Abandoned`, and `Pack Checkout Clicked` are new; the concierge page's events were renamed once
  already to match the org lexicon.

## Editing

Plain HTML/CSS/JS, no build step. Keep `deploy/index.html` in sync with the canonical `index.html` — a test
enforces it. Run all customer-facing copy through the `yourgi-brand` skill; Kai owns the final polish (§7 q5).

Questions → Lauren Palma (lauren.palma@destpet.com).
