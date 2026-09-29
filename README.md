# FileForge — All-in-One Online File Tools

> **"Compress, Convert & Transform Your Files"**  
> Modern, 100% client-side web application for processing videos, images, PDFs, and documents locally in your browser with zero server uploads.

---

## 🌟 Highlights

- **100% Client-Side / Browser-Based**: No backend server, no Python/Node.js server, no database, and no cloud storage. Files never leave your computer or device.
- **Privacy-First**: Zero server uploads. Operations are powered by HTML5 Canvas, Web Audio API, MediaRecorder, WebAssembly, and client-side JavaScript libraries.
- **Modern SaaS Dark UI**: Cosmic obsidian theme (`#07080e`), glassmorphism cards, glowing ambient accents, smooth transitions, and high responsiveness.
- **Fully Responsive**: Optimized for desktop (4 tool cards/row), tablet (2 cards/row), and mobile phones (1 card/row with collapsible navigation).
- **Zero Fake Conversions**: Real transcoding and processing for supported formats; transparent, honest notices for proprietary server-dependent formats.

---

## 🚀 How to Run Locally

Because FileForge is built strictly using **HTML5, CSS3, and Vanilla JavaScript**, it requires no complex toolchains or installation steps.

### Option 1: Direct Browser Launch
Simply double-click `index.html` or open it directly in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Apple Safari):
```bash
# Windows
start index.html
```

### Option 2: Local Static Web Server (Recommended)
Running through a lightweight local static server avoids any browser `file://` security restrictions on certain Web APIs:

```bash
# Using Python 3 built-in server
python -m http.server 8080

# Or using Node npx http-server / serve
npx serve .

# Or using PHP built-in server
php -S localhost:8080
```
Then visit `http://localhost:8080` in your browser.

---

## 🛠️ How It Works (Client-Side Architecture)

Every tool in FileForge executes locally in the user's browser using modern browser APIs and vetted CDN libraries:

1. **Video Transcoding & Compression (`tools/video-compressor.js`)**:
   - Uses an off-screen HTML5 `<canvas>` coupled with `canvas.captureStream(fps)`.
   - Captures original audio tracks via Web Audio API (`AudioContext.createMediaElementSource`).
   - Scales frames down to selected resolutions (1080p, 720p, 480p, 360p) with high-quality smoothing.
   - Encodes streams using `MediaRecorder` with configurable bitrates (`videoBitsPerSecond`) and exports optimized MP4 or WebM files with live percentage progress.

2. **Batch Image Compression & Conversion (`tools/image-compressor.js` & `tools/image-tools.js`)**:
   - Uses the Canvas 2D API (`drawImage`, `toBlob`).
   - Supports adjustable quality (1% to 100%), custom dimensions, aspect ratio locking, and format conversion (JPG, PNG, WebP, BMP).
   - Bundles multi-file batch downloads into a single `.zip` archive using `JSZip`.

3. **PDF Manipulation & Assembly (`tools/pdf-tools.js`)**:
   - **Merge PDF**: Reads array buffers and combines pages via `pdf-lib` (`PDFDocument.create()` + `copyPages()`).
   - **Split PDF**: Extracts custom page ranges (e.g., `1-3, 5, 8-10`) into new PDF files.
   - **Rotate PDF**: Adjusts orientation angles (+90°, +180°, +270°) permanently in page metadata.
   - **PDF to JPG**: Renders PDF pages to high-resolution canvases at 150/200/720 DPI via `PDF.js` and provides single or batch ZIP download.
   - **PDF to Text**: Extracts plain text streams across all pages using `PDF.js` text content extractors.
   - **Images to PDF**: Embeds JPG and PNG images onto custom or standard A4/Letter pages using `pdf-lib`.

4. **Document Processing (`tools/document-tools.js`)**:
   - **Excel to PDF / HTML**: Parses `.xlsx`, `.xls`, and `.csv` files locally via `SheetJS (XLSX)`, generates styled tables, and exports to printable vector PDF.
   - **Word to PDF / Preview**: Extracts semantic HTML from Microsoft Word `.docx` documents using `Mammoth.js`.

5. **Utilities Suite (`tools/other-tools.js`)**:
   - **QR Code Generator**: Generates custom QR codes with color themes using `QRCode.js`.
   - **QR Code Scanner**: Decodes QR matrices from camera feeds or image uploads using `jsQR`.
   - **Text to PDF**: Generates multi-page formatted PDF documents using `pdf-lib`.
   - **File Inspector**: Calculates cryptographic **SHA-256** checksums via Web Crypto (`crypto.subtle.digest`) and provides hex dumps.
   - **ZIP Creator**: Bundles multiple files of any type client-side with `JSZip`.

---

## 📊 Status of All Tools

