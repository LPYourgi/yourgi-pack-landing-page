# Subscription Landing Page — "Yourgi Plus"

A standalone landing page testing one question: **will people pay a recurring monthly fee for pet care?**
Visitor picks one of three care plans, gives us enough to reach them, and **completes a real purchase
through Stripe**. Everything after checkout is manual — concierge issues coupons and sets the schedule up
by hand.

Seeded from the [Concierge Landing Page](../Concierge%20Landing%20Page) repo on 2026-08-10 — same brand
shell, footer, analytics wiring, zip gate, and form validation. Different offer, and a **real payment flow
instead of a manual concierge follow-up**.

**No site nav** — just the logo. This page is a test that stands on its own (§6: decoupled from the app, no
authentication), so nav links would only leak people out of the one page whose whole job is measuring
whether they sign up. The logo links to yourgi.com so someone about to enter a card can confirm who they're
paying.

**New here? → Read [`docs/handoff.md`](docs/handoff.md) first.**

## Files

- `index.html` — the page (canonical). Double-click to open, or serve it (see below).
- `preview.html` — **review harness.** Frames the page with a mobile / tablet / desktop toggle and
  shortcuts to the post-Stripe screens. Send reviewers here. **Never goes into Webflow**, and a test
  keeps it out of `index.html`.
- `test/prototype.test.mjs` — the headless check suite. See "Testing".
- `docs/handoff.md` — start-here onboarding and open decisions.
- `docs/stripe-webhook.md` — **the build runbook for Stripe → Teams.** Products, Payment Links, the
  Power Automate flow, and how a signup gets verified before staff act on it.
- `docs/flow-build-brief.md` — a self-contained one-pager to hand to whoever has a Power Automate
  Premium licence, since Lauren doesn't. They own the flow; we only need the URL back.
- `webhook/teams-card-*.json` — the Adaptive Cards that flow posts, annotated with why each field is
  what it is. Not loaded by the page.
- `webhook/teams-card-*.paste.json` — the same cards with the explanatory keys stripped, so they
  paste into Power Automate without editing. Regenerate them from the annotated versions rather than
  editing them directly, or the two will drift.
- `stripe/plans.json` — **the three plans as Stripe objects.** What gets created in Stripe, and the
  only place those values should be typed. A test asserts it matches the page's prices and labels.
- `stripe/create-plans.mjs` — creates those plans in Stripe **test mode** from the manifest, via the
  Stripe CLI. Dry-runs by default; `--go` to execute. Aborts if Stripe returns a live object.
- `docs/project-context.md` — **the authoritative source.** Synthesized from the 10 Aug 2026 team
  discussion. Where this doc and the page disagree, this doc wins and the page is wrong.

## What the page offers

Three plans on a frequency ladder: two services a month, five, then uncapped — any service at every tier. **The numbers are
not approved** — David owns pricing, and the note below lists what still has no answer.

| Plan | Price | Included |
|---|---|---|
| Two Anything | $49/mo | Two services per month for one pet |
| Five Anything (default) | $99/mo | Five services per month for one pet |
| Full Coverage | $399/mo | Unlimited services every 30 days for one pet |

The "Included" column is the plan tile's own blurb, verbatim — the same string
`stripe/plans.json` uses as the Stripe product description, which a test pins to the page.
Change it in one place and the suite tells you about the other.

> **Decisions and their history live in [`docs/project-context.md`](docs/project-context.md)**, which is
> authoritative. This file describes the repo; it doesn't re-argue the offer.

Three open risks worth knowing before you touch anything, all tracked in the PRD:

- **The top plan is uncapped and nothing guards it.** A usage cap used to be §6's subsidy guardrail. A month
  of nightly house-sitting on $399, with Pros paid full rate, is the exposure §6 names verbatim. PRD gap 10,
  highest priority.
- **The headline doesn't match the offer.** "Stop re-hiring a stranger every week" was carrying the Connection
  value prop, and a plan makes no promise about who turns up (PRD gap 3). Left standing on purpose — replacing
  it is a positioning call and Kai owns copy (§7 q5). **Single Platform** is the prop that's actually true.
