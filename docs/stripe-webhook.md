# Wiring Stripe → Teams

**Owner:** Lauren Palma · **Written:** 12 August 2026 · **Status:** ready to build, not built

How a real subscription payment becomes a message in a Teams channel that staff can act on.

```
landing page ──► Stripe Payment Link ──► Stripe takes the money
                                              │
                                              │  checkout.session.completed
                                              ▼
                                    Power Automate flow
                                              │
                                    1. re-fetch the event from Stripe   ← this is the security step
                                    2. build the Adaptive Card
                                              ▼
                                    dedicated Teams channel
```

The landing page is **not** in the notification path, deliberately. It can only ever say "someone
reached checkout", and a channel that mixes that with real payments is a channel where concierge
onboards and coupons somebody who never paid. The page's client-side Teams post was removed for
this reason; the lead/abandonment signal still goes to Segment and Mixpanel.

---

## Before you start — three things that aren't code

**1. ~~Find the Stripe page that already exists.~~ Found it, 12 Aug 2026 — and it isn't ours.**

§4 of `project-context.md` says a Stripe subscription page *has already been prototyped and is
connected to Yourgi's Stripe account, unpublished*. That's true, but it is **not a three-plan
subscription page and there is nothing in it to reuse.** The live account contains exactly one
Product, one Price and one Payment Link:

| Object | ID | What it is |
|---|---|---|
| Product | `prod_V19cNesnBYgwPl` | "Yourgi Membership" — *Monthly membership for bookings with Yourgi Pros* |
| Price | `price_1U17JRIgv5bQybH7nXIy7G6O` | $50.00/month recurring |
| Payment Link | `plink_1U17JmIgv5bQybH711thp1rA` | live, still `active`, `submit_type: subscribe` |

All three carry `campaign: membership-c-test`, `owner: chris.mejia`, and a status of
**`DRAFT — not for distribution`** / `DRAFT — internal review only`. It's Chris's product-feasibility
test, not a build to inherit. **Don't repurpose or edit it** — create your own Products.

**That Payment Link is the placeholder this repo used to ship.** It's the live $50/mo link the head
comment in `index.html` warns about and that commit `ed6f31e` blanked. Its URL is deliberately not
repeated here; this repo is public.

**Nobody was ever charged.** The link carries
`restrictions.completed_sessions: { limit: 1, count: 0 }` — it was structurally capped at a single
subscriber, and that one was never used. So the near-miss on the public review branch never fired,
and the worst case was always one $50 charge rather than an open till. Worth knowing before anyone
spends more time worrying about it.

Two things still worth doing about it, neither of them ours to do unilaterally:

- **It is still `active` in live mode.** Ask Chris whether it should be deactivated now that this
  page no longer points at it. Don't deactivate someone else's live object yourself.
- **It's a flat ~$50/mo membership** — which is structurally the Wag!-style discount-membership
  experiment the README floats as the *materially cheaper* alternative to this one. Someone has
  already half-built the cheap test. That's worth raising with David and Scott alongside the
  subsidy question, because it's evidence the cheaper experiment is closer to hand than it looked.

One pattern worth copying from it: it has `phone_number_collection.enabled: true`, which is exactly
what step 1.3 below asks you to turn on.

