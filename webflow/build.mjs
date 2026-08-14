#!/usr/bin/env node
/* Extracts the paste-ready Webflow blocks from index.html.
   ============================================================================================
   WHY THIS IS A SCRIPT AND NOT A FOLDER OF FILES SOMEONE MAINTAINS.

   This repo has already paid for the alternative once. `deploy/index.html` was a hand-kept copy
   of the page, it drifted, and it was deleted on 12 Aug 2026 — three tests existed purely to
   assert the copy still matched, and a comment telling people to sync it survived the deletion by
   two days. A second hand-maintained copy of the same page, this time cut into four pieces for
   Webflow, would drift the same way and be harder to check.

   So: index.html stays the single source of truth, and everything under dist/ is generated and
   gitignored. If a Webflow block looks wrong, fix index.html and re-run this. Never edit dist/.

   WHAT IT DOES
     - pulls the <style> block, the main behaviour <script>, the two analytics blocks, and the
       comparison-table shell out of index.html
     - strips comments from the CSS and JS builds, because the annotated JS is 45,391 characters
       against Webflow's 50,000 limit — 91% of the budget, for a limit that has already moved once
       (it was 10,000 until 2025). The comments are the most valuable documentation in this project
       and they belong in git, not in a Webflow text field.
     - reports every block against the limit so a size problem is visible before someone pastes.

   Run:  node webflow/build.mjs
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'index.html');
const DIST = path.join(HERE, 'dist');

/* Webflow's per-field / per-embed ceiling. Sources disagree on whether it is per-field or an
   aggregate across the site: the announcement says "up to 50,000 characters of custom code across
   Site settings, Page settings, Code Embed elements and CMS Rich text fields", which reads as a
   total, while the Help Center says "Custom code in a Code Embed element cannot exceed 50,000
   characters" and advises splitting long code "into multiple Code Embed elements" — advice that
   only helps if the limit is per-element. Treated as per-field here, and every block is reported
   with its share of the total as well, so the plan holds either way. Paid site plans only. */
const LIMIT = 50000;

const src = fs.readFileSync(PAGE, 'utf8');

/* Comment stripping is deliberately conservative. It walks the source character by character
   tracking string and regex-literal context rather than running a regex over the whole file,
   because this page's own content contains sequences that look like comment delimiters — the
   Mixpanel loader carries `//cdn.mxpnl.com` inside a string, LIST_RATES comments discuss `/*`,
   and a naive strip silently corrupted the analytics loader the first time this was tried. */
function stripComments(code, { js }) {
  let out = '';
  let i = 0;
  const n = code.length;
  // Tracks whether a `/` can legally begin a regex literal here, which decides `/` vs division.
  let prevSignificant = '';
  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    // string literals — copied verbatim, escapes respected
    if (c === '"' || c === "'" || (js && c === '`')) {
      const quote = c;
      out += c; i++;
      while (i < n) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue; }
        out += code[i];
        if (code[i] === quote) { i++; break; }
        i++;
      }
      prevSignificant = quote;
      continue;
    }

    // regex literal — only where a regex may legally start, else it is division
    if (js && c === '/' && next !== '/' && next !== '*' && /^$|[(,=:[!&|?{};+\-*%~^<>]/.test(prevSignificant)) {
      out += c; i++;
      let inClass = false;
      while (i < n) {
        if (code[i] === '\\') { out += code[i] + (code[i + 1] ?? ''); i += 2; continue; }
        if (code[i] === '[') inClass = true;
        else if (code[i] === ']') inClass = false;
        out += code[i];
        if (code[i] === '/' && !inClass) { i++; break; }
        i++;
      }
      while (i < n && /[a-z]/.test(code[i])) { out += code[i]; i++; }   // flags
      prevSignificant = '/';
      continue;
    }

    // block comment
    if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }

    // line comment (JS only — CSS has none, and `//` appears inside CSS urls)
    if (js && c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }

    out += c;
    if (!/\s/.test(c)) prevSignificant = c;
    i++;
  }
  // collapse the blank lines the comments left behind, keep single blank lines for readability
  return out.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
}

function must(re, label) {
  const m = src.match(re);
  if (!m) {
    console.error(`\n  ERROR: could not find ${label} in index.html.`);
    console.error('  The page structure changed. Fix the pattern in webflow/build.mjs — do not');
    console.error('  hand-write the output file, or dist/ stops tracking the page.\n');
    process.exit(1);
  }
  return m;
}

/* ---- extract ------------------------------------------------------------------------------ */

const cssRaw = must(/<style>\n?([\s\S]*?)<\/style>/, 'the <style> block')[1];
const fontLink = must(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/, 'the Archivo font link')[0];
const mixpanel = must(/<script type="text\/javascript">\n?([\s\S]*?)<\/script>/, 'the Mixpanel block')[1];