- **`LIST_RATES` has no boarding or sitting rate**, and the $99 plan can be spent on both, so its saving is a
  floored estimate rather than a figure. See the subsidy section below.

- **A coverage ladder, not a frequency ladder.** Walking only → any service → everything. §7 q2's option (a).
  Boarding and overnight are **in** on the top two plans, and the FAQ says so plainly.
- **No Yourgi Guarantee claim anywhere on the page.** §8 gap 4 says coverage is undetermined and legally
  risky. The concierge page's Guarantee band was replaced with an honest beta band. With the nav gone, the
  only Guarantee text a visitor sees is the unchanged site-wide footer, which claims nothing about plans.
- **Beta framing up top, before anyone pays.** §8 gap 5 wants an off-ramp and honest comms for enrolled
  subscribers. Saying "this is a test and we'll warn you before your next charge" costs nothing now and a
  lot later.

§7 q4 (should the form collect service interest?) is answered with the lightest useful option: one optional
free-text "which days do you need?" box. §4 says a person follows up to set each subscriber's services up by
hand — that box is the single thing they need before dialling.

## What the market actually does — and what we borrowed

Checked against the operators who sell subscriptions well. **The headline finding is that neither big pet-care
player sells what Yourgi Plus sells:**

| Who | What they actually sell | Read-across |
|---|---|---|
| [Wag! Premium](https://wagwalking.com/wag-premium) | **$9.99/mo discount membership** — 5% off bookings, waived booking fees, vet chat, priority matching | A loyalty layer, not a services bundle. Cheap, near-zero subsidy exposure, and it never has to answer "what happens to unused walks?" |
| [Rover](https://www.rover.com/dog-walking/) | **No subscription at all** — "Repeat Weekly" recurring bookings with auto-billing at normal rates | The recurring-revenue outcome without prepayment. Some walkers discount recurring bookings themselves. |
| [ClassPass](https://help.classpass.com/hc/en-us/articles/209367426-Do-my-credits-roll-over) | Monthly credits for third-party services, **rollover capped at one cycle's worth** | The closest structural analog to Yourgi Plus, and the source of our proposed rollover answer. |

Nobody in pet care is selling a prepaid, capped bundle at $49–$399. That's either the opportunity or the
warning — worth putting in front of David and Scott either way, because **there is a materially cheaper
experiment available**: a Wag-style ~$10–20/mo discount membership tests willingness to pay for a
relationship with roughly none of the subsidy exposure in §6. It answers a slightly different question, but
it answers it for a fraction of the risk.

**Applied to the page:**

- **Per-unit price on the capped cards** ("$19.80 a visit"). Standard wherever usage is capped — ClassPass,
  HelloFresh, Blue Apron all do it, because "$99/mo" alone makes the buyer do the division. The uncapped plan
  shows nothing there, because there is no denominator.
- **Savings vs. booking one at a time**, in dollars and percent. Concrete dollar amounts beat bare
  percentages.
- **Side-by-side comparison table** so all three plans are visible at once. In the signup card you can only
  see the plan you've clicked, which is the wrong way round for choosing.
- **Closing CTA** after the FAQ. By then the signup card is thousands of pixels behind you.
- **Stripe named before the handoff** — an unexplained jump to another domain mid-purchase reads as a
  redirect gone wrong.
- **Phone is now optional.** Every required field before payment costs signups. Turn on phone collection in
  the Stripe Payment Link so concierge still gets a number for anyone who actually pays.
- **A proposed rollover answer**, borrowed from ClassPass: unused walks roll forward, capped at one month's
  worth. Kills the "I'll waste it" objection without creating an unbounded liability. Still needs sign-off.

**Deliberately not applied:**

- **No free trial or intro discount.** Standard in subscription growth, wrong here — this experiment measures
  *willingness to pay*, and a free first month measures willingness to try something free. It would corrupt
  the one number the test exists to produce.
- **No annual prepay.** Normally the best margin lever available, but §8 gap 5 says this beta may be wound
  down. Taking a year's money for a plan that might not last a quarter is a refund problem, not a growth one.
- **No scarcity messaging** ("only N spots"). There *is* a real ceiling — §8 gap 6's unscoped concierge
  capacity — but nobody has produced the number, and inventing one would be a fake claim.

### ⚠️ The savings row exposed a pricing problem

Making the discount visible doubles as a subsidy check, and **under the coverage ladder the savings figure
stops being computable on two of the three plans.** At the placeholder rates:

| Plan | List value | Price | Giveaway | Per use |
|---|---|---|---|---|
| Two Anything | $125 (5 × $25) | $49 | **$76 (61%)** | $9.80 a walk |
| Five Anything | **unknown — floored at $125** | $99 | at least $26 (21%) | $19.80 a visit |
| Full Coverage | **no cap, no list value** | $399 | not quotable | — |

**Five Anything can't be priced against a list total**, because the customer decides the mix — five walks is worth
$125, five nights of house-sitting is worth several times that, and `LIST_RATES` has no overnight rate at all.
The page floors it at the cheapest known service and says "at least $26… more if you spend it on a night
away." That understates deliberately: a savings claim is a claim about money, and the safe direction is down.
**Everything has no cap, so it has no list value, no per-use price, and no savings figure** — those cells are
em dashes rather than invented numbers.

Three things fall out of this that are worth a decision rather than a shrug. **The value ladder still doesn't
reward buying more** — $9.80 a walk on the entry plan against $19.80 a visit on the middle one, for the same
count; the middle plan is only better if you spend it on something pricier than a walk, which is exactly what
the page can't yet quantify. **The unlimited plan's exposure is unbounded by construction**, which is §6's
worry with the guardrail removed. And **the headline saving on the default plan reads as 21%**, the weakest of
the three, purely because we can't yet price what makes it good. Real boarding and sitting rates would fix the
third problem and quantify the first two. §5 says the experiment may run underwater deliberately, so this may
be fine — but it should be a decision someone makes, not an artifact of missing rates. The rates driving
it live in `LIST_RATES` in `index.html` and need David's real figures.

## Status

**MVP, not production.** No Stripe links are configured on this branch, so "Continue to payment" is
**inert** — it does nothing at all rather than faking a sale. Nothing here has been priced,
brand-reviewed, or legally approved.

**Staff notifications come from Stripe, not from this page.** The page posts to no channel of its
own: it captures the lead to Segment and Mixpanel, then hands off. A Stripe webhook is what puts a
signup into Teams, because Stripe is the only party that knows money actually moved. That flow is
**specified but not yet built** — see [`docs/stripe-webhook.md`](docs/stripe-webhook.md).

## Blocking decisions — nothing ships until these land

Full detail in `docs/project-context.md` §7 (Open Questions) and §8 (Gaps). Condensed:

| # | Decision | Owner |
|---|----------|-------|
| 1 | **The actual prices and caps.** The page proposes a structure; David owns the numbers. | Facilitator / David |
| 2 | ~~**Rollover** — what happens to unused walks.~~ **Answered 12 Aug 2026: use it or lose it, no rollover.** The FAQ now states it plainly; the previous answer proposed the opposite (ClassPass-style roll-forward) and was reversed. | ~~Facilitator / David~~ done |
| 3 | **Guarantee coverage** for subscription bookings. Until this lands, no Guarantee claim goes on the page. | Kai / Legal |
| 4 | **Wind-down terms** — the beta band promises notice before the next charge. Confirm we can hold that. | Legal / Kai |
| 5 | **Geography** — the zip gate is inherited, not decided. See below. | Undecided |
| 6 | **Stripe access for Lauren — REOPENED 13 Aug 2026.** Access was granted 12 Aug, but it's a limited role: *"you don't have permission to create an API key for this merchant."* That blocks `stripe login`, and blocks the **restricted key the webhook's verification step needs**. Needs Developer or Administrator on Yourgi Pro — or an admin who creates the objects and the key on her behalf. | Facilitator / Stripe admin |
| 7 | **Concierge capacity** — the page promises a callback within one business day. Confirm the team can. | Concierge lead |
| 8 | **Success metric** — no target, baseline, or kill threshold defined. | Facilitator / Scott |
| 12 | **Refund policy.** The intent is "refund if nothing was used, partial if some was" — but that's an intent, not a rule, and Stripe refunds nothing automatically on cancellation. Every refund is a manual action in the dashboard. The FAQ promises only what's certainly true until this lands. | David / Legal |
| 13 | **Consumption tracking is manual** for the launch build. Nothing counts what a subscriber has used, so nothing enforces the caps and nobody can answer "how many do I have left?" — on a use-it-or-lose-it plan that question arrives in week one. | Concierge lead |
| 9 | **Notification channel** — a new dedicated Teams channel, never the concierge order-form channel. Needed before the Stripe webhook can be pointed anywhere; the flow can be built and tested against a private channel first. | Jeff |
| 11 | **Power Automate premium licence** — **confirmed missing, 13 Aug 2026.** Flow checker: *"This flow's owner needs a Power Automate Premium license."* The flow saves but cannot run. Unblock with the free 90-day trial offered in Flow checker, or an admin licence request; otherwise the design drops event verification. See [`docs/stripe-webhook.md`](docs/stripe-webhook.md). | Facilitator / IT |
| 10 | Page slug, National 2 font + official logo lockup, dog-walking reviews to replace the boarding/cat ones. | Webflow / brand |

### One deliberate disagreement with the PRD

**The zip market gate is kept**, even though §8 gap 8 says geography is undefined and the gate is therefore
an assumption. The reasoning: this page takes **real recurring money**, and a plan is a promise to show up
every week. Selling one where no Pro can walk the dog turns a cheap experiment into refunds and an angry
customer. Out-of-market visitors are never sent to Stripe — the lead is captured and an honest "no Pros
there yet" screen shows instead. If the real launch geography differs, change `MARKET_RANGES` in
`index.html`; don't delete the gate.

## Running it

Open `index.html` directly, or serve it to exercise the JS:

```bash
python3 -m http.server 8137
```

To see the post-Stripe screens without a real payment, append `?checkout=success` or `?checkout=cancel`.

**Sharing it with reviewers:** send them `preview.html`, not `index.html`. It renders the page at real
mobile (390×844), tablet (768×1024), and desktop (1280×800) viewport widths — actual widths, so the page's
own breakpoints fire exactly as they would on a device — and has one-click access to the paid and
backed-out screens. Switching device does **not** reload the frame, so anything typed into the form
survives the switch.

## Testing

```bash
npm install && node test/prototype.test.mjs
```

`package.json` pins the one dependency (jsdom). It used to be gitignored, so a fresh clone couldn't run this
at all — fixed 12 Aug 2026.

Covers plan switching, validation, phone/zip masking, the market gate, the optional schedule field, the
inert-CTA state, per-plan Stripe URL routing, out-of-market handling, both return-from-Stripe states, and
the `stripe/plans.json` manifest agreeing with the page on every price and label.

It also asserts a set of **negatives about notifications**: that the page posts to no channel of its
own, that no Power Automate endpoint or Stripe key is committed to page source, and that the page
makes no outbound `POST` at all. Those exist because the notification path deliberately lives on a
Stripe webhook instead ([`docs/stripe-webhook.md`](docs/stripe-webhook.md)) — the page fires before
payment and can only report intent, so anything it sent to a staff channel would be a signup that
might never happen. If one of those fails, someone has moved notifications back onto the page.

It also carries a **PRD reconciliation guard** block that fails if the page drifts back toward the pre-PRD
scaffold — a Guarantee claim, a rollover promise the FAQ contradicts, or "pet parent" in customer-facing copy.
If one of those fails, re-read the PRD before "fixing" the test.

Three of those guards were **deliberately inverted on 12 Aug 2026** rather than deleted, because the decisions
underneath them changed: the price band (§7 q1), the "no unlimited plan" rule (§6), and the boarding exclusion
(§7 q3). They now pin the *new* intended state and assert that the removed §6 guardrail is still named in the
page source, so the exposure can't quietly stop being mentioned. Invert them again only with the same kind of
explicit decision.

The suite stubs Mixpanel, Segment, and `fetch`, so **it never fires a real side effect** — keep it that way.

---
_Related: [Concierge Landing Page](../Concierge%20Landing%20Page) — the flat-rate test this page was seeded from._
