#!/usr/bin/env node
/* Creates the three Yourgi Plus plans in Stripe, fresh, from stripe/plans.json.
 *
 *   node stripe/create-plans.mjs            # dry run — prints what it would create, touches nothing
 *   node stripe/create-plans.mjs --go       # actually creates them
 *
 * Prerequisites: the Stripe CLI, authenticated.
 *   brew install stripe/stripe-cli/stripe
 *   stripe login          # opens a browser; no API key is ever typed into or stored by this script
 *
 * TEST MODE ONLY, BY CONSTRUCTION. The CLI defaults to test mode, this script never passes --live,
 * and it aborts the moment Stripe returns an object with livemode:true. That last check is the one
 * that matters: prices here are not approved (blocking decision #1) and the $399 plan has no
 * subsidy ceiling yet, so a live object created by accident is a real liability, not a tidy-up.
 *
 * It creates its OWN products and reuses nothing. It does not touch, edit or reference the
 * "Yourgi Membership" feasibility test already on the account — different offer, different owner.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'plans.json'), 'utf8'));
const GO = process.argv.includes('--go');

const { shared, plans } = manifest;
const pl = shared.payment_link;

// Each entry becomes a `-d key=value` pair. Kept as [key, value] so nothing needs shell quoting.
const d = pairs => pairs.flatMap(([k, v]) => ['-d', `${k}=${v}`]);
const metaPairs = tier => Object.entries({ ...shared.metadata, tier }).map(([k, v]) => [`metadata[${k}]`, v]);

function run(args) {
  const out = execFileSync('stripe', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

/* A live object means the CLI is pointed somewhere this script must not be. Stop at the first one
   rather than carrying on and leaving a half-built live plan behind. */
function assertTest(obj, what) {
  if (obj.livemode === true) {
    console.error(`\n  ABORTED — Stripe returned a LIVE ${what} (${obj.id}).`);
    console.error('  This script is test-mode only. Check `stripe config --list`, then remove that object.\n');
    process.exit(1);
  }
  return obj;
}

const productArgs = plan => ['products', 'create', ...d([
  ['name', plan.product.name],
  ['description', plan.product.description],
  ...metaPairs(plan.tier),
])];

const priceArgs = (plan, productId) => ['prices', 'create', ...d([
  ['product', productId],
  ['unit_amount', plan.unit_amount],
  ['currency', shared.currency],
  ['recurring[interval]', shared.interval],
  ['nickname', plan.price_nickname],
  ...metaPairs(plan.tier),
])];

const linkArgs = (plan, priceId) => ['payment_links', 'create', ...d([
  ['line_items[0][price]', priceId],
  ['line_items[0][quantity]', 1],
  ['submit_type', pl.submit_type],
  ['phone_number_collection[enabled]', pl.phone_number_collection.enabled],
  ['billing_address_collection', pl.billing_address_collection],
  ['after_completion[type]', pl.after_completion.type],
  ['after_completion[redirect][url]', pl.after_completion.redirect.url],
  ['consent_collection[terms_of_service]', pl.consent_collection.terms_of_service],
  ['custom_text[terms_of_service_acceptance][message]', pl.custom_text.terms_of_service_acceptance.message],
  ['custom_text[submit][message]', plan.submit_message],
  ...metaPairs(plan.tier),
])];

if (!GO) {
  console.log('\nDRY RUN — nothing will be created. Re-run with --go to execute.\n');
  for (const plan of plans) {
    console.log(`${plan.label}  —  $${plan.price_usd}/mo   tier: ${plan.tier}`);
    console.log(`  product      ${plan.product.name}`);
    console.log(`  description  ${plan.product.description}`);
    console.log(`  price        ${plan.unit_amount} ${shared.currency} per ${shared.interval}`);
    console.log(`  submit line  ${plan.submit_message}`);
    console.log(`  redirect     ${pl.after_completion.redirect.url}`);
    console.log(`  phone        ${pl.phone_number_collection.enabled ? 'collected' : 'not collected'}`);
    console.log(`  terms        ${pl.consent_collection.terms_of_service}\n`);
  }
  console.log('Customer portal');
  console.log('  switch plans   enabled   (makes Step 1\'s "move up, move down" true)');
  console.log('  cancel         at period end');
  console.log('  applied to     the account\'s DEFAULT portal configuration\n');
  console.log('Test mode only. Prices are NOT approved — blocking decision #1.\n');
  process.exit(0);
}

