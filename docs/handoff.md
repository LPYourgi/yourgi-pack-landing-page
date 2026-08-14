# Handoff — Subscription Landing Page ("Yourgi Plus")

**From:** Lauren Palma · **Created:** 10 August 2026 · **Reconciled against the PRD:** 10 August 2026 · **Last corrected against the page:** 14 August 2026

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

A coverage ladder, by **volume of any service**, not by service type: **Two Anything** at **$49** (two
services a month), **Five Anything** at **$99** (five), **Full Coverage** at **$499** (unlimited for 30 days).
All three cover walks, drop-ins, house sitting, daycare and overnights — the entry plan is *not* walking-only.
`stripe/plans.json` is the machine-checked source of truth for the names, the numbers and the blurbs.

| Choice | Why | Source |
|---|---|---|
| Prices are $49 / $99 / $499, not approved | David owns pricing | §7 q1 |
| A volume ladder over any service, not a service-type ladder | Two of anything → five of anything → everything. No tier is restricted to one service | §7 q2 |
| Overnight and boarding included on **all three** plans | Was "the top two" here, which the 13 Aug Figma sync superseded — Two Anything covers overnights too | §7 q3 |
| **The top plan is uncapped, and nothing guards the exposure** | The cap used to be §6's subsidy guardrail. A month of nightly house-sitting on $499, with Pros paid full rate, is the exposure §6 names. **Highest open risk here** | §6, gap 10 |
| **The page claims nothing about who shows up** | A plan buys care, not continuity with a person. Don't add a familiarity promise back — a test blocks it | gap 3 |
| No Guarantee claim anywhere on the page | Coverage is undetermined and legally risky | §8 gap 4 |
| Beta framing above the fold | Enrolled subscribers need an off-ramp and honest comms | §8 gap 5 |

> These reversed several earlier decisions on 12 Aug 2026 — the price band, the "capped, never unlimited"
> rule, the boarding exclusion, and the single-matched-Pro promise. **The reasoning and the dates live in
> `project-context.md`'s Decisions block**, which is authoritative; git history has the copy that changed.
> Not repeated here.

**The Guarantee band from the concierge page is gone.** A Guarantee band on a page taking recurring money
reads as a coverage claim whether or not it says so.

It was replaced by a "Straight up: this plan is new" band — and **that band has since gone too**, removed on
13 Aug 2026 to match the Figma, which hides the whole frame. Two consequences worth a decision rather than
silence:

- **The beta disclosure now lives only in the ribbon at the top of the page.** §8 gap 5 wants enrolled
  subscribers told honestly that this is a test that may end; one ribbon line is thinner cover for that than
  a band was.
- **There is no longer a band to put the Guarantee back into** if Legal confirms coverage. §8 gap 4 is still
  open, so this is still not the place to add one — but the slot no longer exists, and someone will have to
  rebuild it rather than edit it.

A test still asserts no Guarantee claim has crept back into the plan cards or the signup card. Note the hero
separately carries "Guaranteed coverage within 48-hours", which is a deliberate override — see below.

## What was carried over vs. built new

| Carried over unchanged | Built new for this page |
|---|---|
| Brand CSS (colors, type, buttons, `.band` sections) | Three-plan picker + benefits list |
| Footer | Stripe Payment Link handoff, one link per plan |
| Mixpanel + Segment snippets | Return-from-Stripe states (success / cancel) |
| Zip gate (CO, ME, MA, NH, OR, TX, WA) | Beta ribbon + honest-beta band |
| Phone/zip/email validation and masking | Optional "which days do you need?" field |
| ~~Reviews~~ — carried over, then **removed** 13 Aug 2026 | "How Yourgi Plus works", FAQ, and the "Why Yourgi Plus" band that replaced the reviews |

**Deliberately dropped:**

- The date-range calendar and all quote math — a plan has neither.
- The Guarantee band (above).
- **The whole site nav.** This page stands on its own; §6 has it decoupled from the app with no
  authentication. Nav links would only leak people out of the one page whose entire job is measuring
  whether they sign up. What's left is the logo, linked to yourgi.com so someone about to hand over a card
  can confirm who they're paying. Tests assert the nav holds exactly one link and that no dead nav CSS or JS
  lingers — if a reviewer asks for "Book now" back, that's a conversion decision, not a cleanup.

## Current status

