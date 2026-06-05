# SoundMat Presentation

Apple Keynote–style deck for UW ECE 546C final presentation (~10 min, 22 slides). Chinese speaker notes live in `notes/zh/`.

## Structure

```
presentation/
├── index.template.html   # Shell (head, deck container, script tag)
├── index.html            # Built — open this (or pre.html)
├── pre.html              # Same as index.html (backward compatible name)
├── css/
│   ├── tokens.css        # :root variables
│   ├── deck.css          # Slides, hero/zoom, animations, chrome
│   ├── components.css    # Bento cards, compare, protocol, placeholders
│   └── layouts.css       # Per-slide grid (#slide-3 … #slide-12)
├── slides/
│   ├── manifest.json     # Slide order
│   └── *.html            # One <section> per file
├── js/deck.js            # Navigation, hash, countup, SVG helpers
├── scripts/
│   ├── build.mjs         # Assemble index.html + pre.html + dist/
│   └── extract.mjs       # Re-split from legacy-monolith.html
└── dist/                 # Portable copy for USB / offline
```

## Workflow

**Edit a slide** → change `slides/NN-name.html` → run:

```bash
npm run build
```

**Reorder or add slides** → edit `slides/manifest.json` and matching `layouts.css` if needed → `npm run build`.

**Open locally**

- Double-click `index.html` (needs `css/` and `js/` beside it), or
- `npx serve .` and open `http://localhost:3000`

**Offline bundle** — use everything under `dist/`.

## GitHub Pages

This repo can be published as a static site. After pushing to `main`:

1. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. The workflow `.github/workflows/deploy-pages.yml` runs `npm run build` and deploys `dist/`.

Public URL (project site):

**https://mukimasta.github.io/soundmat_presentation/**

Notes:

- CSS/JS/media use relative paths — no extra base URL config.
- The bundle is ~90 MB (includes a `.mov` demo); within GitHub file limits, but first load may be slow on mobile.
- PDF export (`npm run pdf`) is local-only; it is not deployed to Pages.

## Recover monolith

`legacy-monolith.html` is the original single-file version. To re-extract sources:

```bash
npm run extract
npm run build
```

## Images

Replace `image-placeholder` blocks in slide HTML with `<img src="assets/images/…">` when photos are ready.
