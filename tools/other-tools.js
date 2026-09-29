/**
 * FileForge - Other Tools Suite
 * QR Code Generator, QR Scanner (via jsQR), Text to PDF (via pdf-lib),
 * Text to Word, File Information & SHA-256 Inspector, File Size Calculator, and ZIP Creator (via JSZip).
 */

window.FileForge = window.FileForge || {};
window.FileForge.OtherTools = (function () {
  let activeSubtool = 'qr-generator';
  let qrInstance = null;
  let videoStream = null;
  let zipFiles = [];
  let resultBlob = null;
  let resultUrl = null;

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function cleanup() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
    resultBlob = null;
    zipFiles = [];
    if (videoStream) {
      videoStream.getTracks().forEach((t) => t.stop());
      videoStream = null;
    }
  }

  function init(containerEl, file = null, subtool = 'qr-generator') {
    cleanup();
    activeSubtool = subtool;
    renderInterface(containerEl);
    if (file) {
      handleIncomingFile(file, containerEl);
    }
  }

  function handleIncomingFile(file, container) {
    if (activeSubtool === 'file-info') {
      inspectFile(file, container);
    } else if (activeSubtool === 'zip-creator') {
      const arr = Array.isArray(file) ? file : [file];
      addZipFiles(arr, container);
    } else if (activeSubtool === 'qr-scanner') {
      scanQrFromImage(file, container);
    }
  }

  function renderInterface(container) {
    let title = 'Miscellaneous Tool';
    let desc = 'Client-side file utility.';

    if (activeSubtool === 'qr-generator') {
      title = 'QR Code Generator';
      desc = 'Generate custom QR codes instantly with colors, logo options, and high-resolution export.';
    } else if (activeSubtool === 'qr-scanner') {
      title = 'QR Code Scanner';
      desc = 'Scan QR codes from image files or directly from your webcam.';
    } else if (activeSubtool === 'text-to-pdf') {
      title = 'Text to PDF';
      desc = 'Convert raw or formatted text into a downloadable PDF document.';
    } else if (activeSubtool === 'text-to-word') {
      title = 'Text to Word';
      desc = 'Export plain text into an editable Word document format.';
    } else if (activeSubtool === 'file-info') {
      title = 'File Information & Hash Inspector';
      desc = 'Inspect deep metadata, MIME types, SHA-256 cryptographic hashes, and hex bytes.';
    } else if (activeSubtool === 'file-size-calculator') {
      title = 'File Size & Bitrate Calculator';
      desc = 'Calculate video bitrate, streaming storage requirements, and transfer times.';
    } else if (activeSubtool === 'zip-creator') {
      title = 'ZIP Creator';
      desc = 'Package multiple files into a compressed .zip archive entirely in your browser.';
    }

    container.innerHTML = `
      <div class="tool-workspace">
        <div id="otherToolContent"></div>
      </div>
    `;

    renderSubtoolBody(container);
  }

  function renderSubtoolBody(container) {
    const box = container.querySelector('#otherToolContent');

    if (activeSubtool === 'qr-generator') {
      box.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group" style="grid-column: 1 / -1;">
            <label class="setting-label"><span>QR Content (URL, Text, WiFi)</span></label>
            <input type="text" id="qrTextInput" placeholder="https://example.com" value="https://fileforge.local" />
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Foreground Color</span></label>
            <input type="color" id="qrFgColor" value="#000000" style="width: 100%; height: 42px; padding: 2px;" />
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Background Color</span></label>
            <input type="color" id="qrBgColor" value="#FFFFFF" style="width: 100%; height: 42px; padding: 2px;" />
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Size</span></label>
            <select id="qrSizeSelect">
              <option value="180">Small (180 × 180)</option>
              <option value="260" selected>Standard (260 × 260)</option>
              <option value="400">Large (400 × 400)</option>
            </select>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 24px;">
          <div class="qr-output-box" id="qrOutputCanvasBox"></div>
          <a class="btn btn-primary btn-lg" id="downloadQrBtn" download="qrcode.png">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download QR Code</span>
          </a>
        </div>
      `;

      initQrGenerator(box);
    } else if (activeSubtool === 'qr-scanner') {
      box.innerHTML = `
        <div class="tool-dropzone" id="qrScanDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect></svg>
          </div>
          <h3 class="tool-dropzone-title">Upload Image with QR Code</h3>
          <p class="tool-dropzone-sub">Drop image or scan with webcam</p>
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 10px;">
            <button class="btn btn-secondary" id="browseQrImageBtn">Browse Image</button>
            <button class="btn btn-outline" id="startQrCameraBtn">Use Camera</button>
          </div>
          <input type="file" id="qrImageInput" class="file-input-hidden" accept="image/*" />
        </div>

        <div id="cameraScannerBox" style="display: none; flex-direction: column; align-items: center; gap: 14px; margin-top: 20px;">
          <video id="cameraVideo" style="max-width: 100%; width: 400px; border-radius: 12px; background: #000;" playsinline></video>
          <button class="btn btn-outline btn-sm" id="stopCameraBtn">Stop Camera</button>
        </div>

        <div id="qrScanResultBox" style="display: none; margin-top: 24px;" class="notice-box">
          <div class="notice-icon" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div style="width: 100%;">
            <div class="notice-title">Decoded QR Code Content:</div>
            <div id="qrDecodedContent" style="font-family: var(--font-mono); font-size: 1rem; color: #38bdf8; word-break: break-all; margin: 8px 0;"></div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="btn btn-primary btn-sm" id="copyQrDecodedBtn">Copy to Clipboard</button>
              <a class="btn btn-outline btn-sm" id="openQrDecodedLink" target="_blank" style="display: none;">Open Link ↗</a>
            </div>
          </div>
        </div>
      `;

      initQrScanner(box);
    } else if (activeSubtool === 'text-to-pdf') {
      box.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div class="tool-settings-grid">
            <div class="setting-group">
              <label class="setting-label"><span>Document Title</span></label>
              <input type="text" id="pdfDocTitle" placeholder="Document Title" value="My Document" />
            </div>
            <div class="setting-group">
              <label class="setting-label"><span>Font Size</span></label>
              <select id="pdfFontSize">
                <option value="10">Small (10 pt)</option>
                <option value="12" selected>Standard (12 pt)</option>
                <option value="14">Large (14 pt)</option>
                <option value="16">Heading (16 pt)</option>
              </select>
            </div>
          </div>

          <div class="setting-group">
            <label class="setting-label"><span>Text Content</span></label>
            <textarea id="textPdfBody" placeholder="Type or paste your text here..." style="width: 100%; height: 260px; font-family: var(--font-mono); font-size: 0.95rem; line-height: 1.6;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button class="btn btn-primary btn-lg" id="generateTextPdfBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      `;

      box.querySelector('#generateTextPdfBtn').addEventListener('click', () => generateTextPdf(box));
    } else if (activeSubtool === 'text-to-word') {
      box.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div class="setting-group">
            <label class="setting-label"><span>Document Title</span></label>
            <input type="text" id="wordDocTitle" value="Untitled Document" />
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Content</span></label>
            <textarea id="wordDocBody" placeholder="Enter your text..." style="width: 100%; height: 260px; font-size: 0.95rem; line-height: 1.6;"></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-primary btn-lg" id="downloadDocxBtn">Download Document (.doc)</button>
          </div>
        </div>
      `;

      box.querySelector('#downloadDocxBtn').addEventListener('click', () => {
        const title = box.querySelector('#wordDocTitle').value || 'document';
        const body = box.querySelector('#wordDocBody').value;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${body.replace(/\n/g, '<br/>')}</p></body></html>`;
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const fname = `${title}.doc`;
        if (window.FileForge && typeof window.FileForge.downloadBlob === 'function') {
          window.FileForge.downloadBlob(blob, fname);
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1500);
        }
        window.FileForge.showToast('Document downloaded!', 'success');
      });
    } else if (activeSubtool === 'file-info') {
      box.innerHTML = `
        <div class="tool-dropzone" id="inspectDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </div>
          <h3 class="tool-dropzone-title">Drop any file to inspect metadata & SHA-256 hash</h3>
          <button class="btn btn-secondary" id="browseInspectBtn">Choose File</button>
          <input type="file" id="inspectFileInput" class="file-input-hidden" />
        </div>

        <div id="inspectorDetails" style="display: none; flex-direction: column; gap: 20px; margin-top: 24px;">
          <div class="result-stats-grid" id="inspectStatsGrid"></div>
          <div class="setting-group">
            <label class="setting-label"><span>SHA-256 Cryptographic Checksum</span></label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="sha256Hash" readonly style="font-family: var(--font-mono); font-size: 0.85rem;" />
              <button class="btn btn-outline btn-sm" id="copyHashBtn">Copy Hash</button>
            </div>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Hex Dump Preview (First 256 Bytes)</span></label>
            <div class="hex-preview-box" id="hexPreviewBox"></div>
          </div>
        </div>
      `;

      initFileInspector(box);
    } else if (activeSubtool === 'file-size-calculator') {
      box.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 32px;">
          <!-- Video Bitrate Calculator -->
          <div>
            <h3 style="margin-bottom: 16px;">Video File Size from Bitrate & Duration</h3>
            <div class="tool-settings-grid">
              <div class="setting-group">
                <label class="setting-label"><span>Duration (Minutes)</span></label>
                <input type="number" id="calcMinutes" value="10" min="1" />
              </div>
              <div class="setting-group">
                <label class="setting-label"><span>Video Bitrate (kbps)</span></label>
                <input type="number" id="calcBitrate" value="2500" step="100" />
              </div>
              <div class="setting-group">
                <label class="setting-label"><span>Audio Bitrate (kbps)</span></label>
                <input type="number" id="calcAudioBitrate" value="128" />
              </div>
            </div>
            <div class="result-stats-grid" style="margin-top: 16px;">
              <div class="stat-box">
                <div class="stat-label">Estimated Size (MB)</div>
                <div class="stat-value highlight" id="calcResultMb">197.1 MB</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Estimated Size (GB)</div>
                <div class="stat-value highlight" id="calcResultGb">0.19 GB</div>
              </div>
            </div>
          </div>

          <hr style="border: 0; border-top: 1px solid var(--border-subtle);" />

          <!-- Network Transfer Time Calculator -->
          <div>
            <h3 style="margin-bottom: 16px;">Transfer / Download Time Calculator</h3>
            <div class="tool-settings-grid">
              <div class="setting-group">
                <label class="setting-label"><span>File Size (MB)</span></label>
                <input type="number" id="transferFileSize" value="500" />
              </div>
              <div class="setting-group">
                <label class="setting-label"><span>Network Speed</span></label>
                <select id="transferSpeedSelect">
                  <option value="1000">1 Gbps Fiber (~125 MB/s)</option>
                  <option value="300">300 Mbps High Speed (~37.5 MB/s)</option>
                  <option value="100" selected>100 Mbps Broadband (~12.5 MB/s)</option>
                  <option value="25">25 Mbps 4G LTE (~3.1 MB/s)</option>
                  <option value="5">5 Mbps Mobile (~0.6 MB/s)</option>
                </select>
              </div>
            </div>
            <div class="result-stats-grid" style="margin-top: 16px;">
              <div class="stat-box">
                <div class="stat-label">Download Time</div>
                <div class="stat-value highlight" id="transferTimeResult">40 Seconds</div>
              </div>
            </div>
          </div>
        </div>
      `;

      initCalculator(box);
    } else if (activeSubtool === 'zip-creator') {
      box.innerHTML = `
        <div class="tool-dropzone" id="zipDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
          </div>
          <h3 class="tool-dropzone-title">Drop multiple files to package as ZIP</h3>
          <p class="tool-dropzone-sub">Add any files (images, documents, videos)</p>
          <button class="btn btn-secondary" id="browseZipFilesBtn">Add Files</button>
          <input type="file" id="zipFileInput" class="file-input-hidden" multiple />
        </div>

        <div id="zipListArea" style="display: none; flex-direction: column; gap: 20px; margin-top: 24px;">
          <div class="file-meta-card">
            <div class="file-meta-info">
              <div class="file-meta-text">
                <div class="file-meta-name" id="zipCountTitle">0 Files in Archive</div>
                <div class="file-meta-specs"><span id="zipTotalSize">0 MB Total</span></div>
              </div>
            </div>
            <div class="file-meta-actions">
              <button class="btn btn-outline btn-sm" id="addMoreZipFilesBtn">+ Add More</button>
            </div>
          </div>

          <div id="zipFilesGrid" class="multi-preview-grid"></div>

          <div class="setting-group">
            <label class="setting-label"><span>ZIP Archive Name</span></label>
            <input type="text" id="zipArchiveName" value="Archive.zip" />
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button class="btn btn-primary btn-lg" id="generateZipBtn">Create & Download ZIP</button>
          </div>
        </div>
      `;

      initZipCreator(box);
    }
  }

  // QR Generator
  function initQrGenerator(box) {
    const textInput = box.querySelector('#qrTextInput');
    const fgColor = box.querySelector('#qrFgColor');
    const bgColor = box.querySelector('#qrBgColor');
    const sizeSelect = box.querySelector('#qrSizeSelect');
    const canvasBox = box.querySelector('#qrOutputCanvasBox');
    const downloadBtn = box.querySelector('#downloadQrBtn');

    function updateQr() {
      if (!window.QRCode) return;
      canvasBox.innerHTML = '';
      const size = parseInt(sizeSelect.value, 10);
      qrInstance = new QRCode(canvasBox, {
        text: textInput.value || 'https://fileforge.local',
        width: size,
        height: size,
        colorDark: fgColor.value,
        colorLight: bgColor.value,
        correctLevel: QRCode.CorrectLevel.H,
      });

      setTimeout(() => {
        const canvas = canvasBox.querySelector('canvas');
        const img = canvasBox.querySelector('img');
        if (canvas && typeof canvas.toDataURL === 'function') {
          downloadBtn.href = canvas.toDataURL('image/png');
        } else if (img && img.src) {
          downloadBtn.href = img.src;
        }
      }, 150);
    }

    textInput.addEventListener('input', updateQr);
    fgColor.addEventListener('input', updateQr);
    bgColor.addEventListener('input', updateQr);
    sizeSelect.addEventListener('change', updateQr);

    updateQr();
  }

  // QR Scanner
  function initQrScanner(box) {
    const dropzone = box.querySelector('#qrScanDropzone');
    const fileInput = box.querySelector('#qrImageInput');
    const browseBtn = box.querySelector('#browseQrImageBtn');
    const cameraBtn = box.querySelector('#startQrCameraBtn');
    const cameraBox = box.querySelector('#cameraScannerBox');
    const video = box.querySelector('#cameraVideo');
    const stopCameraBtn = box.querySelector('#stopCameraBtn');
    const resultBox = box.querySelector('#qrScanResultBox');
    const contentEl = box.querySelector('#qrDecodedContent');
    const copyBtn = box.querySelector('#copyQrDecodedBtn');
    const linkBtn = box.querySelector('#openQrDecodedLink');

    browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        scanQrFromImage(e.target.files[0], box);
      }
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        scanQrFromImage(e.dataTransfer.files[0], box);
      }
    };

    cameraBtn.onclick = async () => {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = videoStream;
        video.setAttribute('playsinline', true);
        video.play();
        cameraBox.style.display = 'flex';
        dropzone.style.display = 'none';
        requestAnimationFrame(tickCamera);
      } catch (err) {
        window.FileForge.showToast('Camera access denied or unavailable: ' + err.message, 'error');
      }
    };

    stopCameraBtn.onclick = () => {
      if (videoStream) {
        videoStream.getTracks().forEach((t) => t.stop());
        videoStream = null;
      }
      cameraBox.style.display = 'none';
      dropzone.style.display = 'block';
    };

    function tickCamera() {
      if (!videoStream) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && window.jsQR) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code) {
          showDecodedQr(code.data, box);
          stopCameraBtn.click();
          return;
        }
      }
      requestAnimationFrame(tickCamera);
    }

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(contentEl.textContent);
      window.FileForge.showToast('Copied to clipboard!', 'success');
    };
  }

  function scanQrFromImage(file, box) {
    if (!window.jsQR) {
      window.FileForge.showToast('jsQR library not loaded yet.', 'error');
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height);
      URL.revokeObjectURL(url);

      if (code) {
        showDecodedQr(code.data, box);
      } else {
        window.FileForge.showToast('No QR code detected in this image.', 'error');
      }
    };
    img.src = url;
  }

  function showDecodedQr(data, box) {
    const resultBox = box.querySelector('#qrScanResultBox');
    const contentEl = box.querySelector('#qrDecodedContent');
    const linkBtn = box.querySelector('#openQrDecodedLink');

    contentEl.textContent = data;
    if (/^https?:\/\//i.test(data)) {
      linkBtn.href = data;
      linkBtn.style.display = 'inline-flex';
    } else {
      linkBtn.style.display = 'none';
    }
    resultBox.style.display = 'flex';
    window.FileForge.showToast('QR Code successfully decoded!', 'success');
  }

  // Text to PDF via pdf-lib
  async function generateTextPdf(box) {
    if (!window.PDFLib) {
      window.FileForge.showToast('PDF-Lib loading. Please try again.', 'info');
      return;
    }

    const title = box.querySelector('#pdfDocTitle').value.trim() || 'Document';
    const fontSize = parseInt(box.querySelector('#pdfFontSize').value, 10) || 12;
    const text = box.querySelector('#textPdfBody').value;

    if (!text.trim()) {
      window.FileForge.showToast('Please enter some text first.', 'error');
      return;
    }

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      const margin = 50;
      const pageW = 595.28;
      const pageH = 841.89;
      let page = pdfDoc.addPage([pageW, pageH]);
      let y = pageH - margin;

      // Draw title
      page.drawText(title, {
        x: margin,
        y: y,
        size: fontSize + 6,
        font: fontBold,
        color: PDFLib.rgb(0.1, 0.1, 0.1),
      });
      y -= fontSize + 18;

      // Wrap text lines
      const words = text.split(/\s+/);
      let currentLine = '';
      const maxLineWidth = pageW - margin * 2;

      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxLineWidth) {
          page.drawText(currentLine, { x: margin, y: y, size: fontSize, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
          y -= fontSize + 6;
          currentLine = word;

          if (y < margin) {
            page = pdfDoc.addPage([pageW, pageH]);
            y = pageH - margin;
          }
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        page.drawText(currentLine, { x: margin, y: y, size: fontSize, font: font, color: PDFLib.rgb(0.2, 0.2, 0.2) });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const fname = `${title}.pdf`;
      if (window.FileForge && typeof window.FileForge.downloadBlob === 'function') {
        window.FileForge.downloadBlob(blob, fname);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      }
      window.FileForge.showToast('Text converted to PDF!', 'success');
    } catch (err) {
      console.error('Text to PDF error:', err);
      window.FileForge.showToast('Failed to create PDF: ' + err.message, 'error');
    }
  }

  // File Inspector
  function initFileInspector(box) {
    const dropzone = box.querySelector('#inspectDropzone');
    const fileInput = box.querySelector('#inspectFileInput');
    const browseBtn = box.querySelector('#browseInspectBtn');
    const detailsBox = box.querySelector('#inspectorDetails');
    const statsGrid = box.querySelector('#inspectStatsGrid');
    const hashInput = box.querySelector('#sha256Hash');
    const copyHashBtn = box.querySelector('#copyHashBtn');
    const hexBox = box.querySelector('#hexPreviewBox');

    browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) inspectFile(e.target.files[0], box);
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) inspectFile(e.dataTransfer.files[0], box);
    };

    copyHashBtn.onclick = () => {
      navigator.clipboard.writeText(hashInput.value);
      window.FileForge.showToast('SHA-256 hash copied!', 'success');
    };
  }

  async function inspectFile(file, box) {
    const detailsBox = box.querySelector('#inspectorDetails');
    const statsGrid = box.querySelector('#inspectStatsGrid');
    const hashInput = box.querySelector('#sha256Hash');
    const hexBox = box.querySelector('#hexPreviewBox');

    detailsBox.style.display = 'flex';
    hashInput.value = 'Calculating SHA-256...';

    statsGrid.innerHTML = `
      <div class="stat-box"><div class="stat-label">File Name</div><div class="stat-value" style="font-size: 1.05rem;">${file.name}</div></div>
      <div class="stat-box"><div class="stat-label">File Size</div><div class="stat-value highlight">${formatBytes(file.size)}</div></div>
      <div class="stat-box"><div class="stat-label">Exact Bytes</div><div class="stat-value">${file.size.toLocaleString()} B</div></div>
      <div class="stat-box"><div class="stat-label">MIME Type</div><div class="stat-value highlight" style="font-size: 0.95rem;">${file.type || 'Unknown'}</div></div>
    `;

    // Calculate SHA-256 via Web Crypto
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hashArray = Array.from(new Uint8Array(hashBuf));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    hashInput.value = hashHex;

    // Hex Dump of first 256 bytes
    const slice = new Uint8Array(buf.slice(0, 256));
    let dump = '';
    for (let i = 0; i < slice.length; i += 16) {
      const chunk = slice.subarray(i, i + 16);
      const hexPart = Array.from(chunk)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(48, ' ');
      const asciiPart = Array.from(chunk)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      const offset = i.toString(16).padStart(4, '0');
      dump += `${offset}:  ${hexPart}  |${asciiPart}|\n`;
    }
    hexBox.textContent = dump;
    window.FileForge.showToast('File inspection complete!', 'success');
  }

  // Calculator
  function initCalculator(box) {
    const mins = box.querySelector('#calcMinutes');
    const vBps = box.querySelector('#calcBitrate');
    const aBps = box.querySelector('#calcAudioBitrate');
    const mbOut = box.querySelector('#calcResultMb');
    const gbOut = box.querySelector('#calcResultGb');

    function updateBitrateCalc() {
      const sec = (parseFloat(mins.value) || 0) * 60;
      const totalBps = (parseFloat(vBps.value) || 0) + (parseFloat(aBps.value) || 0);
      const totalBits = sec * totalBps * 1000;
      const totalBytes = totalBits / 8;
      const mb = totalBytes / (1024 * 1024);
      const gb = mb / 1024;
      mbOut.textContent = mb.toFixed(1) + ' MB';
      gbOut.textContent = gb.toFixed(2) + ' GB';
    }

    mins.oninput = updateBitrateCalc;
    vBps.oninput = updateBitrateCalc;
    aBps.oninput = updateBitrateCalc;

    // Transfer Calc
    const tfSize = box.querySelector('#transferFileSize');
    const tfSpeed = box.querySelector('#transferSpeedSelect');
    const tfResult = box.querySelector('#transferTimeResult');

    function updateTransferCalc() {
      const mb = parseFloat(tfSize.value) || 0;
      const speedMbps = parseFloat(tfSpeed.value) || 100;
      const speedMBps = speedMbps / 8;
      const sec = mb / speedMBps;
      if (sec < 60) {
        tfResult.textContent = sec.toFixed(1) + ' Seconds';
      } else {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        tfResult.textContent = `${m} min ${s} sec`;
      }
    }

    tfSize.oninput = updateTransferCalc;
    tfSpeed.onchange = updateTransferCalc;
  }

  // ZIP Creator
  function initZipCreator(box) {
    const dropzone = box.querySelector('#zipDropzone');
    const fileInput = box.querySelector('#zipFileInput');
    const browseBtn = box.querySelector('#browseZipFilesBtn');
    const addMoreBtn = box.querySelector('#addMoreZipFilesBtn');
    const generateBtn = box.querySelector('#generateZipBtn');
    const archiveNameInput = box.querySelector('#zipArchiveName');

    browseBtn.onclick = () => fileInput.click();
    addMoreBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addZipFiles(Array.from(e.target.files), box);
      }
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    };
    dropzone.ondragleave = () => dropzone.classList.remove('dragover');
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addZipFiles(Array.from(e.dataTransfer.files), box);
      }
    };

    generateBtn.onclick = async () => {
      if (zipFiles.length === 0) return;
      if (!window.JSZip) {
        window.FileForge.showToast('JSZip loading. Please wait...', 'info');
        return;
      }

      try {
        window.FileForge.showToast('Compressing files into ZIP archive...', 'info');
        const zip = new JSZip();
        for (const f of zipFiles) {
          zip.file(f.name, f);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const rawName = archiveNameInput.value.trim() || 'Archive.zip';
        const fname = rawName.endsWith('.zip') ? rawName : rawName + '.zip';
        if (window.FileForge && typeof window.FileForge.downloadBlob === 'function') {
          window.FileForge.downloadBlob(zipBlob, fname);
        } else {
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(url); }, 1500);
        }
        window.FileForge.showToast('ZIP archive created and downloaded!', 'success');
      } catch (err) {
        console.error('ZIP error:', err);
        window.FileForge.showToast('Failed to create ZIP: ' + err.message, 'error');
      }
    };
  }

  function addZipFiles(files, box) {
    zipFiles.push(...files);
    box.querySelector('#zipDropzone').style.display = 'none';
    box.querySelector('#zipListArea').style.display = 'flex';

    const total = zipFiles.reduce((acc, cur) => acc + cur.size, 0);
    box.querySelector('#zipCountTitle').textContent = `${zipFiles.length} File${zipFiles.length > 1 ? 's' : ''} in Archive`;
    box.querySelector('#zipTotalSize').textContent = `${formatBytes(total)} Total`;

    const grid = box.querySelector('#zipFilesGrid');
    grid.innerHTML = '';
    zipFiles.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'preview-thumb-card';
      card.innerHTML = `
        <div style="font-size: 1.5rem; text-align: center; padding: 10px 0;">📦</div>
        <div class="preview-thumb-name">${f.name}</div>
        <div class="preview-thumb-size">${formatBytes(f.size)}</div>
        <button class="remove-thumb-btn" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff;">×</button>
      `;
      card.querySelector('.remove-thumb-btn').onclick = () => {
        zipFiles.splice(idx, 1);
        if (zipFiles.length === 0) {
          box.querySelector('#zipListArea').style.display = 'none';
          box.querySelector('#zipDropzone').style.display = 'block';
        } else {
          addZipFiles([], box);
        }
      };
      grid.appendChild(card);
    });
  }

  return {
    init,
    cleanup,
  };
})();