const allPlainScripts = [...src.matchAll(/<script>\n?([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (allPlainScripts.length < 2) {
  console.error('\n  ERROR: expected at least two <script> blocks (Segment, behaviours).\n');
  process.exit(1);
}
const segment = allPlainScripts[0];
const behaviour = allPlainScripts[allPlainScripts.length - 1];

const compareShell = must(/(<div class="compare-card">[\s\S]*?<\/table>\s*<\/div>\s*<\/div>)/, 'the comparison-table shell')[1];

/* ---- build -------------------------------------------------------------------------------- */

const css = stripComments(cssRaw, { js: false });
const js = stripComments(behaviour, { js: true });

const HEAD = `<!-- YOURGI PLUS — page <head> custom code.
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: Page settings > Custom code > Inside <head> tag.

     The @font-face rules below are only needed if National 2 is NOT already uploaded under
     Site settings > Fonts. Check first — these files are served off this site's own Webflow CDN,
     which means they may already be there as custom fonts, in which case Designer can apply them
     natively and you should delete the @font-face block to avoid a second copy of the same face.
     See webflow/assets.md. -->
${fontLink}
<style>
${css}
</style>`;

const FOOTER = `<!-- YOURGI PLUS — page footer custom code (before </body>).
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: Page settings > Custom code > Before </body> tag.

     ORDER MATTERS. The analytics block must run before the behaviour block: trackEvent() and
     sendToSegment() are defined there and called throughout the behaviours. Both are in this one
     field, in the right order, so keep them together.

     MIXPANEL IS A FALLBACK HERE, NOT THE INSTANCE. index.html's own comment records that this page
     expects the site-wide Mixpanel already initialised in Webflow's SITE footer custom code, with
     the same project token, so cross-page UTM and referrer attribution survives. The loader below
     only fires when no site-wide instance exists (a local file, the GitHub Pages review link). On
     Webflow it should no-op — verify that it does rather than assuming, because two initialised
     instances double-count every event on the one page whose output is a signup count.

     YG_IS_PROD gates on a yourgi.com host, so a webflow.io staging domain tags every event
     test_mode:true and suppresses Segment identify() entirely. That is correct and deliberate —
     see the comments in index.html. It also means you will see NO Segment traffic while testing on
     staging; check the browser console for the '[preview] Segment suppressed' line instead. -->
<script type="text/javascript">
${stripComments(mixpanel, { js: true })}
</script>
<script>
${stripComments(segment, { js: true })}
</script>
<script>
${js}
</script>`;

const EMBED_COMPARE = `<!-- YOURGI PLUS — comparison table.
     GENERATED by node webflow/build.mjs from index.html. Do not edit; edit the page and re-run.

     Webflow: this must be an Embed element. Webflow Designer has no table element, so the whole
     table is markup — there is no Designer-native version of this section to build.

     <tbody id="cmp-body"> is left EMPTY on purpose: the footer behaviour script fills it from
     PLAN_UNITS, which is the same config the plan tiles read. That is why the tiles and the table
     can never disagree about a price. Do not type rows in here.

     Drop this inside a container capped at 820px to match the page. -->
${compareShell}`;

/* ---- write and report --------------------------------------------------------------------- */

fs.mkdirSync(DIST, { recursive: true });
const files = [
  ['head-code.html', HEAD, 'Page settings > Inside <head> tag'],
  ['footer-code.js', FOOTER, 'Page settings > Before </body> tag'],
  ['embed-compare-table.html', EMBED_COMPARE, 'Embed element, in the Compare section'],
];
for (const [name, body] of files) fs.writeFileSync(path.join(DIST, name), body + '\n');

console.log('\n  Generated webflow/dist/ from index.html\n');
const pad = (s, n) => String(s).padEnd(n);
console.log(`  ${pad('FILE', 28)}${pad('CHARS', 10)}${pad('OF 50k', 9)}WHERE IT GOES`);
console.log('  ' + '-'.repeat(96));
let total = 0;
for (const [name, body, where] of files) {
  total += body.length;
  const pct = Math.round((body.length / LIMIT) * 100);
  const flag = body.length > LIMIT ? '  ** OVER LIMIT **' : '';
  console.log(`  ${pad(name, 28)}${pad(body.length.toLocaleString(), 10)}${pad(pct + '%', 9)}${where}${flag}`);
}
console.log('  ' + '-'.repeat(96));
console.log(`  ${pad('TOTAL', 28)}${pad(total.toLocaleString(), 10)}${pad(Math.round((total / LIMIT) * 100) + '%', 9)}(if the 50k limit is an aggregate, this is the number that matters)`);

const savedJs = behaviour.length - js.length;
const savedCss = cssRaw.length - css.length;
console.log(`\n  Comments stripped: ${savedCss.toLocaleString()} chars of CSS, ${savedJs.toLocaleString()} of JS.`);
console.log(`  The annotated JS is ${behaviour.length.toLocaleString()} chars — ${Math.round((behaviour.length / LIMIT) * 100)}% of the limit on its own,`);
console.log('  which is why it is stripped here and kept in git. Read the reasoning in index.html.');

if (total > LIMIT) {
  console.log('\n  If the limit turns out to be an aggregate, split the behaviour script into a');
  console.log('  self-hosted file and reference it with <script src>. See webflow/README.md.');
}
console.log('');
