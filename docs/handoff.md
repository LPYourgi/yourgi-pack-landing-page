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

A coverage ladder at $49 / $99 / $399: five walks, then five days or nights of any service, then the month
uncapped. Changed 12 Aug 2026 from three capped walking plans at $99 / $149 / $199.

| Choice | Why | Source |
|---|---|---|
| ~~$99–$199, no $49 plan~~ → **$49 / $99 / $399** | **CHANGED 12 Aug 2026** (Lauren's pricing note, via the Figma). §7 q1 rejected $50 as too low and floated $100–$200; the entry plan is now $49 | §7 q1 |
| ~~Capped, never "unlimited"~~ → **top plan is unlimited** | **REVERSED 12 Aug 2026.** The cap **was** the §6 subsidy guardrail. $399 all-you-can-eat is the $200/night house-sitting exposure §6 names, and §6 says the replacement guardrails are undefined. **Highest open risk on the page** | §6 |
| ~~Walking on every plan, daycare only at the top~~ → **coverage ladder** | **CHANGED.** Walking only → any service → everything. This is §7 q2's option (a) | §7 q2 |
| ~~Boarding/overnight excluded~~ → **included on the top two plans** | **REVERSED 12 Aug 2026.** §7 q3 leaned toward excluding them as a poor subscription fit; the new $99 and $399 plans both cover a night away | §7 q3 |
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

**Inert.** `STRIPE_PAYMENT_LINKS` is empty on this branch, so "Continue to payment" does nothing at all —
no validation, no capture, no confirmation screen. That's deliberate: the dry-run success screen this page
used to show told reviewers "You're in." when no subscription existed anywhere, which put invented
conversions into the one number the experiment exists to measure.

**Stripe → Teams is specified but not built.** See [`stripe-webhook.md`](stripe-webhook.md). Stripe access
landed 12 Aug 2026; the remaining prerequisites are a Power Automate premium licence and a channel from Jeff.

## How the flow works

1. Visitor picks a plan and enters zip and email (required), plus phone, dog count, and which days they
   need (all optional).
2. Validation runs. Bad input blocks the submit and fires `Validation Failed`.
3. **Zip gate.** Out of market → the lead is captured, an honest "no Pros there yet" screen shows, and the
   visitor is **never sent to Stripe**. Nobody pays for a plan we can't run.
4. In market → the lead is captured *first* (Segment `Lead Captured` + Mixpanel), *then* the visitor goes to
   Stripe. Capturing first means an abandoned checkout still tells us who was interested and in which plan —
   which, for an experiment measuring willingness to pay, is most of the signal.
5. Stripe redirects back with `?checkout=success` or `?checkout=cancel`.
6. **Separately, and this is the part that counts:** Stripe fires `checkout.session.completed` at a
   Power Automate flow, which verifies the event against the Stripe API and posts a card into a
   dedicated Teams channel. That card is the only notification staff should ever act on, because it's
   the only one that means money moved. Specified in `stripe-webhook.md`; not built yet.

## Wiring up Stripe (the remaining build work)

The page uses **Stripe Payment Links** — one hosted link per plan. Why: a Payment Link needs no server and
no secret key, so the page stays a single static file that drops into Webflow custom code, and card entry
happens on Stripe's domain, never on ours. This matches §4: a Webflow page linking out to Stripe-hosted
checkout, with Stripe handling billing notices and cancellation.

**Check what already exists before building.** §4 says a Stripe subscription page *has already been
prototyped and is connected to Yourgi's Stripe account, unpublished*. Find it before creating new Products —
you may only need to publish it and grab the links.

**Stripe access was granted to Lauren on 12 Aug 2026**, which unblocks this whole section.

→ **The step-by-step build lives in [`stripe-webhook.md`](stripe-webhook.md)**, covering the Products,
the Payment Links, the Power Automate flow, and the test plan. In outline:

1. Build it all in **test mode** first. Prices still aren't approved, and this branch is served publicly.
2. Three recurring **Products**, one per plan.
3. A **Payment Link** each, redirecting to this page with `?checkout=success`, with **phone collection on**.
4. Paste the links into `STRIPE_PAYMENT_LINKS`. The keys are `weekly`, `twice`, `weekdays` and must match
   the `data-tier` attributes — a typo here silently bills someone the wrong price, so run the suite after
   (it checks each plan routes to its own link).
5. Build the **Power Automate flow** that turns `checkout.session.completed` into a Teams card, and point
   a Stripe webhook endpoint at it.
6. Re-run `node test/prototype.test.mjs`, then `cp index.html deploy/index.html`.

There is **no `TEAMS_WEBHOOK_URL` any more** — that step used to be here and was removed on 12 Aug 2026.
The page notifies nobody; the Stripe webhook does. A Power Automate URL is a credential and this file is
public page source, so a test now asserts one hasn't been pasted back in.

**Do not** paste a Stripe *secret* key (`sk_live_…`/`sk_test_…`) into this file. Payment Links and
publishable keys are safe in page source; secret keys are not. The test suite asserts no secret key is present.

## Things a reviewer should push on

- **`?checkout=success` is a UI signal, not proof of payment.** Anyone can type it into the URL bar. The
  `Subscription Started` event is tagged `verified: false` for exactly this reason. **Stripe's Dashboard is
  the source of truth for who actually subscribed** — do not report signup counts from Mixpanel alone. The
  planned fix is already in §4: a **Stripe webhook** posting each signup into a dedicated Teams channel.
  That webhook, not this page, is what makes signups trustworthy.
- **~~`TEAMS_WEBHOOK_URL` is intentionally empty.~~ Resolved 12 Aug 2026: the page's Teams post was
  removed** rather than duplicated, exactly as the line above anticipated. Teams now hears only from the
  Stripe webhook, so every card in the channel is a payment Stripe has already taken. The lead and
  abandonment signal still goes to Segment and Mixpanel, which is where drop-off belongs. It must still not
  reuse the concierge team's order-form channel (§7 q6) — that's Jeff's call, blocking decision #9.
- **The webhook's verification is deliberately weaker than Stripe's own.** Stripe signs each request with
  an HMAC; Power Automate can't compute one without a premium inline-code action or an Azure Function, and
  neither belongs in a project whose page is one static file with no build step. Instead the flow re-fetches
  the event from the Stripe API by ID, which proves the event is real — nobody can invent a payment — but
  not that a given *request* came from Stripe. Someone holding both the flow URL and a real event ID could
  replay it and post a duplicate card. That's a nuisance, not a loss. **If this graduates from experiment
  to product, replace the flow with a small function doing real signature verification.** Reasoning in
  `stripe-webhook.md`.
- **Two of the three plans can no longer state a real saving.** The comparison table computes savings from
  `LIST_RATES`, which has a walk rate and a daycare rate and nothing else.
  - **Walks** is exact: $125 of walking for $49, a $76 (61%) giveaway.
  - **Any Five** is spendable on any service, so its value depends on the mix and there is no single list
    total. The page floors it at the cheapest known rate — 5 × $25 = $125 against $99 — and says "at least $26
    … more if you spend it on a night away." It understates on purpose; a savings claim should never overstate.
    **Real boarding and house-sitting rates would fix this**, and would probably make this plan look far better
    than the 21% it currently advertises.
  - **Everything** has no cap, therefore no list value, no per-use price and no savings figure. Those cells are
    em dashes. Do not invent a denominator to fill them.
  - **The exposure on Everything is unbounded by construction** (§6), with Pros paid full rate throughout.
  §5 permits running underwater, so this may be intentional — but it should be chosen, not inherited from
  missing rates. **The savings row is a subsidy check as much as a conversion device; read it that way when the
  real rates land.**
- **`LIST_RATES` is a placeholder that customers can see.** It drives the per-walk price, the savings
  callout, and the table. Wrong rates mean an overstated discount on a page taking real money. David's real
  pay-as-you-go numbers go in before launch.
- **Phone is optional now**, so some leads arrive without one. Turn on **phone collection in the Stripe
  Payment Link** so anyone who actually subscribes still gives concierge a number. Out-of-market leads may
  only leave an email — the Teams card says so rather than showing a blank field.
- **The rollover answer on the page is PROPOSED, not approved.** It follows ClassPass — roll forward, capped
  at one cycle. If Legal or David lands somewhere else, the FAQ and the plan benefits both need updating, and
  a test enforces that they can't contradict each other.
- **⚠️ The page's headline no longer matches the offer.** "Stop re-hiring a stranger every week" was carrying
  the Connection value prop, and on 12 Aug 2026 that premise was removed — a plan makes no promise about who
  turns up or whether they've met your pet (§8 gap 3). Every continuity claim has been stripped from the body
  copy and a test blocks another from appearing, but **the H1 was left standing on purpose**: replacing it is a
  positioning decision and Kai owns final copy (§7 q5). **Single Platform** — one plan spanning walking through
  overnight, one charge — is the value prop that's actually true and available. This is the first thing to
  settle if you're picking this page up.
- **The page now makes no promise the match team has to keep.** All three are gone: the one-business-day
  callback went with the move to self-serve booking, "one matched Pro plus a named backup" was wrong, and
  "Pros who already know your pet" was wrong too. Keep it that way until §8 gap 3 is written down.
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