try {
  execFileSync('stripe', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('\nStripe CLI not found.\n  brew install stripe/stripe-cli/stripe\n  stripe login\n');
  process.exit(1);
}

/* PREFLIGHT: REFUSE TO CREATE A SECOND SET.
 *
 * This script has no natural idempotency — every run creates fresh Products, Prices and Payment
 * Links. Run five times against a sandbox during testing and you get 15 of each, which is how this
 * check came to exist. In a throwaway sandbox that is only clutter; in the real account it is a
 * genuine hazard, because nothing in Stripe tells you which of five identical "Yourgi Plus — Walks"
 * products the live page actually links to.
 *
 * So: stop and show what is already there. Reusing them automatically would be worse — a matching
 * Product says nothing about whether its Price or its Payment Link are configured correctly, and
 * silently adopting someone else's objects is not a decision a script should make on its own.
 */
const existing = (run(['products', 'list', '--limit', '100']).data || [])
  .filter(p => p.metadata && p.metadata.campaign === shared.metadata.campaign);

if (existing.length && !process.argv.includes('--anyway')) {
  console.error(`\n  STOPPING — this account already has ${existing.length} Yourgi Plus product(s).\n`);
  const byTier = {};
  for (const p of existing) (byTier[p.metadata.tier || '?'] ||= []).push(p.id);
  for (const [tier, ids] of Object.entries(byTier)) {
    console.error(`    ${tier.padEnd(9)} ${ids.length} product(s): ${ids.join(', ')}`);
  }
  console.error(`
  Creating another set would leave duplicates that look identical in the Dashboard, with no way
  to tell which one the live page points at. Pick one:

    - Reuse what is there. Read the Payment Link URLs off the Dashboard and paste those into
      STRIPE_PAYMENT_LINKS. Nothing needs creating.
    - Clean up first. Archive the old products in the Dashboard, then re-run this.
    - You genuinely want another set (a fresh sandbox, a second experiment):
        node stripe/create-plans.mjs --go --anyway
`);
  process.exit(1);
}

console.log('\nCreating in Stripe TEST mode…\n');
const results = [];

for (const plan of plans) {
  process.stdout.write(`  ${plan.label.padEnd(12)} `);
  const product = assertTest(run(productArgs(plan)), 'product');
  const price   = assertTest(run(priceArgs(plan, product.id)), 'price');
  const link    = assertTest(run(linkArgs(plan, price.id)), 'payment link');
  console.log('ok');
  results.push({ tier: plan.tier, label: plan.label, product: product.id, price: price.id, link: link.id, url: link.url });
}

/* THE CUSTOMER PORTAL — this is what makes the page's promise true.
 *
 * Step 1 on the landing page says "Move up, move down, or cancel any month." Cancelling works out
 * of the box; SWITCHING PLANS DOES NOT. It's off by default, so without this the page promises
 * something a subscriber has no way to do.
 *
 * Only the DEFAULT configuration is used for portal sessions, so this updates the existing default
 * rather than adding a second config that would sit there doing nothing. On a fresh account there
 * is no default yet and the first one created becomes it.
 *
 * Stripe rejects subscription_update unless payment_method_update is also on — someone changing to
 * a dearer plan may need a working card on file, so it insists the two travel together.
 */
function configurePortal(created) {
  const list = run(['billing_portal', 'configurations', 'list', '--limit', '10']);
  const existing = (list.data || []).find(c => c.is_default);

  const features = [
    ['features[payment_method_update][enabled]', true],
    ['features[subscription_update][enabled]', true],
    ['features[subscription_update][default_allowed_updates][0]', 'price'],
    ['features[subscription_update][proration_behavior]', 'create_prorations'],
    ['features[subscription_cancel][enabled]', true],
    ['features[subscription_cancel][mode]', 'at_period_end'],
    /* The allowlist is REQUIRED whenever subscription_update is enabled, and it is what stops a
       subscriber switching onto some unrelated product that happens to live in the same account —
       which matters here, because Yourgi's real account already holds an old $50/mo membership
       test. Naming our three explicitly means the portal can only ever move someone between them.
       Note this API version accepts the field but does not echo it back, so don't be alarmed when
       a retrieve shows no `products` key — a missing one would fail the call, not pass it. */
    ...created.flatMap((r, i) => [
      [`features[subscription_update][products][${i}][product]`, r.product],
      [`features[subscription_update][products][${i}][prices][0]`, r.price],
    ]),
  ];

  const cfg = existing
    ? run(['billing_portal', 'configurations', 'update', existing.id, ...d(features)])
    : run(['billing_portal', 'configurations', 'create', ...d([
        ...features, ['business_profile[headline]', 'Manage your Yourgi Plus plan'],
      ])]);

  return assertTest(cfg, 'portal configuration');
}

process.stdout.write('  customer portal ');
const portal = configurePortal(results);
console.log(`ok  (${portal.id}${portal.is_default ? ', default' : ', NOT DEFAULT — check Stripe'})`);
console.log(`    switch plans: ${portal.features.subscription_update.enabled}  ·  cancel: ${portal.features.subscription_cancel.enabled} at period end`);

console.log('\nPaste into STRIPE_PAYMENT_LINKS in index.html:\n');
console.log('  var STRIPE_PAYMENT_LINKS = {');
for (const r of results) console.log(`    ${(r.tier + ':').padEnd(10)}'${r.url}',`);
console.log('  };\n');
console.log('Then: node test/prototype.test.mjs && cp index.html deploy/index.html\n');
console.table(results.map(({ label, product, price, link }) => ({ label, product, price, link })));
