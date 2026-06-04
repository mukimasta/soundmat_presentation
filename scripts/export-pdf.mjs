#!/usr/bin/env node
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'soundmat-deck.pdf');
const port = 4173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const rel = urlPath === '/' ? '/index.html' : urlPath;
      const file = join(root, rel.replace(/^\//, ''));
      if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const type = MIME[extname(file)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      res.end(readFileSync(file));
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

const prepareScript = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'pdf-prepare.js'), 'utf8');

async function prepareVideos(page) {
  await page.evaluate(async () => {
    const videos = Array.from(document.querySelectorAll('video.deck-video'));
    await Promise.all(videos.map(async (video) => {
      video.muted = true;
      video.loop = false;
      try {
        video.currentTime = 0;
        await video.play();
        await new Promise(r => setTimeout(r, 400));
        video.pause();
      } catch {
        /* static PDF fallback */
      }
    }));
  });
}

async function waitForAssets(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  });
  await page.waitForTimeout(300);
}

async function main() {
  if (!existsSync(join(root, 'index.html'))) {
    throw new Error('index.html not found — run npm run build first');
  }

  const server = await startServer();
  let browser;

  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
    });

    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
    await waitForAssets(page);
    await prepareVideos(page);
    await page.evaluate(prepareScript);
    await waitForAssets(page);

    const pageCount = await page.locator('.slide.pdf-page').count();
    await page.pdf({
      path: outPath,
      width: '1920px',
      height: '1080px',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true,
    });

    console.log(`Wrote ${outPath} (${pageCount} pages)`);
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