**Live, in test mode.** `STRIPE_PAYMENT_LINKS` holds three real per-plan Payment Links, one per tier,
every one of them test mode (`buy.stripe.com/test_…`). "Continue to payment" validates, checks the zip,
captures the lead and hands off to a real Stripe checkout. **Nobody can be charged real money** — a
test-mode link cannot take it — which is the only reason these can sit on a publicly served branch. A test
asserts the `test_` prefix on all three; the day one loses it, this page is taking real payments at prices
nobody has approved.

This section used to read "Inert — `STRIPE_PAYMENT_LINKS` is empty on this branch". That stopped being
true when the links were wired on 13 Aug 2026, and it was the most misleading line in this file: it told
anyone picking the page up that the CTA was parked when it was in fact sending people to checkout.

**The guard it described is still real and still worth keeping.** Empty the links and `STRIPE_READY` goes
false, which parks the button — it does nothing at all rather than faking a sale. That is the deliberate
choice over the dry-run success screen this page used to show, which told reviewers "You're in." when no
subscription existed anywhere, putting invented conversions into the one number the experiment exists to
measure.

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

1. ~~Build it all in **test mode** first.~~ **Done** — every object is test mode and stays that way while
   prices are unapproved and this branch is served publicly.
2. ~~Three recurring **Products**, one per plan.~~ **Done** — see the table below for the ids.
3. ~~A **Payment Link** each, redirecting to this page with `?checkout=success`, with **phone collection
   on**.~~ **Done** — `phone_number_collection.enabled` is set in `stripe/plans.json`.
4. ~~Paste the links into `STRIPE_PAYMENT_LINKS`.~~ **Done, 13 Aug 2026.** The keys are `weekly`, `twice`,
   `weekdays` and match the `data-tier` attributes. Still true for any future paste: a typo here silently
   bills someone the wrong price, so run the suite after (it checks each plan routes to its own link).
5. **Build the Power Automate flow** that turns `checkout.session.completed` into a Teams card, and point
   a Stripe webhook endpoint at it. **This is the only step left**, and it is blocked on a Premium licence
   holder and a channel from Jeff — hand them [`flow-build-brief.md`](flow-build-brief.md), which is
   self-contained.
6. Re-run `node test/prototype.test.mjs`.

### Where the links live, and how checkout is configured — settled 13 Aug 2026

**The three links in `index.html` are not in Yourgi's live Stripe account.** `create-plans.mjs` runs through
the Stripe CLI, and `stripe login` put them in an auto-generated sandbox, `acct_1U3hh6EC544F53vL`. That
sandbox was originally unclaimed, which meant it carried an expiry (`sandbox_expires_at = '2026-08-19'`) and
an orange "Unclaimed sandbox" badge on every checkout page. **It has since been claimed under Yourgi Pro**,
which cleared both. Checkout now shows a plain grey "Sandbox" pill — that indicator is inherent to test mode
and is not something branding removes.

Configuration as it now stands in that sandbox, all set through the Dashboard:

