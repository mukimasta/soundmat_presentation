#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'slides', 'manifest.json');
const templatePath = join(root, 'index.template.html');

function read(path) {
  return readFileSync(path, 'utf8');
}

/** Inline slide partials: <!-- @include partials/foo.svg --> */
function expandIncludes(html) {
  return html.replace(/<!-- @include ([^\s]+) -->/g, (_, rel) => {
    const p = join(root, 'slides', rel);
    if (!existsSync(p)) throw new Error(`Missing slide partial: ${rel}`);
    return read(p).trim();
  });
}

const pad = n => String(n).padStart(2, '0');

function processSlideRoot(html, name, index, isFirst) {
  // Stable name-based class (strip leading "NN-" so reordering doesn't churn CSS)
  const stable = `s-${name.replace(/^\d+-/, '')}`;
  // Replace numeric id to match runtime position (still used by URL hash)
  html = html.replace(/id="slide-\d+"/, `id="slide-${index}"`);
  // Auto-number the top-right slide-index badge by position
  html = html.replace(/(<div class="slide-index">)[^<]*(<\/div>)/, `$1${pad(index)}$2`);
  // Patch the first class= attribute (the slide root)
  html = html.replace(/class="([^"]*)"/, (_, classes) => {
    let parts = classes
      .split(/\s+/)
      .filter(c => c && c !== 'active' && !c.startsWith('s-'));
    parts.push(stable);
    if (isFirst) parts.push('active');
    return `class="${parts.join(' ')}"`;
  });
  return html;
}

const manifest = JSON.parse(read(manifestPath));
const slidesHtml = manifest
  .map((name, i) => {
    let html = expandIncludes(read(join(root, 'slides', `${name}.html`)).trim());
    return processSlideRoot(html, name, i + 1, i === 0);
  })
  .join('\n\n');

const template = read(templatePath);
const built = template.replace('<!-- SLIDES -->', slidesHtml);

writeFileSync(join(root, 'index.html'), built);
writeFileSync(join(root, 'pre.html'), built);

mkdirSync(join(root, 'dist'), { recursive: true });
for (const dir of ['css', 'js']) {
  mkdirSync(join(root, 'dist', dir), { recursive: true });
}
writeFileSync(join(root, 'dist', 'index.html'), built);
for (const f of ['tokens.css', 'deck.css', 'components.css', 'layouts.css']) {
  writeFileSync(join(root, 'dist', 'css', f), read(join(root, 'css', f)));
}
writeFileSync(join(root, 'dist', 'js', 'deck.js'), read(join(root, 'js', 'deck.js')));

// Copy image assets so dist/ is a self-contained offline bundle
if (existsSync(join(root, 'soundmat'))) {
  cpSync(join(root, 'soundmat'), join(root, 'dist', 'soundmat'), { recursive: true });
}

writeFileSync(join(root, 'dist', '.nojekyll'), '');

console.log(`Built index.html + pre.html (${manifest.length} slides), dist/`);
