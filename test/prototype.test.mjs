import { JSDOM } from 'jsdom';
import fs from 'fs';

const PAGE = '/Users/laurenpalma/Library/CloudStorage/OneDrive-DestinationPet/Subscription Landing Page/index.html';
const NAV_LINE = 'window.location.href=url;';
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? (pass++, console.log('  ok  ', name)) : (fail++, console.log('  FAIL', name, extra ?? '')); };

// Fresh page per scenario so state never leaks between tests.
async function boot({ search = '', links = null, webhook = null } = {}) {
  let html = fs.readFileSync(PAGE, 'utf8');
  // Strip the Mixpanel + Segment loader blocks; we install stubs instead so nothing real fires.
  html = html.replace(/<script type="text\/javascript">[\s\S]*?<\/script>/, `<script>
    window.__mp=[]; window.__nav=[]; window.trackEvent=function(n,p){window.__mp.push([n,p||{}]);};
  </script>`);
  html = html.replace(/<script>\s*!function\(\)\{var i="analytics"[\s\S]*?<\/script>/, `<script>
    window.__seg=[];
    window.sendToSegment=function(email,traits,ev,props){window.__seg.push({email,traits,ev,props});};
  </script>`);
  if (links) html = html.replace(/starter: '',   \/\/ TODO\n    plus:    '',   \/\/ TODO\n    premium: ''    \/\/ TODO/,
    `starter: '${links}s', plus: '${links}p', premium: '${links}m'`);
  if (webhook) html = html.replace("var TEAMS_WEBHOOK_URL = '';", `var TEAMS_WEBHOOK_URL = '${webhook}';`);
  // jsdom's location.href is unforgeable, so swap the redirect for a recorder.
  // The "redirect line intact" assertion below guards against this stub drifting from the source.
  if (!html.includes(NAV_LINE)) throw new Error('redirect line changed — update NAV_LINE in the harness');
  html = html.replace(NAV_LINE, 'window.__nav.push(url);');

  const dom = new JSDOM(html, {
    url: 'https://www.yourgi.com/join' + search,
    runScripts: 'dangerously', pretendToBeVisual: true,
    // Must exist before parse: the return-from-Stripe handler runs during load.
    beforeParse(w) { w.HTMLElement.prototype.scrollIntoView = () => {}; },
  });
  const w = dom.window;
  w.__fetches = [];
  w.fetch = (u, o) => { w.__fetches.push({ u, body: JSON.parse(o.body) }); return Promise.resolve({ ok: true }); };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  await new Promise(r => w.addEventListener('load', r));
  return w;
}

const $ = (w, id) => w.document.getElementById(id);
const vis = (w, id) => !$(w, id).classList.contains('hidden');
const fill = (w, { zip, phone, email }) => {
  for (const [id, val] of [['q-zip', zip], ['q-phone', phone], ['q-email', email]]) {
    const el = $(w, id);
    el.value = val;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
  }
};
const settle = () => new Promise(r => setTimeout(r, 30));

console.log('\n— initial render —');
{
  const w = await boot();
  ok('title is the membership page', w.document.title === 'Yourgi Membership | Yourgi');
  ok('three tiers rendered', w.document.querySelectorAll('#tiers .tier').length === 3);
  ok('Plus is the default selection', $(w, 'tiers').querySelector('[data-tier="plus"]').getAttribute('aria-pressed') === 'true');
  ok('exactly one tier is pressed', w.document.querySelectorAll('#tiers .tier[aria-pressed="true"]').length === 1);
  ok('benefits list rendered for default tier', w.document.querySelectorAll('#incl li').length === 4);
  ok('plan step visible, others hidden', vis(w, 'step-plan') && !vis(w, 'step-confirm') && !vis(w, 'step-oom') && !vis(w, 'step-cancel'));
  ok('pets starts at 1', $(w, 'pets-val').textContent === '1');
}

console.log('\n— tier switching —');
{
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="premium"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('premium becomes pressed', $(w, 'tiers').querySelector('[data-tier="premium"]').getAttribute('aria-pressed') === 'true');
  ok('plus is deselected', $(w, 'tiers').querySelector('[data-tier="plus"]').getAttribute('aria-pressed') === 'false');
  ok('benefits swapped to premium content', w.document.getElementById('incl').textContent.includes('dedicated Pro'));
  $(w, 'tiers').querySelector('[data-tier="starter"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('benefits swapped again to starter (3 items)', w.document.querySelectorAll('#incl li').length === 3);
  ok('no premium copy left behind', !w.document.getElementById('incl').textContent.includes('dedicated Pro'));
  ok('Plan Selected tracked', w.__mp.some(([n, p]) => n === 'Plan Selected' && p.plan_tier === 'premium' && p.plan_price === 179));
}

console.log('\n— pets stepper bounds —');
{
  const w = await boot();
  for (let i = 0; i < 12; i++) $(w, 'pplus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('caps at 8', $(w, 'pets-val').textContent === '8');
  for (let i = 0; i < 12; i++) $(w, 'pminus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('floors at 1', $(w, 'pets-val').textContent === '1');
}

console.log('\n— validation —');
{
  const w = await boot();
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('empty form blocks submit', vis(w, 'step-plan'));
  ok('all three errors shown', ['e-zip', 'e-qphone', 'e-email'].every(id => $(w, id).style.display === 'block'));
  ok('Validation Failed lists all 3 fields', w.__mp.some(([n, p]) => n === 'Validation Failed' && p.fields.length === 3));
  ok('nothing sent to Segment', w.__seg.length === 0);

  fill(w, { zip: '80202', phone: '3035550142', email: 'not-an-email' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('bad email still blocks', vis(w, 'step-plan') && $(w, 'e-email').style.display === 'block');

  fill(w, { zip: '80202', phone: '1234567890', email: 'a@b.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('phone starting with 1 area code rejected', vis(w, 'step-plan') && $(w, 'e-qphone').style.display === 'block');
}

console.log('\n— phone formatting + zip masking —');
{
  const w = await boot();
  const p = $(w, 'q-phone');
  p.value = '3035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('formats to (303) 555-0142', p.value === '(303) 555-0142', p.value);
  p.value = '13035550142'; p.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('strips leading country code 1', p.value === '(303) 555-0142', p.value);
  const z = $(w, 'q-zip');
  z.value = 'abc80202999'; z.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('zip strips letters and caps at 5', z.value === '80202', z.value);
}

console.log('\n— dry run (no Stripe links configured) —');
{
  const w = await boot();
  fill(w, { zip: '80202', phone: '3035550142', email: 'test@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('lands on confirmation', vis(w, 'step-confirm'));
  ok('confirmation says DRY RUN', $(w, 'confirm-body').textContent.includes('DRY RUN'));
  ok('no navigation to Stripe', w.__nav.length === 0);
  ok('no Teams post (webhook unset)', w.__fetches.length === 0);
  ok('Lead Captured sent to Segment', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.plan_tier === 'plus' && s.props.out_of_market === false));
  ok('Segment identify uses email', w.__seg[0].email === 'test@example.com');
  ok('Checkout Dry Run tracked, not Checkout Started', w.__mp.some(([n]) => n === 'Checkout Dry Run') && !w.__mp.some(([n]) => n === 'Checkout Started'));
  ok('button re-enabled after submit', !$(w, 'to-checkout').hasAttribute('disabled'));
}

console.log('\n— in-market with Stripe links configured —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  $(w, 'tiers').querySelector('[data-tier="starter"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '75201', phone: '2145550188', email: 'dallas@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('navigates to Stripe', w.__nav.length === 1, w.__nav);
  const url = w.__nav[0] || '';
  ok('uses the starter link', url.startsWith('https://buy.stripe.com/test_s'), url);
  ok('email prefilled', url.includes('prefilled_email=dallas%40example.com'), url);
  ok('client_reference_id carries the tier', /client_reference_id=yg_starter_75201_\d+/.test(url), url);
  ok('Checkout Started tracked', w.__mp.some(([n, p]) => n === 'Checkout Started' && p.plan_tier === 'starter'));
  ok('plan stashed in sessionStorage', JSON.parse(w.sessionStorage.getItem('yg_plan')).tier === 'starter');
}

console.log('\n— out of market —');
{
  const w = await boot({ links: 'https://buy.stripe.com/test_' });
  fill(w, { zip: '90210', phone: '3105550111', email: 'la@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('shows out-of-market step', vis(w, 'step-oom'));
  ok('NEVER navigates to Stripe', w.__nav.length === 0, w.__nav);
  ok('lead still captured with out_of_market flag', w.__seg.some(s => s.ev === 'Lead Captured' && s.props.out_of_market === true));
  ok('Out-of-Market Lead Captured tracked', w.__mp.some(([n]) => n === 'Out-of-Market Lead Captured'));
}

console.log('\n— market gate coverage —');
{
  const w = await boot();
  const cases = [['80202', true, 'Denver'], ['75201', true, 'Dallas'], ['76102', true, 'Fort Worth'],
                 ['77002', true, 'Houston'], ['02108', true, 'Boston'], ['97205', true, 'Portland'],
                 ['90210', false, 'Beverly Hills'], ['10001', false, 'NYC'], ['60601', false, 'Chicago']];
  for (const [zip, expected, name] of cases) {
    const w2 = await boot();
    fill(w2, { zip, phone: '3035550142', email: 'a@b.com' });
    $(w2, 'to-checkout').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
    await settle();
    ok(`${name} ${zip} -> ${expected ? 'in' : 'out of'} market`, vis(w2, expected ? 'step-confirm' : 'step-oom'));
  }
}

console.log('\n— Teams webhook payload —');
{
  const w = await boot({ webhook: 'https://example.test/hook' });
  fill(w, { zip: '80202', phone: '3035550142', email: 'hook@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('posts once to the webhook', w.__fetches.length === 1);
  const facts = w.__fetches[0]?.body.attachments[0].content.body.find(b => b.type === 'FactSet').facts;
  const get = t => facts.find(f => f.title === t)?.value;
  ok('card carries plan', get('Plan') === 'Plus ($99/mo)', get('Plan'));
  ok('card carries email', get('Email') === 'hook@example.com');
  ok('card carries formatted phone', get('Phone') === '(303) 555-0142', get('Phone'));
  ok('card carries zip', get('ZIP') === '80202');
}

console.log('\n— webhook failure surfaces an error —');
{
  const w = await boot({ webhook: 'https://example.test/hook' });
  w.fetch = () => Promise.resolve({ ok: false });
  fill(w, { zip: '80202', phone: '3035550142', email: 'fail@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  ok('stays on the plan step', vis(w, 'step-plan'));
  ok('no Segment lead on failure', w.__seg.length === 0);
  ok('Submission Failed tracked', w.__mp.some(([n, p]) => n === 'Submission Failed' && p.reason === 'response_not_ok'));
  ok('button re-enabled after failure', !$(w, 'to-checkout').hasAttribute('disabled'));
}

console.log('\n— return from Stripe —');
{
  const w = await boot({ search: '?checkout=success' });
  ok('success shows confirmation', vis(w, 'step-confirm'));
  ok('Subscription Started tracked as unverified', w.__mp.some(([n, p]) => n === 'Subscription Started' && p.verified === false));

  const w2 = await boot({ search: '?checkout=cancel' });
  ok('cancel shows the no-charge step', vis(w2, 'step-cancel'));
  ok('Checkout Abandoned tracked', w2.__mp.some(([n]) => n === 'Checkout Abandoned'));
  ok('cancel does NOT show confirmation', !vis(w2, 'step-confirm'));
}

console.log('\n— reset —');
{
  const w = await boot();
  $(w, 'tiers').querySelector('[data-tier="premium"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  $(w, 'pplus').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  fill(w, { zip: '80202', phone: '3035550142', email: 'reset@example.com' });
  $(w, 'to-checkout').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await settle();
  $(w, 'restart').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('back on the plan step', vis(w, 'step-plan'));
  ok('tier reset to Plus', $(w, 'tiers').querySelector('[data-tier="plus"]').getAttribute('aria-pressed') === 'true');
  ok('pets reset to 1', $(w, 'pets-val').textContent === '1');
  ok('fields cleared', ['q-zip', 'q-phone', 'q-email'].every(id => $(w, id).value === ''));
}

console.log('\n— no secrets in page source —');
{
  const src = fs.readFileSync(PAGE, 'utf8');
  ok('no Stripe secret key', !/sk_(live|test)_/.test(src));
  ok('no live Payment Link committed', !/buy\.stripe\.com/.test(src));
  ok('concierge webhook NOT reused', !src.includes('powerplatform.com'));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
