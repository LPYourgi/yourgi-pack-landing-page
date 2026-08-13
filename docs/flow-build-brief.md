# Build brief — Stripe → Teams flow for Yourgi Plus

**For:** whoever has a Power Automate Premium licence · **From:** Lauren Palma · **13 Aug 2026**

Self-contained. You shouldn't need to read anything else in this repo.

## What's needed and why you

A landing-page experiment ("Yourgi Plus") sells three monthly plans through Stripe. When someone
pays, staff need a card in a Teams channel so concierge can follow up.

**The flow needs two premium actions** — the *When an HTTP request is received* trigger and the *HTTP*
action — and Lauren doesn't have a Premium licence. Flow checker says *"This flow's owner needs a
Power Automate Premium license."*

**It only needs to be premium for the owner.** Stripe triggers it over HTTP, so nobody signs in to
run it. If you own it, it runs on your licence and Lauren just needs the URL. She doesn't need edit
access for it to work.

## Build this — six actions

**1. Trigger: When an HTTP request is received**
- Who can trigger: **Anyone** (Stripe can't authenticate to Power Automate; step 3 is what makes
  that safe)
- Leave the JSON schema empty
- Save, then copy the generated **HTTP POST URL** — that's what Lauren needs back

**2. Condition** — `triggerBody()?['type']` **is equal to** `checkout.session.completed`
Everything else falls out the "No" branch and does nothing.

**3. HTTP — name this action exactly `Verify event with Stripe`**
- Method **GET**, URI `https://api.stripe.com/v1/events/@{triggerBody()?['id']}`
- Header `Authorization: Bearer <restricted Stripe key — Lauren will send this separately>`

*This is the security step.* The request body arrived from the open internet; this response came from
Stripe. If someone finds the flow URL and posts a fake "paid" event, the ID won't resolve, the action
404s, and no card posts. **Everything downstream must read this action's response, not
`triggerBody()`** — otherwise the check is decorative and an attacker's own JSON gets rendered into
the channel.

**4 & 5. Two Compose actions, named exactly:**

| Name | Value |
|---|---|
| `Session` | `body('Verify_event_with_Stripe')?['data']?['object']` |
| `Ref` | `coalesce(outputs('Session')?['client_reference_id'], 'yg_unknown_unknown_0')` |

The `coalesce` matters: a Payment Link opened directly carries no `client_reference_id`, and
`split()` on null fails the whole run.

