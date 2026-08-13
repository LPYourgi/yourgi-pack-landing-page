#!/usr/bin/env node
/* Checks the Payment Links the PAGE actually points at against stripe/plans.json.
 *
 *   node stripe/verify-links.mjs
 *
 * WHY THIS EXISTS. test/prototype.test.mjs already asserts that stripe/plans.json and index.html
 * agree on every tier, price and label. That check is offline, and it compares two files in this
 * repo to each other — so both can agree perfectly while the actual Stripe object charges
 * something else entirely. That is not hypothetical: on 13 Aug 2026 the top plan moved from $399
 * to $499 in the manifest, the page and the tests together, all three stayed consistent, the suite
 * stayed green, and the live Payment Link went on charging $399. A buyer would have read $499 on
 * the card and $399 on Stripe's own checkout page.
 *
 * So this asserts the third leg of the triangle, which is the only one that moves money:
 *   plans.json  <-> index.html   test/prototype.test.mjs  (offline, runs in CI)
 *   plans.json  <-> Stripe       THIS SCRIPT             (needs network + Stripe auth)
 *
 * Deliberately NOT part of the unit suite. It needs the Stripe CLI authenticated against the right
 * account, which a contributor checking out this repo will not have, and a test that fails for
 * everyone but the author gets skipped and then deleted. Run it after any price change and before
 * anyone is sent to the page.
 *
 * Read-only: it retrieves, it never creates or updates.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'plans.json'), 'utf8'));
const pageSrc = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');

let failed = 0;
const ok = (pass, label, detail) => {
  console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${detail !== undefined && !pass ? `  → ${JSON.stringify(detail)}` : ''}`);
  if (!pass) failed++;
};

function run(args) {
  return JSON.parse(execFileSync('stripe', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}

/* The links as the PAGE has them, not as the manifest wishes they were. Parsed out of the source
   because that block is the single thing standing between a click and a charge. */
const block = pageSrc.match(/var STRIPE_PAYMENT_LINKS = \{([\s\S]*?)\n {2}\};/);
if (!block) {
  console.error('\n  Could not find STRIPE_PAYMENT_LINKS in index.html — the block shape changed.\n');
  process.exit(1);
}
const wired = Object.fromEntries(
  [...block[1].matchAll(/(\w+):\s*'([^']+)'/g)].map(m => [m[1], m[2]])
);

console.log('\nVerifying the links index.html actually points at, against stripe/plans.json\n');

const configured = Object.values(wired).filter(Boolean);
if (!configured.length) {
  console.log('  No links configured — the CTA is inert by design. Nothing to verify.\n');
  process.exit(0);
}

/* One retrieve per link. A Payment Link does not embed its amount, so each one's line item has to
   be expanded to reach the Price behind it — that Price is what the customer is actually charged,
   and it is the number this whole script exists to read. */
for (const plan of manifest.plans) {
  const url = wired[plan.tier];
  console.log(`${plan.label}  (${plan.tier})  — manifest says $${plan.price_usd}/mo`);

  if (!url) { ok(false, 'a link is wired for this tier', wired); continue; }

  const id = (run(['payment_links', 'list', '--limit', '100']).data || [])
    .find(l => l.url === url)?.id;
  if (!id) { ok(false, 'the wired URL exists in this Stripe account', url); continue; }

  const link = run(['payment_links', 'retrieve', id]);
  /* A Payment Link carries no amount of its own — the charge lives on the Price behind its line
     item, so that has to be fetched separately. Both fields are read and required to agree: they
     can diverge if a discount or an adjustable quantity is ever added to a link, and if that
     happens the buyer's total is not the Price and this script should stop rather than guess. */
  const items = run(['payment_links', 'list_line_items', id, '--limit', '10']).data || [];
  ok(items.length === 1, 'has exactly one line item', items.length);
  const unit = items[0]?.price?.unit_amount;
  const total = items[0]?.amount_total;
  ok(unit === total, 'line item total equals the unit price (no discount or quantity in play)',
    { unit, total });
  const amount = unit;

  /* THE ASSERTION THAT MATTERS. Everything else here is hygiene; this one is the charge. */
  ok(amount === plan.unit_amount, `charges $${plan.price_usd} (${plan.unit_amount})`,
    { stripe: amount, manifest: plan.unit_amount });

  ok(link.livemode === false, 'is TEST mode — a live link on a public branch takes real money',
    { livemode: link.livemode });
  ok(link.active === true, 'is active (an archived link 404s the CTA)', { active: link.active });
  ok(link.metadata?.tier === plan.tier, 'carries its own tier in metadata',
    { stripe: link.metadata?.tier, expected: plan.tier });

  /* The last line a buyer reads before committing. A stale amount here is a false statement at the
     exact moment money moves, so it is checked against the manifest string verbatim. */
  ok(link.custom_text?.submit?.message === plan.submit_message, 'submit line names this plan\'s price',
    { stripe: link.custom_text?.submit?.message, manifest: plan.submit_message });

  ok(link.phone_number_collection?.enabled === true, 'collects a phone number');
  ok(link.consent_collection?.terms_of_service === 'required', 'requires terms acceptance');
  ok(link.after_completion?.redirect?.url === manifest.shared.payment_link.after_completion.redirect.url,
    'redirects back to the page', { stripe: link.after_completion?.redirect?.url });
  console.log('');
}

/* No two plans may share a link. This shipped once: all three cards handed off to one $50/mo
   checkout, so two of the three charged a price the buyer never saw. */
ok(new Set(configured).size === configured.length, 'every plan has its OWN link', wired);

console.log(failed
  ? `\n${failed} check(s) FAILED — do not send anyone to this page until they pass.\n`
  : '\nAll checks passed. The page charges what it advertises.\n');
process.exit(failed ? 1 : 0);
