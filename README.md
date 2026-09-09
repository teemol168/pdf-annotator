# PDF Annotator

A free, privacy-first **PDF annotation tool that runs entirely in your browser**.
Draw, write, highlight, and mark up any PDF — then export a new annotated PDF.
**No upload, no registration, no installation.**

> Your files never leave your device. Everything is processed locally in the browser.

---

## ✨ Features

- ✏️ **Freehand drawing** (pen) and **wavy underlines**
- ➖ **Straight lines** and **arrows** with adjustable thickness
- ▭ **Rectangle selection** boxes
- 🖍️ **Highlight** (freehand) and **text highlight** (select existing text)
- 🔤 **Text annotations** with customizable font, size, and color
  - Supports Chinese & English fonts: Microsoft YaHei, SimSun, KaiTi, SimHei, Arial, Times New Roman
- 🎯 **Select / move / edit / restyle** any annotation
- ↩️ **Undo / redo**
- ⬇️ **Export** the annotated document as a brand-new PDF (via pdf-lib)
- 🌐 **Bilingual UI** — Chinese / English, auto-detected by browser language
- 🔒 **100% client-side** — nothing is uploaded to any server

## 🎯 Use cases

Contract review · paper / thesis annotation · drawing & blueprint markup ·
legal document annotation · teaching slides · design review · quick notes.

---

## 🚀 Live demo

| Region | URL |
|--------|-----|
| 🌏 Overseas (fast) | https://pdfmark.miyucaicai.cn/ |
| 🇨🇳 China (fast) | https://pdf.miyucaicai.cn/ |

Open the link, drop in a PDF, annotate, and export. That's it.

---

## 🧰 Tech stack

- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering
- [pdf-lib](https://pdf-lib.js.org/) — PDF export
- HTML5 Canvas — annotation layer
- Vanilla JS — no framework, no build step

---

## 🔒 Privacy

This tool processes PDFs **entirely in your browser**. Files are never uploaded,
sent to a server, or stored. You can even use it fully offline after the first load.
We have no account system and collect no personal data.

---

## 🛠️ Run locally

No build step required — it's static files.

```bash
# option A: any static server
npx serve .

# option B: Python
python -m http.server 8080
```

Then open `http://localhost:8080/`.

> Note: `server.js` is only a tiny helper for local testing; the app itself is fully static.

---

## ☁️ Deploy (Vercel)

The repo is a pure static site.

1. Import the repo into [Vercel](https://vercel.com).
2. Framework Preset → **Other** (clear the Install Command, otherwise Vercel
   mis-detects `server.js` as a Node app).
3. Deploy. Done.

Two domains share one codebase:
- `pdf.miyucaicai.cn` (domestic) and `pdfmark.miyucaicai.cn` (overseas).
- SEO tags (`canonical` / `hreflang`) are set dynamically per hostname at runtime.

---

## 📁 Project structure

```
.
├── index.html        # PDF annotator page
├── home.html         # portfolio landing page (links to the tool)
├── css/              # styles
├── js/
│   ├── app.js        # UI / toolbar wiring
│   ├── annotator.js  # canvas annotation engine
│   └── i18n.js       # bilingual strings + dynamic SEO tags
├── sitemap.xml
└── robots.txt
```

---

## 📄 License

Free to use. (Add your preferred license here.)
