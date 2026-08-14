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

## Fastest path to a real card in a Teams channel

The short version, for getting one fake payment to produce one real Teams message. Detail for every
step is further down.

**Use Yourgi's own account in test mode, not a throwaway sandbox.** A claimable sandbox can't issue
restricted API keys, so the verification step can't be built there at all. In Yourgi's account you
have the Dashboard, and test mode is just as safe.

```bash
stripe login                          # points the CLI at Yourgi's account
node stripe/create-plans.mjs --go     # 3 products, 3 prices, 3 test links, portal configured
```

Then, in order:

1. **Stripe → Developers → API keys → Create restricted key.** Read on **Events**. Copy it.
2. **Power Automate → new flow**, four actions, named exactly as below (the card references them):
   - Trigger: **When an HTTP request is received** · Who can trigger: *Anyone* · Save, then copy the URL.
   - **Condition**: `triggerBody()?['type']` equals `checkout.session.completed`
   - **HTTP** action named `Verify event with Stripe` · GET
     `https://api.stripe.com/v1/events/@{triggerBody()?['id']}` · header
     `Authorization: Bearer <the restricted key>`
   - Two **Compose** actions: `Session` = `body('Verify_event_with_Stripe')?['data']?['object']`,
     and `Ref` = `coalesce(outputs('Session')?['client_reference_id'], 'yg_unknown_unknown_0')`
   - **Post adaptive card in a chat or channel** → paste
     [`webhook/teams-card-signup.paste.json`](../webhook/teams-card-signup.paste.json) *(the
     `.paste.json` files have the explanatory keys stripped so they paste without editing)*
3. **Stripe → Developers → Webhooks → Add endpoint** (still test mode). URL = the flow URL. Event =
   `checkout.session.completed` only.
4. **Paste the three test links** into `STRIPE_PAYMENT_LINKS`, run `node test/prototype.test.mjs`.
5. **Buy something.** Serve the page, pick a plan, ZIP `80202`, card `4242 4242 4242 4242`, any future
   expiry, any CVC. The card should land in the channel within a few seconds.

**Debug it in two halves, not one.** If nothing arrives, you don't know whether Stripe failed to
call the flow or the flow failed to post. Test the second half first: POST the card JSON straight at
the flow URL and confirm it renders in Teams. Only then wire Stripe up. Stripe's **Developers →
Webhooks → your endpoint** page shows every delivery attempt and its response, which answers the
first half.

**Do not point this at the concierge order-form channel** — blocking decision #9. Build it against a
channel only you can see, then repoint once Jeff confirms the real one.

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

**2. ~~Check your Power Automate licence.~~ CHECKED 13 Aug 2026 — Lauren does NOT have premium.**

The design's two key actions — the **When an HTTP request is received** trigger and the **HTTP**
action — are premium connectors, and Flow checker reports *"This flow's owner needs a Power Automate
Premium license."* The flow saves; it just cannot run.

**How to check this properly, because the obvious way is misleading.** The trigger appears in the
list and can be added to a flow whether or not you're licensed. Saving succeeds too. The licence
only surfaces in **Flow checker → Warnings**, or in the banner *"Your flow is saved but can't be
used."* Don't take an addable trigger or a successful save as evidence — open Flow checker.

**Decided 14 Aug 2026 by Lauren: request the licence. Do not take the trial.** The order below used to
recommend the opposite, on the grounds that 90 days is a good match for a beta that may be wound down
inside a quarter. The flaw in that: when the trial lapses the flow **stops posting to Teams silently**
— no error reaches anyone who isn't looking at Flow checker. Signups keep arriving and the channel
goes quiet, which is indistinguishable from nobody signing up, and that number is the entire point of
the experiment. A notification system whose failure mode mimics its success criterion isn't worth 90
free days.

Options, in the order to try them:

- **A licence request to your admin**, linked from that Flow checker panel. Microsoft warns it can
  take up to 7 days to propagate. This is the chosen route — the ask is drafted in
  [`open-asks.md`](open-asks.md) §4.
- **The free 90-day trial**, offered in the same panel. **Fallback only, if the licence stalls and
  the build can't wait.** If you take it: record the expiry date at the top of this file, and set a
  reminder before it — the whole point is that nothing else will tell you. After enabling it, **edit
  and re-save the flow**; the licence doesn't apply to an already-saved flow until you do.