**6. Post adaptive card in a chat or channel**
- Post as **Flow bot** · Post in **Channel**
- Adaptive Card: paste the JSON below into the field labelled **Adaptive Card** (not *Message*).
  Do it in the visual designer rather than code view — the designer handles the escaping.

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "text": "PACK SIGNUP — PAID", "weight": "Bolder", "size": "Medium", "wrap": true },
    { "type": "TextBlock", "text": "@{formatNumber(div(float(outputs('Session')?['amount_total']), 100), 'C2', 'en-US')}/mo · @{split(outputs('Ref'), '_')[1]} · ZIP @{split(outputs('Ref'), '_')[2]}", "isSubtle": true, "spacing": "None", "wrap": true },
    { "type": "TextBlock", "text": "@{if(body('Verify_event_with_Stripe')?['livemode'], '', '**TEST MODE — no real money moved. Do not contact or onboard this person.**')}", "color": "Attention", "weight": "Bolder", "wrap": true },
    { "type": "FactSet", "facts": [
      { "title": "Plan", "value": "@{split(outputs('Ref'), '_')[1]}" },
      { "title": "Charged", "value": "@{formatNumber(div(float(outputs('Session')?['amount_total']), 100), 'C2', 'en-US')} @{toUpper(coalesce(outputs('Session')?['currency'], 'usd'))} / month" },
      { "title": "Email", "value": "@{coalesce(outputs('Session')?['customer_details']?['email'], 'not provided')}" },
      { "title": "Phone", "value": "@{coalesce(outputs('Session')?['customer_details']?['phone'], 'NOT COLLECTED — get one on the call')}" },
      { "title": "ZIP", "value": "@{split(outputs('Ref'), '_')[2]}" },
      { "title": "Mode", "value": "@{if(body('Verify_event_with_Stripe')?['livemode'], 'LIVE', 'TEST')}" },
      { "title": "Next", "value": "Verified paid by Stripe. Call within 1 business day to set their days and introduce their Pro, then issue the coupon so qualifying bookings zero out." }
    ]},
    { "type": "TextBlock", "text": "@{if(equals(split(outputs('Ref'), '_')[2], 'unknown'), 'This signup did NOT come through the landing page form — the Payment Link was opened directly, so the ZIP market gate never ran. Confirm we have coverage BEFORE promising a Pro.', '')}", "color": "Attention", "wrap": true },
    { "type": "TextBlock", "text": "Stripe event @{body('Verify_event_with_Stripe')?['id']} · @{formatDateTime(utcNow(), 'yyyy-MM-dd HH:mm')} UTC", "isSubtle": true, "size": "Small", "wrap": true }
  ],
  "actions": [
    { "type": "Action.OpenUrl", "title": "Open subscription in Stripe", "url": "@{concat('https://dashboard.stripe.com/', if(body('Verify_event_with_Stripe')?['livemode'], '', 'test/'), 'subscriptions/', coalesce(outputs('Session')?['subscription'], ''))}" },
    { "type": "Action.OpenUrl", "title": "Open customer", "url": "@{concat('https://dashboard.stripe.com/', if(body('Verify_event_with_Stripe')?['livemode'], '', 'test/'), 'customers/', coalesce(outputs('Session')?['customer'], ''))}" }
  ]
}
```

Every `outputs('Session')` and `body('Verify_event_with_Stripe')` above refers to the actions named in
steps 3–5. If you rename an action, update these to match or the card renders blanks.

## Which channel

**A new, dedicated channel — not the concierge order-form channel.** The team agreed subscription
signups must not land in a booking queue. Jeff owns which channel it is. Build against a private one
if that isn't settled yet; it's one field to change later.

## Two gotchas that cost time

**Don't test with Stripe's "Send test webhook" button.** It sends a synthetic event whose ID doesn't
exist in the API, so step 3 will 404 and the run will fail. That's the verification working
correctly, but it looks like a bug. Test with a real test-mode checkout instead.

**A failed verification returns valid JSON.** Stripe answers a rejected read with a body containing
an `error` key — which is truthy. Branch on the HTTP action's **status code**, not on "did I get a
response". A verification step that passes on failure is worse than none.

## What to send back

Just the **HTTP POST URL** from step 1. Lauren pastes it into Stripe as a webhook endpoint
(Developers → Webhooks → Add endpoint, event `checkout.session.completed`).

Treat that URL as a credential — it carries its own SAS token and anyone holding it can post into the
channel. Don't put it in a ticket or commit it anywhere.

**The Stripe key should not come to you over Teams chat or email.** Ask Lauren to share it through a
password manager or your internal secrets tool. It's read-only on Events, so the blast radius is
small, but it's still a key.

## Worth deciding, not just building

**Don't leave this on a personal account long term.** If it lives on your user and you change roles
or the licence lapses, signup notifications stop — silently, with no error anyone sees. For anything
beyond the beta, move it to a service account or a shared solution-aware environment so ownership
isn't a single person.

## Optional second card

If it's quick: add a branch for `customer.subscription.deleted` and `invoice.payment_failed`, same
verify-then-read pattern, with `Obj` in place of `Session`. Cancellations happen in Stripe's hosted
portal where the product's own analytics can't see them, so without this the only reportable number
is gross signups — the flattering one.

```json
{
  "type": "AdaptiveCard",
  "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
  "version": "1.4",
  "body": [
    { "type": "TextBlock", "text": "@{if(equals(body('Verify_event_with_Stripe')?['type'], 'customer.subscription.deleted'), 'PACK CANCELLED', 'PACK PAYMENT FAILED')}", "weight": "Bolder", "size": "Medium", "color": "Attention", "wrap": true },
    { "type": "FactSet", "facts": [
      { "title": "Event", "value": "@{body('Verify_event_with_Stripe')?['type']}" },
      { "title": "Customer", "value": "@{coalesce(outputs('Obj')?['customer_email'], outputs('Obj')?['customer'], 'unknown')}" },
      { "title": "Mode", "value": "@{if(body('Verify_event_with_Stripe')?['livemode'], 'LIVE', 'TEST')}" },
      { "title": "Next", "value": "Stop the manual coupon so bookings are not zeroed out any more, and log WHY. A first-cycle cancellation is feedback on the offer — ask before closing it out." }
    ]},
    { "type": "TextBlock", "text": "Stripe event @{body('Verify_event_with_Stripe')?['id']}", "isSubtle": true, "size": "Small", "wrap": true }
  ]
}
```

---

## Questions

Lauren Palma — lauren.palma@destpet.com. The full runbook, including the Stripe side, is in
`docs/stripe-webhook.md` in the landing-page repo if you want the background, but you shouldn't need
it to build this.
