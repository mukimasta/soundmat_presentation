#!/usr/bin/env node
/**
 * One-time (or re-run) extractor: splits legacy pre.html into source files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = [process.argv[2], join(root, 'legacy-monolith.html'), join(root, 'pre.html.bak')]
  .filter(Boolean)
  .map((p) => (p.startsWith('/') ? p : join(root, p)))
  .find((p) => existsSync(p));

if (!legacyPath) {
  console.error('No monolith found. Pass path or add legacy-monolith.html / pre.html.bak');
  process.exit(1);
}
console.log('Extracting from', legacyPath);

const raw = readFileSync(legacyPath, 'utf8');
const style = raw.match(/<style>\n?([\s\S]*?)<\/style>/)?.[1]?.trim();
const script = raw.match(/<script>\n([\s\S]*?)<\/script>/)?.[1]?.trim();
const deckInner = raw.match(
  /<div class="deck" id="deck">\n\n([\s\S]*?)\n<\/div>\n\n<div class="slide-counter"/
)?.[1];

if (!style || !script || !deckInner) {
  console.error('Failed to parse pre.html');
  process.exit(1);
}

const layoutStart = style.indexOf('/* Slide-specific layouts */');
const baseCss = style.slice(0, layoutStart).trimEnd();
const layoutsCss = style.slice(layoutStart).trim();

const tokensEnd = baseCss.indexOf('\n\nhtml, body');
const tokensCss =
  '* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }\n\n' +
  baseCss.slice(0, tokensEnd).trim();

const deckStart = baseCss.indexOf('html, body');
const animStart = baseCss.indexOf('.slide.active .bento-card');
const deckCss = baseCss.slice(deckStart, animStart).trimEnd();
const animCss = baseCss.slice(animStart).trimEnd();

const componentsStart = baseCss.indexOf('.image-placeholder');
const componentsCss = baseCss.slice(componentsStart, animStart).trimEnd();

mkdirSync(join(root, 'css'), { recursive: true });
mkdirSync(join(root, 'js'), { recursive: true });
mkdirSync(join(root, 'slides'), { recursive: true });
mkdirSync(join(root, 'scripts'), { recursive: true });

writeFileSync(join(root, 'css', 'tokens.css'), tokensCss + '\n');
writeFileSync(join(root, 'css', 'deck.css'), deckCss + '\n\n' + animCss + '\n');
writeFileSync(join(root, 'css', 'components.css'), componentsCss + '\n');
writeFileSync(join(root, 'css', 'layouts.css'), layoutsCss + '\n');
writeFileSync(join(root, 'js', 'deck.js'), script + '\n');

const slideBlocks = [...deckInner.matchAll(/<!-- SLIDE[^]*?-->\n([\s\S]*?)(?=\n<!-- SLIDE|\n*$)/g)];
const names = [
  '01-title',
  '02-tagline',
  '03-idea-bento',
  '04-system-zoom',
  '05-sensor-bento',
  '06-electronics-bento',
  '07-firmware-bento',
  '08-python-sc-hero',
  '09-software-bento',
  '10-sonification-bento',
  '11-ambient-zoom',
  '12-lessons-bento',
  '13-live-demo',
  '14-closing',
];

if (slideBlocks.length !== names.length) {
  console.warn(`Expected ${names.length} slides, got ${slideBlocks.length}`);
}

const manifest = [];
slideBlocks.forEach((m, i) => {
  const name = names[i] || `slide-${i + 1}`;
  let html = m[1].trim();
  html = html.replace(/class="([^"]*)"/, (_, classes) => {
    const c = classes.replace(/\bactive\b/g, '').replace(/\s+/g, ' ').trim();
    return `class="${c}"`;
  });
  writeFileSync(join(root, 'slides', `${name}.html`), html + '\n');
  manifest.push(name);
});

writeFileSync(join(root, 'slides', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Extracted ${manifest.length} slides, CSS (4 files), deck.js`);