| Setting | Value | Why |
|---|---|---|
| Logo / icon | Yourgi wordmark, **yellow** | Was a grey placeholder; branding is per-account and the sandbox had none. Yellow over black is a deliberate choice by Lauren, 13 Aug 2026 — it reads faint at this size on Stripe's white background, so don't "fix" it |
| Checkout button | `#000` | Spot Black, matching the page's own `.btn-dark`. Was Stripe default blue |
| Klarna | **off** | BNPL on a monthly subscription is confusing, and refund policy is still open (decision #12) |
| ACH Direct Debit | **off** | Confirms up to 4 business days later and can fail after checkout — see below |
| Instant Bank Payments | **on** (the "Bank" row) | Not the same thing as ACH; see below |
| Card, Cash App Pay, Amazon Pay | on | All support recurring |

**ACH vs Instant Bank Payments — the distinction that matters here.** They look identical on the checkout
page and only one can ever appear; if both are enabled, ACH wins. ACH Direct Debit is a delayed-notification
method: the Checkout Session completes while the payment is still processing, and it can fail days later on
insufficient funds. That breaks the notification design in [`stripe-webhook.md`](stripe-webhook.md), which
keys the Teams card on `checkout.session.completed` — concierge would be told to start work before the money
was real. Instant Bank Payments (part of Link, badged "$5 back", Stripe-funded at no cost to us) confirms
**instantly**, settles on the card timeline, is guaranteed by Stripe absent a customer dispute, and supports
recurring. So ACH is off and Instant Bank Payments is on, and `checkout.session.completed` stays correct.

Removing the bank row entirely would mean turning off Link altogether, which also removes saved-payment
acceleration for returning customers. Not worth it.

**Apple Pay and Google Pay** ride on the card payment method and need no separate toggle. They render only on
an eligible browser and device, so they are invisible in desktop screenshots. Apple Pay confirmed working on
iPhone, 13 Aug 2026.

Re-running `create-plans.mjs` against a different sandbox produces new link URLs, so step 4 above has to be
redone if that happens — and the new sandbox would start unbranded and unclaimed all over again. The test
suite catches a stale paste; it cannot catch an expired link.

#### Telling the live links from the dead ones — verified 13 Aug 2026

`create-plans.mjs` creates its own Products and links on every run and reuses nothing, so the sandbox
accumulates a link per plan per run. As of 13 Aug 2026 there are **20 Payment Links, of which exactly 3 are
active** — and those 3 are the ones already pasted into `STRIPE_PAYMENT_LINKS`:

| Plan | Payment Link | Price | Product |
|---|---|---|---|
| Two Anything ($49) | `plink_1U43lhEC544F53vLr2gGKjHz` | `price_1U43lgEC544F53vLic9GTR7s` | `prod_V4CAvZyCMwXFDm` |
| Five Anything ($99) | `plink_1U43ljEC544F53vLPjlDMugH` | `price_1U43liEC544F53vL0hXGoizP` | `prod_V4CACYKwRpOKHK` |
| Full Coverage ($499) | `plink_1U44OEEC544F53vLCha3Tdk0` | `price_1U44ODEC544F53vLMEJQwfxj` | `prod_V4CAW8wlwsl4Un` |

All three `Yourgi Plus` Products are active; every older `Yourgi Pack` Product is archived. Note the newest
$499 link (`plink_1U44Q2EC544F53vLpCBRCQIr`, 7:36 PM) is **not** the live one — it was a false start,
deactivated immediately. The live $499 link is the one created two minutes earlier.

**The Dashboard badge lies, and this will cost you twenty minutes if you trust it.** In Product catalog →
Payment links, the three active links render a grey **"Deactivated"** pill. They are not deactivated. The
`Status = Active` filter is evaluated server-side and correctly returns exactly these three rows — but the
badge on each row draws from cached row state that never refreshes, so the filter and the badge contradict
each other on the same screen. `Cmd+Shift+R` does not reliably clear it; a full logout and login does.

Don't trust the Dashboard on this. Check the API instead, which is authoritative:

```
stripe payment_links list --limit 30 | grep -E '"(id|active|url)"'
```

Or just open a link in a browser — a genuinely deactivated link renders an error page instead of checkout.

Two stray Products named **`myproduct`** (`prod_V3sG0CKF7ak9UD`, `prod_V3sE7mvV3oXLRY`) are also active.
They came from Stripe CLI sample commands, not from `create-plans.mjs`, and are harmless — but they are the
only other active Products in the account, so they surface in any "active Products" view.

One thing `stripe config --list` **cannot** tell you: whether the sandbox is claimed. It still reports
`sandbox_expires_at` and a `sandbox_claim_url`, but those were written to the local config at `stripe login`
time and are never refreshed, so they say nothing about current state either way.

#### Live-mode brand settings, recorded 13 Aug 2026 — restore point

Once the sandbox is claimed it sits under Yourgi Pro, and the Dashboard's branding and payment-method screens
then exist in **both** modes behind a switcher. A change made in live mode by accident is silent and affects
production. These are the live values as they stand, so anything overwritten can be put back:

| Field | Value |
|---|---|
| `checkout_background_color` | `#ffffff` |
| `checkout_button_color` | `#0074d4` |
| `checkout_border_style` / `checkout_font_family` | `default` / `default` |
| `primary_color` / `secondary_color` | `#525f7f` / `#0074d4` |
| `contrast_color` / `font_color` | `#505d7c` / `#ffffff` |
| `use_logo_instead_of_icon` | `true` |

Icon and logo files are already set on the live account and are unaffected by anything done in a sandbox.

**What a live-mode mistake would actually touch:** the live account has exactly one active Payment Link —
`plink_1U17JmIgv5bQybH711thp1rA`, Chris Mejia's `membership-c-test` at $50/mo, capped at one completed
session. Branding is account-wide, so it also reaches live receipts, invoices and the customer portal.

There is **no `TEAMS_WEBHOOK_URL` any more** — that step used to be here and was removed on 12 Aug 2026.
The page notifies nobody; the Stripe webhook does. A Power Automate URL is a credential and this file is
public page source, so a test now asserts one hasn't been pasted back in.

**Do not** paste a Stripe *secret* key (`sk_live_…`/`sk_test_…`) into this file. Payment Links and
publishable keys are safe in page source; secret keys are not. The test suite asserts no secret key is present.

## David's scenario model — and what it says

From *Subscription Business Model Scenario Planning_v2*, shared 12 Aug 2026 and confirmed correct
apart from the prices, which are $50 / $100 / $400 in the model and $49 / $99 / $499 on the page for
marketing reasons. The dollar difference doesn't change any conclusion below.

**The unit rates, which the page had never had.** Cross-checked two ways each against the grid:

| Service | Rate | How it checks out |
|---|---|---|
| Walk | **$30** | Baseline walk plan and Downside unlimited (25 walks / $750) agree exactly |
| Daycare | **$55** | Baseline $165 ÷ 3 used, Downside $248 ÷ 4.5 used |
| **Boarding** | **~$195/night** | Residual of the Baseline unlimited column once walks and daycare come out |

These are now in `LIST_RATES`. **Boarding at $195 is 6.5× a walk**, and both Five Anything and Full Coverage
can be spent entirely on it — which is §6's exposure with a number finally attached.

**Every scenario loses money per customer per month.** Pros are paid 90% of service value, and the
plans sell below value, so margin is negative wherever utilisation is meaningful:

| Scenario | Two Anything | Day care | Unlimited |
|---|---|---|---|
| Baseline (60 / 60 / 100% used) | **−$31** | **−$49** | **−$120** |
| Breakeven (needs 37 / 40 / 77%) | $0 | $0 | $0 |
| Downside (90 / 90 / 100%) | **−$72** | **−$123** | **−$275** |

§5 permits running underwater deliberately, so this is allowed — but it should be sized rather than
discovered. At baseline, 100 subscribers on the middle plan is about **−$4,900 a month**.

Two things follow that are worth saying out loud:

- **These plans are profitable only if people don't use them.** Breakeven sits at 37–77% utilisation.
  That is in tension with Step 1 telling people to size a plan to what their month needs, and with
  concierge actively helping them book. It's a normal gym-membership dynamic, but nobody should be
  surprised by it later.
- **The model's Downside case stresses the wrong variable.** It models 25 *walks* — the cheapest
  service — and sets boarding to zero. The real tail is mix, not volume: five nights of boarding on
  Five Anything is 5 × $195 = $975 of value, $877 of Pro payout, against $99 collected — about **−$779
  from one subscriber in one month**, roughly six times the worst case the model shows for the
  unlimited plan. On Full Coverage, ten nights is about −$1,256. The uncapped plan has no modelled
  ceiling because the scenario that would find it wasn't run.

## How billing actually behaves (confirmed 12 Aug 2026)

Answers from Lauren, resolving several long-standing FAQ placeholders. Recorded here because the
page's copy now depends on every one of them.

| Behaviour | What happens |
|---|---|
| **Start date** | The subscription starts the moment they pay. No trial, no delay. |
| **Renewal date** | Same day each month — pay 12 Aug, billed again 12 Sept. |
| **Renewals** | Automatic and indefinite until cancelled. |
| **Unused services** | **Use it or lose it.** Nothing rolls over. |
| **Cancellation** | Self-service in Stripe's portal. Runs to period end; no automatic refund. |
| **Plan changes** | Self-service. Stripe prorates — up costs the difference now, down credits the next bill. |
| **Refunds** | **Manual, and discretionary.** Stripe refunds nothing on cancellation by itself. |
| **Consumption tracking** | **Manual.** Nothing in the system counts what a subscriber has used. |

**The last two rows are where the risk is.** Nothing counts usage, so nothing enforces a plan's cap
and nobody can answer "how many do I have left?" — a question a use-it-or-lose-it plan guarantees
you'll get, probably in week one. And "refund if unused, partial if used" is an intent rather than a
policy; the first cancellation will turn it into one, whether or not anyone has written it down.

**Auto-renewing indefinitely, with services that expire monthly and no usage visibility, is the shape
regulators look at closely.** US auto-renewal rules have disclosure and sometimes reminder
requirements. Not a reason to change the model — a reason to get Kai/Legal to look before launch,
alongside blocking decision #4.

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
- **⚠️ "Save more than 50%" now ships on all three plans with no stated basis anywhere.** This bullet used to
  describe a comparison table that computed per-plan savings from `LIST_RATES` and showed "Works out at" and
  "You save vs. one at a time" rows. **The Figma hides both rows, so the table no longer carries either, and
  the savings-basis fineprint went with them.** What is left is one flat sentence in the signup card, shown on
  every plan.
  - Against David's rates ($30 walk / $55 daycare / $195 boarding) the plans save about **18%** (Two Anything)
    and **34%** (Five Anything) when spent on walks. The claim only clears 50% if a plan is spent on
    overnights, and **the page does not state that basis**.
  - The Figma attaches that sentence to the **Five Anything** card only; the other two read "@kai need copy
    here", a designer's TODO. That placeholder is deliberately not carried onto the page, so the 50% line is
    currently shown on the two plans it is *least* likely to be true for.
  - **Full Coverage has no cap**, therefore no list value, no per-use price and no savings figure. Do not
    invent a denominator to fill them.
  - **The exposure on Full Coverage is unbounded by construction** (§6), with Pros paid full rate throughout.
  §5 permits running underwater, so the subsidy may be intentional — but it should be chosen, not inherited.
  **Nothing on the page checks this claim any more, so it ships verbatim on Lauren's instruction and David and
  Legal own it before launch. Unverified pricing claim.**
- **`LIST_RATES` is a placeholder that customers can see.** It drives the per-walk price, the savings
  callout, and the table. Wrong rates mean an overstated discount on a page taking real money. David's real
  pay-as-you-go numbers go in before launch.
- **Phone is optional now**, so some leads arrive without one. Turn on **phone collection in the Stripe
  Payment Link** so anyone who actually subscribes still gives concierge a number. Out-of-market leads may
  only leave an email — the Teams card says so rather than showing a blank field.
- **~~The rollover answer on the page is PROPOSED, not approved.~~ Decided 12 Aug 2026: use it or lose it.**
  This bullet described a ClassPass-style roll-forward capped at one cycle, which was never adopted. Nothing
  rolls over; the comparison table says "Expire monthly" for all three plans and the plan benefits promise no
  rollover, so the two cannot contradict each other. The FAQ no longer carries a rollover question at all —
  the Figma dropped it. See the billing table above, which is the authoritative statement.
- **~~The page's headline no longer matches the offer.~~ Resolved 13 Aug 2026.** The H1 was "Stop re-hiring a
  stranger every week", which carried the Connection value prop after that premise had been removed — a plan
  makes no promise about who turns up or whether they've met your pet (§8 gap 3). It is now **"Pet care,
  handled for you"**, taken from the Figma, which is the Single Platform framing this bullet asked for: one
  plan spanning walking through overnight, one charge, and no claim about who arrives. Every continuity claim
  is still stripped from the body copy and a test still blocks another from appearing. Kai owns final polish
  (§7 q5), but the headline is no longer contradicting the offer while he gets to it.
- **The page now makes no promise the match team has to keep.** All three are gone: the one-business-day
  callback went with the move to self-serve booking, "one matched Pro plus a named backup" was wrong, and
  "Pros who already know your pet" was wrong too. Keep it that way until §8 gap 3 is written down.
- **~~The zip gate is an inherited assumption.~~ Confirmed 14 Aug 2026 by Lauren:** the market is
  **Colorado, Maine, Massachusetts, New Hampshire, Oregon, Texas and Washington**, which is exactly what
  `MARKET_RANGES` has always encoded. The gate is unchanged; the page's copy was the stale half and now
  names those seven states. It previously named six cities, which was narrower than the gate in a way that
  mattered — ME, NH and WA could reach Stripe and pay while the page named no market of theirs, and
  "Portland" was ambiguous between the Oregon and Maine markets, both open. All seven states now have zip
  coverage in the test suite; they did not before, so a range could have been broken or removed with every
  test still green. This answers §8 gap 8 for the page.
- **~~The reviews are real but wrong.~~ Removed 13 Aug 2026.** They were boarding and cat-sitting reviews on
  a dog-walking page. The Figma hides the testimonial block entirely and puts the "Why Yourgi Plus" band in
  its place, so the three reviews are gone rather than replaced. If testimonials come back, git history has
  the markup, and the swap-in-walking-reviews point still stands at that time.
- **Segment reuses the concierge page's write key**, distinguished by `form_type: 'subscription_landing_page'`.
  Confirm that's the right source before launch.
- **Event names need a lexicon check.** `Plan Selected`, `Checkout Started`, `Subscription Started`,
  `Checkout Abandoned`, and `Pack Checkout Clicked` are new; the concierge page's events were renamed once
  already to match the org lexicon.

## Editing

Plain HTML/CSS/JS, no build step. `index.html` is the only page — a test
enforces it. Run all customer-facing copy through the `yourgi-brand` skill; Kai owns the final polish (§7 q5).

Questions → Lauren Palma (lauren.palma@destpet.com).
