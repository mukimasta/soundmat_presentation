#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'slides', 'manifest.json');
const templatePath = join(root, 'index.template.html');

function read(path) {
  return readFileSync(path, 'utf8');
}

function stripActive(html) {
  return html.replace(/class="([^"]*)"/, (_, classes) => {
    const c = classes.replace(/\bactive\b/g, '').replace(/\s+/g, ' ').trim();
    return `class="${c}"`;
  });
}

function assignSlideIds(html, index) {
  return html.replace(/id="slide-\d+"/, `id="slide-${index}"`);
}

const manifest = JSON.parse(read(manifestPath));
const slidesHtml = manifest
  .map((name, i) => {
    let html = read(join(root, 'slides', `${name}.html`)).trim();
    html = stripActive(html);
    html = assignSlideIds(html, i + 1);
    if (i === 0) {
      html = html.replace(/class="([^"]*)"/, (_, classes) => {
        const c = classes.replace(/\bactive\b/g, '').replace(/\s+/g, ' ').trim();
        return `class="${c} active"`;
      });
    }
    return html;
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

console.log(`Built index.html + pre.html (${manifest.length} slides), dist/`);