**2. Check your Power Automate licence before building the flow.** The two actions this design
needs — the **When an HTTP request is received** trigger and the **HTTP** action — are *premium*
connectors. If your account doesn't have them, you'll find out three steps in. Check first. If you
don't have premium, see [If you don't have premium](#if-you-dont-have-premium) at the bottom before
doing anything else, because the whole shape changes.

**3. The channel is Jeff's call** (blocking decision #9). It must be a **new, dedicated** channel,
never the concierge team's order-form channel — subscription signups are not bookings and must not
land in a booking queue. You can build and test the entire flow against a channel only you can see,
then repoint it once Jeff confirms. Don't let this block the build.

Also note: the old Teams **Incoming Webhook** connector is being retired in favour of Power Automate
Workflows. That's why this is a flow and not a URL pasted into Teams.

---

## Doing it by MCP instead of by hand

Both halves of this runbook can be driven by an MCP server rather than clicked, which is worth
knowing before you start clicking.

**Stripe** publishes an official one at `https://mcp.stripe.com`. It's already declared in this
repo's `.mcp.json`, but it does nothing until you authorise it, which needs an interactive session:

```bash
claude mcp add --transport http stripe https://mcp.stripe.com/
```

…then `/mcp` in that session to complete the OAuth consent. It covers Products, Prices, Payment
Links, and webhook endpoints — Part 1.2, 1.3 and Part 3 below.

**Do this first, before authorising anything:** an admin has to enable MCP access at
[dashboard.stripe.com/settings/mcp](https://dashboard.stripe.com/settings/mcp), and **access is
managed separately for sandbox and live mode.** Enable **sandbox only** and leave live off. That
turns "build it in test mode" from a discipline you have to remember into something the account
enforces — an agent physically cannot create a live Product or a live Payment Link. Given the $399
plan below, that's the control worth having.

**Never put a Stripe key in `.mcp.json`.** Stripe's MCP accepts a restricted key as a Bearer header
if a client can't do OAuth, but **this file is tracked and this repo is public** — a key committed
here is a leaked key. Use OAuth. If you genuinely need the header form, put it in your user-level
config outside the repo, and use a restricted key, never `sk_`.

Stripe's own guidance is to keep human confirmation on for these tools, and to be careful running
their MCP alongside other MCP servers, because tool output from one server can carry instructions
that influence an agent. This session already has Figma, Webflow and Mixpanel connected, so that
caution applies.

**Power Automate** has one too: Microsoft's `FlowAgent`, shipped in the
[microsoft/power-platform-skills](https://github.com/microsoft/power-platform-skills) plugin
marketplace — `/plugin install power-automate@power-platform-skills`, which builds, edits, runs and
debugs cloud flows. It needs Node 18+ and `az login` against your tenant.

Two caveats before reaching for it. It authenticates against the whole tenant, which is a wider trust
surface than a Stripe sandbox — and **it does not route around the premium licence question in
[Before you start](#before-you-start--three-things-that-arent-code).** The licence gates the HTTP
trigger and HTTP action themselves, not how the flow gets authored. Part 2 is about fifteen minutes
of clicking, so this is optional convenience rather than a blocker removed.

---

## Part 1 — Stripe

### 1.1 Build it in test mode

Toggle **Test mode** on in the Dashboard and stay there for the whole of this document. Two reasons:

- **Prices aren't approved.** David owns them (blocking decision #1). The page's own head comment
  says the $49 entry plan reopens §7 q1 and "needs David and §7 q1 revisited before this goes to
  paid traffic." Creating live Products now manufactures a fact nobody has agreed to.
- This branch is **served publicly**. A live-mode link reachable from a review URL has already
  nearly charged people real money once — see the `STRIPE_PLACEHOLDER_LINK` comment in `index.html`.

Everything below has a live-mode equivalent you can redo in about ten minutes once prices land.

### 1.2 Three recurring Products

**The exact objects to create are specified in [`stripe/plans.json`](../stripe/plans.json)** — names,
descriptions, amounts in cents, metadata, and every Payment Link setting. Build from that file rather
than from this table, and don't retype values from either into the Dashboard by eye.

That manifest is **machine-checked against the page**: the suite asserts every tier key, price, label
and product description in it matches `index.html`'s `data-tier` / `data-price` / `data-label` and
on-page copy. Change one without the other and the tests fail. The check is there because a mismatch
between the manifest and the page bills someone a price they were never shown, which looks like
nothing at all until a receipt arrives.

For orientation, these are what the page currently serves, per the internal pricing note of
12 Aug 2026 — read `index.html`'s head comment before typing them in:

| Plan | Price | What it buys | `data-tier` |
|---|---|---|---|
| Walks | $49/mo | Five walks a month, walking only | `weekly` |
| Any Five | $99/mo | Five days or nights a month, any service | `twice` |
| Everything | $399/mo | **Unlimited**, all month | `weekdays` |

**The `data-tier` keys are historical and no longer describe the plans** — `weekly`/`twice`/`weekdays`
are left over from the frequency ladder the offer used to be. Don't rename them to match the new
plan names unless you change them in `PLAN_BENEFITS`, `PLAN_UNITS`, `STRIPE_PAYMENT_LINKS`, the
`data-tier` attributes, and the tests together. The keys are what `client_reference_id` carries into
the Teams card, so a half-done rename shows up as a mislabelled signup rather than an error.

> **Read this before you create the $399 Product.** Stripe will charge it every month, and concierge
> zeroes out the bookings against it by hand, so the exposure doesn't happen once — it renews. §6
> asks for a guardrail so a flat fee can't be spent on disproportionately expensive services, and
> the page's head comment states plainly that on this plan there is no longer one: a month of
> nightly house-sitting is the case §6 names, with Pros paid full rate throughout. The page already
> flags it as needing a real answer before it takes money.
>
> Nothing about that is a webhook problem and it doesn't block the build — but the moment this Product
> exists in **live** mode, one shared link is enough for somebody to buy it. Build it in test mode,
> and get the answer before step 5 of Part 5.

### 1.3 A Payment Link per Product

For each one:

- **After payment → Redirect customers to your website**, set to the page's URL with
  `?checkout=success` appended. The final slug is still open (blocking decision #10) — use the real
  URL once it exists. The page reads this parameter to show the confirmation screen.
  - Optionally append `&session_id={CHECKOUT_SESSION_ID}`; Stripe substitutes the real ID. The page
    ignores it today, but it's the hook if you ever want the confirmation screen to be verifiable
    rather than cosmetic.
  - There is no cancel-redirect field. Stripe's back link returns the visitor to wherever they came
    from, which is this page; `?checkout=cancel` exists for the return-trip handler and for manual
    testing.
- **Turn on phone number collection.** Phone is optional on the landing page, so without this some
  paying subscribers arrive with no way to reach them, and the page promises a callback within one
  business day.

Then paste the three links into `STRIPE_PAYMENT_LINKS` in `index.html`:

```js
var STRIPE_PAYMENT_LINKS = {
  weekly:   'https://buy.stripe.com/test_...',
  twice:    'https://buy.stripe.com/test_...',
  weekdays: 'https://buy.stripe.com/test_...'
};
```

The keys must match the `data-tier` attributes exactly. **A typo here silently bills someone the
wrong price** — it is the single most expensive mistake available in this file. Run
`node test/prototype.test.mjs` after; it asserts each plan routes to its own link.

While the placeholder single-link state is in place, four tests in the "flagged placeholder" block
fail on purpose. Replacing the links is what makes them pass.

### 1.4 A restricted API key for the flow

**Developers → API keys → Create restricted key.** Grant **read** on **Events** and nothing else.
That's all the flow needs: it re-fetches one event by ID.

- If you later want the card to show more than the event carries, add **read** on Checkout Sessions,
  Subscriptions, and Customers. Still read-only.
- Never grant write. The flow's only job is to look something up.
- This key goes into the Power Automate flow, **never into `index.html`**. A test asserts no
  `sk_...` key is present in page source.

---

## Part 2 — The Power Automate flow

Create it in the environment that owns the Teams channel. **Action names matter** — the card JSON in
`webhook/` references them by name, so if you rename an action, update the expressions.

### 2.1 Trigger — `When an HTTP request is received`

- **Who can trigger:** Anyone. Stripe can't authenticate to Power Automate, so this has to be open;
  the verify step in 2.3 is what makes that safe.
- Leave the JSON schema empty, or paste a Stripe event sample. Leaving it empty is fine — the
  expressions reach into the body by path.
- Save the flow, then copy the generated **HTTP POST URL**. You need it for Part 3.

> **Treat that URL as a credential.** It contains a SAS signature, and anyone holding it can post
> into the channel. Don't commit it, don't paste it into the page, don't put it in a ticket. A test
> asserts it hasn't been committed to `index.html`.

Power Automate answers `202 Accepted` automatically if you don't add a Response action. Stripe
accepts any 2xx, so leave it — the flow then does its work asynchronously and Stripe isn't kept
waiting.

### 2.2 Condition — only handle the events you care about

Add a **Condition**: `triggerBody()?['type']` **is equal to** `checkout.session.completed`.

Everything else falls out of the "No" branch and does nothing. Stripe will send other event types
the moment someone widens the endpoint's subscription list, and an unrecognised event should be
silence, not a malformed card.

### 2.3 HTTP — `Verify event with Stripe`

**This is the security step. Don't skip it and don't reorder it.**

- **Method:** GET
- **URI:** `https://api.stripe.com/v1/events/@{triggerBody()?['id']}`
- **Headers:** `Authorization: Bearer rk_test_...` (the restricted key from 1.4)

The request body arrived from the open internet. This response came from Stripe. If someone
discovers the flow URL and posts a fabricated "paid" event, the ID won't exist, this action returns
404, the run fails, and no card is posted.

Everything downstream **must** read this action's response, not `triggerBody()`. If you point the
card at `triggerBody()` to save a step, the verification becomes decorative and an attacker's own
JSON gets rendered into the channel.

> Stripe's real signature check is an HMAC-SHA256 over the raw body using the endpoint's signing
> secret. Power Automate has no native HMAC action, so this re-fetch is the standard substitute. It
> is not quite as strong — it proves the event is real, not that *this request* came from Stripe —
> but combined with the secret URL it closes the gap that actually matters: nobody can invent a
> payment. See [Why not a proper signature check](#why-not-a-proper-signature-check).

### 2.4 Compose — `Session` and `Ref`

Two **Compose** actions, named exactly:

| Name | Value |
|---|---|
| `Session` | `body('Verify_event_with_Stripe')?['data']?['object']` |
| `Ref` | `coalesce(outputs('Session')?['client_reference_id'], 'yg_unknown_unknown_0')` |

`Ref` unpacks the `yg_<tier>_<zip>_<timestamp>` string the page builds — see `checkoutUrl()` in
`index.html`. It's the only context Stripe doesn't already collect, and it's why the page can get
away with such a short form.

**The `coalesce` is not decoration.** A Payment Link opened directly — shared, forwarded,
bookmarked — carries no `client_reference_id`, and `split()` on null fails the whole run. The
fallback yields `unknown` for both fields, and the card calls that out loudly, because a signup that
skipped the form also skipped the ZIP market gate. That's someone we may have no Pro for.

### 2.5 Post the card

Teams action: **Post adaptive card in a chat or channel**.

- **Post as:** Flow bot · **Post in:** Channel · **Team/Channel:** the dedicated channel from Jeff
- **Adaptive Card:** the contents of [`webhook/teams-card-signup.json`](../webhook/teams-card-signup.json)

Strip the `_comment` keys before pasting if the action objects to them — they're documentation for
whoever reads this next, not card syntax.

### 2.6 Optional but recommended — cancellations and failed payments

Add a second branch (or a second flow) for `customer.subscription.deleted` and
`invoice.payment_failed`, using [`webhook/teams-card-churn.json`](../webhook/teams-card-churn.json).
Same verify-then-read discipline: `Obj` = `body('Verify_event_with_Stripe')?['data']?['object']`.

Worth the extra twenty minutes. **This experiment asks whether people will pay for a recurring
plan** — and a subscriber who cancels in week two is a different answer from one who renews.
Cancellation happens in Stripe's hosted portal, which this page deliberately doesn't wrap, so
Mixpanel cannot see it. Without this, the only number anyone can report is gross signups, which is
the flattering one. Blocking decision #8 says no success metric is defined yet; churn is half of
whatever that metric turns out to be.

---

## Part 3 — Point Stripe at the flow

**Developers → Webhooks → Add endpoint** (still in test mode).

- **Endpoint URL:** the Power Automate HTTP POST URL from 2.1
- **Events:** `checkout.session.completed` — plus `customer.subscription.deleted` and
  `invoice.payment_failed` if you built 2.6

Subscribe to those events and no others. A broad subscription means Stripe hammers the flow with
traffic it will only discard, and Power Automate runs are metered.

Stripe retries failed deliveries with backoff for up to three days, so a flow that's briefly broken
won't lose signups — but it will queue them, and they arrive late. Check the endpoint's delivery log
if the channel goes quiet.

---

## Part 4 — Test it

### ⚠️ Do not test with "Send test webhook"

The Dashboard's **Send test webhook** button sends a synthetic event whose ID (`evt_00000000000000`)
**does not exist in the API**. The verify step in 2.3 will 404 and the run will fail. That is the
verification working correctly, not a bug — but it will look like one for twenty minutes if you
don't know.

**Test with a real test-mode checkout instead.** It's the only path that exercises the whole chain.

### The real test

1. Serve the page: `python3 -m http.server 8137`
2. Pick a plan, enter an in-market ZIP (`80202`), a real-looking email, and submit.
3. Confirm you land on Stripe with the right plan and price.
4. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
5. Confirm Stripe redirects back to `?checkout=success` and the confirmation screen shows.
6. **Confirm the card lands in Teams**, showing `Mode: TEST`, the right plan, and the right ZIP.
7. In Power Automate, open the run history and check `Verify event with Stripe` returned 200.

### Then test the ways it goes wrong

| Test | Expected |
|---|---|
| Out-of-market ZIP (`90210`) | Never reaches Stripe. No Teams card. Honest "no Pros there yet" screen. |
| Open a Payment Link directly, pay | Card posts with ZIP `unknown` and the "did NOT come through the form" warning |
| Back out on Stripe's page | `?checkout=cancel`, no Teams card, no subscription in Stripe |
| Each of the three plans | Three cards, three different amounts, each matching the plan clicked |
| POST junk to the flow URL with `curl` | Run fails at the verify step. **No card posts.** |

That last one is the one to actually run. It's the whole reason 2.3 exists.

---

## Part 5 — Going live

Only after prices are approved (blocking decision #1) and Jeff has named the channel (#9):

1. Redo Part 1 in **live mode** — Products, Payment Links, and a **live** restricted key (`rk_live_...`).
2. Swap the key in the flow's HTTP action and add a **live-mode** webhook endpoint in Stripe.
3. Put the live Payment Links into `index.html` **on the product branch, not `gh-pages`.** This
   branch is served publicly and must never carry a live payment link.
4. `node test/prototype.test.mjs`.
5. Do one real purchase yourself and refund it. The card should say `Mode: LIVE`.

---

## Why it's built this way

### Why not a proper signature check

Stripe's own verification is an HMAC-SHA256 over the raw request body. Power Automate can't compute
one without an Azure Function or the premium inline-code action, and adding either means this
project acquires a deployed service, a secret store, and a deploy step — for a static page whose
whole point is that it drops into Webflow custom code with no build.

The re-fetch gets the property that matters: **nobody can invent a payment**, because event IDs come
from Stripe or they don't resolve. What it doesn't prove is that a given *request* came from Stripe
— someone holding both the flow URL and a real event ID could replay it and post a duplicate card.
That's a nuisance, not a loss, and the flow URL is unguessable.

If this graduates from experiment to product, replace the flow with a small function doing real
signature verification. It's about forty lines. Don't do it now.

### Why the page no longer posts to Teams

Covered above and in the comments in `index.html`, but the short version: the page fires *before*
payment, so it can only report intent. Stripe fires *after*, so it reports fact. Staff act on the
channel. Only the second one belongs there.

### What this does not do

- **It does not issue coupons.** §4 keeps that manual and so does this. The card tells staff to do it.
- **It does not set up services.** Also manual, also §4 — the callback does that.
- **It does not verify the confirmation screen.** `?checkout=success` is still a typed URL parameter
  and still unverifiable; `Subscription Started` is still tagged `verified: false`. This flow is what
  makes signups countable, so **count them from Stripe or from this channel, never from Mixpanel.**

---

## If you don't have premium

The Request trigger and the HTTP action are premium connectors. Without them:

- **Ask for a Power Automate Premium licence.** This is the cleanest answer and probably a cheap
  ask for one seat. Try this first.
- **Fall back to the `When a Teams webhook request is received` trigger** (standard, and the
  designated replacement for the retired Incoming Webhook connector). Stripe can POST to it and you
  can read the body — but **you cannot make the outbound call to verify the event**, so the card
  would be built from whatever arrived at an internet-reachable URL. If you go this way, say so on
  the card, keep the URL tightly held, and treat the channel as a heads-up that prompts someone to
  check Stripe rather than as authorisation to onboard.
- **Skip the webhook for now.** With `checkout.session.completed` unhandled, Stripe's Dashboard is
  still the source of truth and someone checks it daily. Worse, but honest, and it doesn't put
  fabricated signups in front of staff.

Whichever way this goes, the page-side work in Part 1 stands on its own and is worth doing first.
