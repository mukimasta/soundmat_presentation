#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'slides', 'manifest.json'), 'utf8'));
const outPath = join(root, 'slides.txt');

function read(path) {
  return readFileSync(path, 'utf8');
}

function expandIncludes(html) {
  return html.replace(/<!-- @include ([^\s]+) -->/g, (_, rel) => {
    const p = join(root, 'slides', rel);
    if (!existsSync(p)) throw new Error(`Missing slide partial: ${rel}`);
    return read(p).trim();
  });
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&middot;/g, '·')
    .replace(/&nbsp;/g, ' ');
}

function inlineText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  );
}

function parseJsonAttr(html, name) {
  const m = html.match(new RegExp(`${name}='([^']*)'`));
  if (!m) return null;
  try {
    return JSON.parse(m[1].replace(/&amp;/g, '&'));
  } catch {
    return null;
  }
}

function extractBlock(html, className) {
  const re = new RegExp(`<([a-z][a-z0-9]*)[^>]*class="${className}"[^>]*>([\\s\\S]*?)<\\/\\1>`, 'i');
  const m = html.match(re);
  return m ? inlineText(m[2]) : '';
}

function extractAlt(html) {
  const m = html.match(/<img[^>]*alt="([^"]+)"/i);
  return m ? decodeEntities(m[1]) : '';
}

function extractVideoLabel(html) {
  const m = html.match(/<video[^>]*aria-label="([^"]+)"/i);
  return m ? decodeEntities(m[1]) : '';
}

function extractSlide(name, index) {
  const raw = expandIncludes(read(join(root, 'slides', `${name}.html`)).trim());
  const lines = [];
  const pad = String(index).padStart(2, '0');

  lines.push(`${pad} · ${name}`);
  lines.push('─'.repeat(40));

  const eyebrow =
    extractBlock(raw, 'hero-eyebrow') ||
    extractBlock(raw, 'slide-eyebrow') ||
    extractBlock(raw, 'zoom-eyebrow');
  const title =
    extractBlock(raw, 'hero-title') ||
    extractBlock(raw, 'slide-title') ||
    extractBlock(raw, 'zoom-title');
  const subtitle = extractBlock(raw, 'hero-subtitle') || extractBlock(raw, 'slide-subtitle');
  const meta = extractBlock(raw, 'hero-meta');
  const zoomCaption = extractBlock(raw, 'zoom-caption');
  const cinematic1 = extractBlock(raw, 'cinematic-line cinematic-line-1');
  const cinematic2 = extractBlock(raw, 'cinematic-line cinematic-line-2');

  if (eyebrow) lines.push(eyebrow);
  if (title) lines.push(title);
  if (subtitle) lines.push(subtitle);
  if (meta) lines.push(meta);
  if (zoomCaption) lines.push(zoomCaption);
  if (cinematic1) lines.push(cinematic1);
  if (cinematic2) lines.push(cinematic2);

  const stepTitles = parseJsonAttr(raw, 'data-step-titles');
  const stepSubs = parseJsonAttr(raw, 'data-step-subs');
  if (stepTitles?.length) {
    lines.push('');
    stepTitles.forEach((t, i) => {
      lines.push(`  ${i + 1}. ${t}`);
      const sub = stepSubs?.[i];
      if (sub) lines.push(`     ${sub}`);
    });
  }

  const alt = extractAlt(raw);
  const video = extractVideoLabel(raw);
  if (alt && !lines.some(l => l.includes(alt))) lines.push(alt);
  if (video && !lines.some(l => l.includes(video))) lines.push(`[${video}]`);

  const ackItems = [...raw.matchAll(/<p class="ack-label">([\s\S]*?)<\/p>\s*<p class="ack-name">([\s\S]*?)<\/p>(?:\s*<p class="ack-note">([\s\S]*?)<\/p>)?/g)];
  if (ackItems.length) {
    lines.push('');
    ackItems.forEach(([, label, person, note]) => {
      lines.push(`${inlineText(label)}: ${inlineText(person)}`);
      if (note) lines.push(`  ${inlineText(note)}`);
    });
  }

  const closingUrl = raw.match(/class="closing-web-url"[^>]*>([^<]+)</);
  if (closingUrl) lines.push(closingUrl[1]);

  return lines.filter(Boolean).join('\n');
}

const output = manifest.map((name, i) => extractSlide(name, i + 1)).join('\n\n');
writeFileSync(outPath, output + '\n', 'utf8');
console.log(`Wrote ${outPath} (${manifest.length} slides)`);