| Category | Tool | In-Browser Engine | Status |
| :--- | :--- | :--- | :--- |
| **Video** | Video Compressor | Canvas + Web Audio + MediaRecorder | ✅ Fully Functional |
| **Video** | Video Resizer | Canvas Resolution Scaler | ✅ Fully Functional |
| **Video** | Video Converter | MediaRecorder Transcoder | ✅ Fully Functional |
| **Video** | Video to MP3 | Web Audio Track Extractor | ✅ Fully Functional |
| **Video** | Video to GIF | Canvas Frame Capture | ✅ Fully Functional |
| **Image** | Image Compressor | Canvas toBlob with Quality Slider | ✅ Fully Functional |
| **Image** | Image Resizer | Canvas Presets & Dimensions | ✅ Fully Functional |
| **Image** | Image Converter | JPG / PNG / WebP / BMP Canvas | ✅ Fully Functional |
| **Image** | Image to PDF | pdf-lib Embeddings | ✅ Fully Functional |
| **Image** | Image Cropper | Interactive Canvas Overlay | ✅ Fully Functional |
| **PDF** | Merge PDF | pdf-lib Page Copy Engine | ✅ Fully Functional |
| **PDF** | Split PDF | pdf-lib Range Extractor | ✅ Fully Functional |
| **PDF** | Rotate PDF | pdf-lib Degree Mutator | ✅ Fully Functional |
| **PDF** | PDF to JPG | PDF.js + Canvas Rasterizer | ✅ Fully Functional |
| **PDF** | PDF to Text | PDF.js TextContent Extractor | ✅ Fully Functional |
| **PDF** | PDF Compressor | pdf-lib Stream Optimizer | ✅ Fully Functional |
| **PDF** | PDF to Word | Complex typography notice + Text extract | ℹ️ Notice & Alternative |
| **PDF** | PDF to Excel | PDF.js + SheetJS Matrix Extractor | ✅ Fully Functional (Extracts tables to .xlsx) |
| **Document** | Excel to PDF | SheetJS + pdf-lib + Calibrated Alignment | ✅ Fully Functional (Auto-aligns columns, Landscape) |
| **Document** | Word to PDF | Mammoth.js HTML + Vector Print | ✅ Fully Functional |
| **Document** | PowerPoint to PDF | Requires server-side LibreOffice | ℹ️ Transparent Notice |
| **Utilities** | QR Code Generator | QRCode.js | ✅ Fully Functional |
| **Utilities** | QR Code Scanner | jsQR Canvas Matrix Decoder | ✅ Fully Functional |
| **Utilities** | Text to PDF | pdf-lib Multi-page Generator | ✅ Fully Functional |
| **Utilities** | Text to Word | Blob DOC Formatter | ✅ Fully Functional |
| **Utilities** | File Inspector | Web Crypto SHA-256 + Hex Dump | ✅ Fully Functional |
| **Utilities** | File Size Calculator | Bitrate & Network Math Engine | ✅ Fully Functional |
| **Utilities** | ZIP Creator | JSZip Multi-file Archiver | ✅ Fully Functional |

---

## ⚠️ Browser Limitations & Transparency

FileForge operates strictly under a **Zero-Cloud Privacy Policy**. In accordance with this principle:
1. **No Fake Conversions**: We do not rename `.pdf` files to `.docx` or pretend unsupported conversions are working.
2. **Proprietary Documents**: PPTX rendering and complex Word typography layout engines require headless desktop software (e.g., Microsoft Office Automation or LibreOffice daemon) which cannot execute purely in browser JavaScript without exposing user data to third-party servers.
3. **Large Video Memory**: Transcoding 4K videos longer than 30 minutes in browser memory depends on device RAM. Progress indicators, cancel options, and automatic memory cleanup with `URL.revokeObjectURL()` are implemented to protect browser stability.

---

## 🧩 How to Add a New Tool

FileForge is architected to make adding new tools effortless in 3 simple steps:

### Step 1: Register Tool in `script.js`
Add an entry to the `TOOLS` array in `script.js`:
```javascript
{
  id: 'my-new-tool',
  name: 'My New Tool',
  category: 'other', // 'video' | 'image' | 'pdf' | 'document' | 'other'
  description: 'Short description of what the tool accomplishes.',
  formats: ['PNG', 'JPG'],
  isPopular: false,
  isReady: true,
  module: 'OtherTools', // Target module
  subtool: 'my-new-subtool'
}
```

### Step 2: Implement Tool Handler
Inside the corresponding module (or create a new file in `tools/`):
```javascript
function renderInterface(container) {
  if (activeSubtool === 'my-new-subtool') {
    // Render controls & dropzone
  }
}
```

### Step 3: Test and Deploy
Reload `index.html`. The tool will automatically appear in search, category filters, and hash navigation (`#tool/my-new-tool`).

---

## 🌐 How to Deploy as a Static Website

Because FileForge contains no backend, you can deploy it to any static web hosting platform for free:

### 1. GitHub Pages
1. Push the repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment**, set Source to **Deploy from a branch** and select `main` / `root`.
4. Your site will be live at `https://<username>.github.io/<repo>/`!

### 2. Netlify
1. Drag and drop the `file-editors` folder into the Netlify Drop dashboard at [app.netlify.com/drop](https://app.netlify.com/drop).
2. Or connect your Git repository; leave the build command blank and publish directory as `.`.

### 3. Vercel
```bash
npx vercel deploy --prod
```

### 4. Cloudflare Pages
1. In Cloudflare Pages, connect your GitHub repository.
2. Set Build command to empty and Output directory to `.`.

---

## 📁 File Structure

```
FileForge/
├── index.html                    # Main HTML application page
├── style.css                     # Dark modern SaaS CSS design system
├── script.js                     # Tool registry, search, routing & hero dropzone
├── tools/
│   ├── video-compressor.js       # Video compression, resolution & bitrate scaling
│   ├── image-compressor.js       # Multi-image compressor with ZIP downloads
│   ├── image-tools.js            # Image resizer, converter, cropper, image-to-pdf
│   ├── pdf-tools.js              # PDF merge, split, rotate, pdf-to-jpg, pdf-to-text
│   ├── document-tools.js         # Excel (SheetJS) and Word (Mammoth) processing
│   └── other-tools.js            # QR code, text-to-pdf, file inspector, zip creator
├── assets/
│   ├── logo.svg                  # Brand vector logo
│   └── icons/                    # Category SVG icons
└── README.md                     # Documentation & deployment guide
```

---

## 📜 License
MIT License. &copy; 2026 FileForge.
Processed 100% locally in your browser.