- **Go non-premium** — see [If you don't have premium](#if-you-dont-have-premium). Workable, but it
  loses event verification, which changes what the channel means.
- **Skip Power Automate for the beta** — see the same section. Stripe can email on every successful
  payment, which for a small beta with manual fulfilment may be enough on its own.

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
enforces — an agent physically cannot create a live Product or a live Payment Link. Given the $499
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

### ⚠️ Check what your Stripe role actually allows first

Lauren has access to Yourgi Pro but **cannot create API keys** — `stripe login` fails with *"you
don't have permission to create an API key for this merchant."* That's a limited Dashboard role;
key creation needs **Developer** or **Administrator**.

Two separate permissions matter here, and they fail independently:

| Needed for | Permission | Status |
|---|---|---|
| The three Payment Links (what the landing page needs) | Write access to Products / Payment Links | **Unconfirmed** — try creating one in the Dashboard |
| The restricted key (what the webhook's verify step needs) | API key creation | **Blocked** |

**These are worth separating rather than treating as one ask.** The landing page only needs the
Payment Links — it never touches an API key. So if the Dashboard lets you create a Payment Link,
checkout can ship while the key question is still being sorted, and only the Teams notification
waits.

**Decided 14 Aug 2026 by Lauren: ask an admin to issue the key; don't ask for a role.** A restricted
key with **read on Events and nothing else** is a far easier yes than Developer on the live account,
and it unblocks the only thing actually waiting on it. The Developer role is what a move to live mode
would need — that's deliberately not being asked for yet, since live mode is gated on everything else
here anyway. The drafted ask is in [`open-asks.md`](open-asks.md) §4.

If the role does come up instead: **Developer on Yourgi Pro** covers both permissions in the table
above. Failing that, an admin can create the three Products and Payment Links from
[`stripe/plans.json`](../stripe/plans.json) and issue the restricted key.

### Fastest route: create them from the manifest

Skips the Dashboard and the MCP entirely. The Stripe CLI authenticates through your browser, so no
API key is ever typed or stored, and it defaults to test mode.

```bash
brew install stripe/stripe-cli/stripe && stripe login
```

```bash
node stripe/create-plans.mjs
```

That's a **dry run** — it prints exactly what it would create and touches nothing. When it looks
right:

```bash
node stripe/create-plans.mjs --go
```

It creates all nine objects and prints the finished `STRIPE_PAYMENT_LINKS` block ready to paste. The
script never passes `--live` and aborts the moment Stripe hands back an object with
`livemode: true`, so a mis-pointed CLI stops it rather than leaving half a live plan behind.

**It also refuses to create a second set.** If the account already holds Pack products it stops and
lists them rather than creating duplicates. This is not hypothetical — five runs against the test
sandbox produced 15 products, and in the Dashboard they are indistinguishable, so nothing tells you
which Payment Link the live page actually uses. Reuse the existing links, or archive them first.
`--anyway` overrides, for when a second set is genuinely what you want.

Prefer clicking? The Dashboard steps are below and produce the same thing — just read the values
off `plans.json` rather than retyping them.

That manifest is **machine-checked against the page**: the suite asserts every tier key, price, label
and product description in it matches `index.html`'s `data-tier` / `data-price` / `data-label` and
on-page copy. Change one without the other and the tests fail. The check is there because a mismatch
between the manifest and the page bills someone a price they were never shown, which looks like
nothing at all until a receipt arrives.

For orientation, these are what the page currently serves, per the internal pricing note of
12 Aug 2026 — read `index.html`'s head comment before typing them in:

| Plan | Price | What it buys | `data-tier` |
|---|---|---|---|
| Two Anything | $49/mo | Two services per month for one pet | `weekly` |
| Five Anything | $99/mo | Five services per month for one pet | `twice` |
| Full Coverage | $499/mo | **Unlimited** services every 30 days for one pet | `weekdays` |

The middle column was stale until 13 Aug 2026 — it still described the entry plan as "five walks
a month, walking only", which stopped being true when all three plans became any-service. It now
carries each plan tile's blurb verbatim, which is also the Stripe product description.

**The `data-tier` keys are historical and no longer describe the plans** — `weekly`/`twice`/`weekdays`
are left over from the frequency ladder the offer used to be. Don't rename them to match the new
plan names unless you change them in `PLAN_BENEFITS`, `PLAN_UNITS`, `STRIPE_PAYMENT_LINKS`, the
`data-tier` attributes, and the tests together. The keys are what `client_reference_id` carries into
the Teams card, so a half-done rename shows up as a mislabelled signup rather than an error.

> **Read this before you create the $499 Product.** Stripe will charge it every month, and concierge
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
  paying subscribers arrive with no way to reach them — and the signup card tells staff to call
  within 1 business day. (The page itself no longer promises a callback; that claim went with the
  move to self-serve booking.)

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

**Then run `node stripe/verify-links.mjs`, because the offline suite cannot catch the worst case.**
`prototype.test.mjs` compares two files in this repo to each other, so the page and `plans.json` can
agree perfectly while Stripe charges something else entirely — which is exactly what happened on
13 Aug 2026, when the top plan went to $499 here and stayed at $399 in Stripe for part of the day.
`verify-links.mjs` reads the URLs out of `index.html`, resolves each one against the live API, and
checks the amount, mode, active flag, tier metadata, submit line, phone collection, terms and
redirect per tier. It needs network and an authenticated Stripe CLI, which is why it is a separate
command and not part of the suite. **Run it after any price change, and before anyone is sent to
the page.**

**A price change is always a replacement, never an edit.** Stripe Prices are immutable: to move a
plan's price you create a new Price, create a new Payment Link off it, put the new URL in
`STRIPE_PAYMENT_LINKS`, and archive the old pair. Anything still holding the old URL keeps billing
the old amount — it does not fail, it charges wrong. And do the archiving **after** the page points
at the new link, so a half-finished change leaves an untidy account rather than a broken checkout.

While the placeholder single-link state is in place, four tests in the "flagged placeholder" block
fail on purpose. Replacing the links is what makes them pass.

### 1.3b Reconcile against the T&Cs — Legal wrote us a Stripe checklist

`Yourgi_Pack_Terms_and_Conditions_DRAFT_5` (Emily Farabi, 13 Aug 2026) carries an **Annex A** that
maps clauses to the Stripe settings they depend on: *"Every clause below describes behavior that
Stripe controls. The clause is only true if the Stripe Dashboard is configured to match it."* Read it
before configuring anything. The doc is marked **DRAFT — DO NOT PUBLISH**, so treat what follows as
what we'd have to reconcile, not as settled.

**Three conflicts with what we've built:**

| | Terms say | We have |
|---|---|---|
| **Full Coverage price** | **$499** (Schedule 1) | **$499** on the page, in `plans.json`, and in Stripe |
| **Refunds** | 12.1: monthly fees are **non-refundable**; no credit for partial months or unused allowance, with named exceptions in 12.2 | FAQ offers a discretionary refund for the current month |
| **"Link on your receipt"** | Annex A row 11: *Stripe receipts do not contain a portal link by default* | FAQ and the Stripe terms text both tell people to cancel from that link |

That last one fails on first contact: two pieces of customer-facing copy point at a link Stripe
doesn't put there. Terms 9.1 also leaves a placeholder for a permanent cancellation URL, and notes a
portal session link expires — so the permanent URL needs a page that generates one.

**Settings the terms require that we haven't set:**

- **Customer emails** — successful payments, failed payments, **and upcoming renewal** (7.5, Annex row 2).
  A renewal reminder is a commitment in the terms, not a nicety.
- **Retries** — 8 attempts over 2 weeks is Stripe's default and what 8.1 assumes; confirm the end
  behaviour matches 8.4.
- **Disputes → cancel** (10.1(d)). Stripe keeps cycling by default, creating further disputed charges.
- **Cancellation-reason collection** in the portal (9.5) — optional for the customer, and cheap
  churn data for a test whose whole purpose is measuring whether people stay.
- **Tax** (7.6) — Stripe Tax enabled, or handled manually.

**What we already got right:** cancel at period end rather than immediately (9.2 — Stripe's API
default is immediate, so this had to be set), self-serve cancellation in the portal (9.1), and a
recurring monthly price anchored at creation (7.2).

**The item Legal calls the most important in the Annex** isn't a Stripe setting at all — it's row 14.
The Plus Coupon must be bound to the subscriber's Yourgi account. `max_redemptions` caps redemptions
**across all customers**, so an unbound 5-use code can be burned by five strangers. That's the
mechanism the whole product runs on, and it sits outside this repo.

### 1.3c One person changes a price at a time

A price change in Stripe isn't an edit. Prices are immutable, so it's **a new Price, a new Payment
Link, a new URL in the page, and archiving the old pair** — four steps that have to land together.

On 13 Aug 2026 two people did that simultaneously in the sandbox and produced two active $499 prices
and two active Payment Links on the same product, identically configured. In a throwaway sandbox
that's clutter. **In the live account it means two working links that both charge real money, and
nothing in Stripe telling you which one the page bills through** — the Dashboard shows two identical
rows distinguished only by creation time.

What resolved it, and is worth keeping as the rule: **whichever link `index.html` references
survives, and the other pair is archived.** The page is the tiebreak because it's the only artefact
that decides what a customer actually pays.

Two practical guards:

- **Say out loud who owns the Stripe half before starting**, and let that person do all four steps.
  Splitting "archive the old" from "swap the URL" across two people is how the page ends up
  referencing an archived link — which is worse than the duplicate, because checkout breaks.
- **Verify from the API, not from intent.** Resolve the URL in the page to its Payment Link, expand
  `line_items`, and compare `amount_total` against `unit_amount` in `plans.json`. That check is what
  proved the duplicate was gone; two people each *believing* they'd cleaned up proved nothing.

### 1.4 Point the terms checkbox at the real Terms & Conditions

All three Payment Links already set `consent_collection.terms_of_service: required`, so checkout shows
a checkbox nobody can subscribe without ticking. **What that checkbox links to is not set on the
Payment Link.** Per Stripe's docs it links to the *Terms of service URL set in your account's Public
details* — one account-level setting that every link inherits:

**Settings → Public details → Terms of service URL** (`dashboard.stripe.com/settings/public`)

Three consequences worth knowing:

- **Set it once and all three links pick it up.** Nothing needs recreating, and no code changes.
- **Until it's set, the checkbox is agreement to nothing in particular.** Worth checking what the
  live account currently has there before assuming it's blank.
- **The same page has a Privacy policy URL**, which Checkout also links when set.

The URL must be **publicly reachable**. A Webflow *Designer* link
(`*.design.webflow.com/?pageId=…`) is not — it serves an app shell to anyone not logged in, so the
page must be published first and the published URL used.

> **Check the custom terms text against the real T&Cs before this goes live.** Our
> `custom_text.terms_of_service_acceptance.message` makes its own commitments at the point of sale —
> automatic monthly renewal, cancellation taking effect at the end of the paid month, and notice
> before the next charge if anything changes. Once the checkbox links to a real T&C document, a buyer
> is shown **two** statements of terms at once. Where they overlap they have to agree, and where the
> T&C is more specific our text should defer to it rather than paraphrase it. That's a review, not a
> code change — but it's the kind of mismatch that only surfaces in a dispute.

Note for later: `consent_collection` can only be set when a Payment Link is **created**, not updated.
Ours is already `required`, so nothing to do — but changing it later means new links.

### 1.5 Let subscribers change plan — the page already promises it

Step 1 on the landing page says **"Move up, move down, or cancel any month."** Cancelling works out
of the box. **Switching plans does not** — it's off by default in Stripe's customer portal, so
without this the page promises something a subscriber has no way to do.

`create-plans.mjs` does this for you. By hand, it's **Settings → Billing → Customer portal**: turn on
*Customers can switch plans*, add the three Pack products, and leave *Customers can update payment
methods* on (Stripe rejects plan switching without it — someone moving to a dearer plan may need a
working card).

Three things that cost time if you don't know them:

- **Only the DEFAULT configuration is used.** Creating a second one changes nothing. On a fresh
  account the first one becomes the default; on an account that already has one, edit that.
- **Name the three products explicitly.** The allowlist is what stops a subscriber switching onto
  an unrelated product in the same account — and Yourgi's live account already holds Chris's old
  $50/mo membership test.
- **The API accepts the product list but doesn't return it.** A retrieve shows no `products` key
  even when it's set. Don't "fix" that — a missing list fails the call rather than passing it.

Set proration to **create prorations** so a mid-month change bills the difference rather than
charging twice, and cancellation to **at period end** so someone keeps the month they've paid for.

> **Worth a decision, not just a setting.** Plan switching is another route into the uncapped $499
> plan: someone can subscribe to Walks at $49 and upgrade mid-cycle, paying only the difference.
> That's ordinary SaaS behaviour, but note it **bypasses any completed-sessions cap on the Payment
> Link** — that cap limits checkouts, not upgrades. If the cap is your subsidy guardrail, it has a
> hole in it, and the portal allowlist is where you'd close it.

### 1.6 A restricted API key for the flow

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

### Test the card before you build the flow

The Stripe CLI can forward real events to a local receiver, so the Adaptive Card can be checked
against genuine payloads before Power Automate exists:

```bash
stripe listen --forward-to http://localhost:4324/__webhook --events checkout.session.completed
```

Doing this first caught two things that would otherwise have surfaced three steps into building the
flow:

- **A failed verification looked like a successful one.** Stripe answers a rejected read with a
  perfectly valid JSON body containing an `error` key — which is truthy. A receiver that checks
  "did I get an object back" passes on failure and renders a card full of blanks while claiming it
  was verified. **Check for the `error` key, not for a response.** The Power Automate equivalent is
  to branch on the HTTP action's status code rather than assuming success.
- **A claimable sandbox key cannot read `/v1/events` at all**, so the verify step returns
  *"This is a claimable sandbox key with limited permissions."* **You must claim the sandbox** (the
  `claim_url` from `stripe sandbox create`) before the verification step can be exercised at all.

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
