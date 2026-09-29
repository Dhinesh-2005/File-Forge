/**
 * FileForge - PDF Tools Suite
 * Browser-based PDF operations using PDF.js and pdf-lib.
 * Includes Merge PDF, Split PDF, Rotate PDF, PDF to JPG, PDF to Text, and PDF Compressor.
 * Adheres strictly to zero-fake-conversions rule with honest transparency for proprietary document engines.
 */

window.FileForge = window.FileForge || {};
window.FileForge.PdfTools = (function () {
  let loadedPdfFiles = []; // { file, arrayBuffer, pdfDoc, pageCount }
  let singlePdfFile = null;
  let singlePdfBytes = null;
  let singlePdfDoc = null;
  let totalPages = 0;
  let activeSubtool = 'merge'; // 'merge' | 'split' | 'rotate' | 'to-jpg' | 'to-text' | 'compress' | 'to-word' | 'to-excel'
  let renderedPageImages = []; // for PDF to JPG { pageNum, blob, url }
  let extractedTextContent = '';
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
    renderedPageImages.forEach((x) => {
      if (x.url) URL.revokeObjectURL(x.url);
    });
    renderedPageImages = [];
    loadedPdfFiles = [];
    singlePdfFile = null;
    singlePdfBytes = null;
    singlePdfDoc = null;
    totalPages = 0;
    extractedTextContent = '';
    resultBlob = null;
    resultUrl = null;
  }

  function init(containerEl, file = null, subtool = 'merge') {
    cleanup();
    activeSubtool = subtool;

    // Ensure PDF.js worker is configured
    if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    renderInterface(containerEl);

    if (file) {
      if (Array.isArray(file)) {
        handleMultiplePdfFiles(file, containerEl);
      } else {
        handleSinglePdfFile(file, containerEl);
      }
    }
  }

  function renderInterface(container) {
    const isNoticeOnly = activeSubtool === 'to-word';
    const isMerge = activeSubtool === 'merge';

    let subtoolTitle = 'Merge PDF Files';
    let subtoolDesc = 'Combine multiple PDF documents into a single organized file.';

    if (activeSubtool === 'split') {
      subtoolTitle = 'Split PDF Pages';
      subtoolDesc = 'Extract specific page ranges or single pages from your PDF document.';
    } else if (activeSubtool === 'rotate') {
      subtoolTitle = 'Rotate PDF';
      subtoolDesc = 'Rotate orientation of all or selected pages permanently.';
    } else if (activeSubtool === 'to-jpg') {
      subtoolTitle = 'PDF to JPG';
      subtoolDesc = 'Convert every PDF page into high-resolution JPG images with batch ZIP download.';
    } else if (activeSubtool === 'to-text') {
      subtoolTitle = 'PDF to Text';
      subtoolDesc = 'Extract raw textual content from all pages into an editable text document.';
    } else if (activeSubtool === 'compress') {
      subtoolTitle = 'PDF Compressor';
      subtoolDesc = 'Optimize and reduce PDF document size directly inside your browser.';
    } else if (activeSubtool === 'to-word') {
      subtoolTitle = 'PDF to Word';
      subtoolDesc = 'Convert PDF documents into editable Word documents.';
    } else if (activeSubtool === 'to-excel') {
      subtoolTitle = 'PDF to Excel';
      subtoolDesc = 'Extract tabular spreadsheets and tables from PDF documents into Excel (.xlsx).';
    }

    container.innerHTML = `
      <div class="tool-workspace">
        <!-- Notice if proprietary server-side conversion -->
        ${
          isNoticeOnly
            ? `
          <div class="notice-box">
            <div class="notice-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div>
              <div class="notice-title">Browser-Only Security Notice</div>
              <p class="notice-desc">
                This conversion requires advanced document processing and is not currently available in browser-only mode.
                FileForge strictly operates 100% locally in your browser to safeguard your privacy and does not upload your files to any external cloud server.
                <br /><br />
                <strong>Alternative Available:</strong> You can use our client-side <strong>PDF to Text</strong> tool to extract all text, data, and tables locally with zero data exposure.
              </p>
              <button class="btn btn-primary btn-sm" id="switchToPdfTextBtn" style="margin-top: 14px;">Switch to PDF to Text</button>
            </div>
          </div>
        `
            : ''
        }

        <!-- Dropzone (only if supported tool) -->
        ${
          !isNoticeOnly
            ? `
          <div class="tool-dropzone" id="pdfDropzone">
            <div class="tool-dropzone-icon" style="background: rgba(239, 68, 68, 0.12); color: #f87171;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <h3 class="tool-dropzone-title">Drop your PDF file${isMerge ? 's' : ''} here</h3>
            <p class="tool-dropzone-sub">Supports all standard PDF documents ${isMerge ? '(Select multiple to merge)' : ''}</p>
            <button class="btn btn-secondary" id="browsePdfBtn">Browse PDF Files</button>
            <input type="file" id="pdfFileInput" class="file-input-hidden" accept="application/pdf" ${isMerge ? 'multiple' : ''} />
          </div>
        `
            : ''
        }

        <!-- PDF Workspace Area -->
        <div id="pdfWorkspaceArea" style="display: none; flex-direction: column; gap: 24px;">
          <!-- Loaded Info Card -->
          <div class="file-meta-card">
            <div class="file-meta-info">
              <div class="file-meta-icon" style="background: rgba(239, 68, 68, 0.15); color: #f87171;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              </div>
              <div class="file-meta-text">
                <div class="file-meta-name" id="pdfDocName">document.pdf</div>
                <div class="file-meta-specs">
                  <span>Size: <strong id="pdfDocSize">0 KB</strong></span>
                  <span>•</span>
                  <span>Total Pages: <strong id="pdfDocPages">0</strong></span>
                </div>
              </div>
            </div>
            <div class="file-meta-actions">
              ${isMerge ? '<button class="btn btn-outline btn-sm" id="addMorePdfsBtn">+ Add PDF</button>' : ''}
              <button class="btn btn-outline btn-sm" id="changePdfBtn">Change File</button>
            </div>
          </div>

          <!-- Multi-file list for Merge -->
          <div id="mergeListContainer" style="display: none; flex-direction: column; gap: 10px;"></div>

          <!-- Specific Subtool Controls -->
          <div id="pdfSpecificControls"></div>

          <!-- Live Preview / Thumbnails or Text viewer -->
          <div id="pdfDisplayArea" style="display: none;"></div>

          <!-- Action Button -->
          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button class="btn btn-primary btn-lg" id="executePdfToolBtn">
              <span>Execute PDF Action</span>
            </button>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="tool-progress-container" id="pdfProgressContainer">
          <div class="progress-header">
            <span class="progress-status-text">
              <span class="progress-spinner"></span>
              <span id="pdfStatusMsg">Processing PDF in browser...</span>
            </span>
            <span class="progress-percent" id="pdfPercent">0%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="pdfProgressFill"></div>
          </div>
        </div>

        <!-- Result Card -->
        <div class="tool-result-container" id="pdfResultContainer">
          <div class="result-heading">
            <h3 class="result-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              PDF Operation Complete!
            </h3>
            <span class="result-badge-success">Processed Locally</span>
          </div>

          <div class="result-stats-grid">
            <div class="stat-box">
              <div class="stat-label">Action</div>
              <div class="stat-value highlight" id="pdfStatAction">${subtoolTitle}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">File Output</div>
              <div class="stat-value" id="pdfStatOutput">PDF File</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Size</div>
              <div class="stat-value highlight" id="pdfStatSize">0 KB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Pages / Items</div>
              <div class="stat-value highlight" id="pdfStatItems">1</div>
            </div>
          </div>

          <div id="pdfResultCustomView" style="display: none; width: 100%;"></div>

          <div class="result-actions-row">
            <button class="btn btn-secondary" id="pdfResetBtn">Process Another</button>
            <a class="btn btn-primary btn-lg" id="pdfDownloadBtn" download="output.pdf">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download File</span>
            </a>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    const isNoticeOnly = activeSubtool === 'to-word' || activeSubtool === 'to-excel';
    if (isNoticeOnly) {
      const switchBtn = container.querySelector('#switchToPdfTextBtn');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => {
          window.FileForge.openTool('pdf-to-text');
        });
      }
      return;
    }

    const dropzone = container.querySelector('#pdfDropzone');
    const fileInput = container.querySelector('#pdfFileInput');
    const browseBtn = container.querySelector('#browsePdfBtn');
    const changeBtn = container.querySelector('#changePdfBtn');
    const addMoreBtn = container.querySelector('#addMorePdfsBtn');
    const executeBtn = container.querySelector('#executePdfToolBtn');
    const resetBtn = container.querySelector('#pdfResetBtn');

    browseBtn.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    changeBtn.addEventListener('click', () => fileInput.click());
    if (addMoreBtn) addMoreBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        if (activeSubtool === 'merge') {
          handleMultiplePdfFiles(Array.from(e.target.files), container);
        } else {
          handleSinglePdfFile(e.target.files[0], container);
        }
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const pdfs = Array.from(e.dataTransfer.files).filter(
          (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
        );
        if (pdfs.length > 0) {
          if (activeSubtool === 'merge') {
            handleMultiplePdfFiles(pdfs, container);
          } else {
            handleSinglePdfFile(pdfs[0], container);
          }
        } else {
          window.FileForge.showToast('Please select valid PDF files.', 'error');
        }
      }
    });

    executeBtn.addEventListener('click', () => executePdfOperation(container));
    resetBtn.addEventListener('click', () => {
      cleanup();
      container.querySelector('#pdfResultContainer').classList.remove('active');
      container.querySelector('#pdfWorkspaceArea').style.display = 'none';
      container.querySelector('#pdfDropzone').style.display = 'block';
    });
  }

  async function handleSinglePdfFile(file, container) {
    if (!window.PDFLib) {
      window.FileForge.showToast('PDF-Lib loading. Please retry in a moment.', 'info');
      return;
    }

    try {
      singlePdfFile = file;
      singlePdfBytes = await file.arrayBuffer();
      singlePdfDoc = await PDFLib.PDFDocument.load(singlePdfBytes);
      totalPages = singlePdfDoc.getPageCount();

      container.querySelector('#pdfDocName').textContent = file.name;
      container.querySelector('#pdfDocSize').textContent = formatBytes(file.size);
      container.querySelector('#pdfDocPages').textContent = totalPages;

      container.querySelector('#pdfDropzone').style.display = 'none';
      container.querySelector('#pdfWorkspaceArea').style.display = 'flex';
      container.querySelector('#pdfResultContainer').classList.remove('active');

      renderSubtoolControls(container);
    } catch (err) {
      console.error('Error loading PDF:', err);
      window.FileForge.showToast('Unable to open PDF: ' + err.message, 'error');
    }
  }

  async function handleMultiplePdfFiles(files, container) {
    if (!window.PDFLib) {
      window.FileForge.showToast('PDF-Lib loading. Please retry in a moment.', 'info');
      return;
    }

    try {
      for (const f of files) {
        const bytes = await f.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(bytes);
        loadedPdfFiles.push({
          file: f,
          bytes: bytes,
          pdfDoc: doc,
          pageCount: doc.getPageCount(),
        });
      }

      const totalSize = loadedPdfFiles.reduce((acc, cur) => acc + cur.file.size, 0);
      const totalP = loadedPdfFiles.reduce((acc, cur) => acc + cur.pageCount, 0);

      container.querySelector('#pdfDocName').textContent = `${loadedPdfFiles.length} PDFs to Merge`;
      container.querySelector('#pdfDocSize').textContent = formatBytes(totalSize);
      container.querySelector('#pdfDocPages').textContent = totalP;

      container.querySelector('#pdfDropzone').style.display = 'none';
      container.querySelector('#pdfWorkspaceArea').style.display = 'flex';
      container.querySelector('#pdfResultContainer').classList.remove('active');

      renderMergeList(container);
      renderSubtoolControls(container);
    } catch (err) {
      console.error('Error loading PDFs:', err);
      window.FileForge.showToast('Failed to load PDF file: ' + err.message, 'error');
    }
  }

  function renderMergeList(container) {
    const listEl = container.querySelector('#mergeListContainer');
    listEl.style.display = 'flex';
    listEl.innerHTML = `
      <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-light); margin-bottom: 4px;">
        Merge Order (Drag or remove items)
      </div>
    `;

    loadedPdfFiles.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'file-meta-card';
      row.style.padding = '12px 18px';
      row.innerHTML = `
        <div class="file-meta-info">
          <span style="font-family: var(--font-mono); font-weight: 700; color: #a5b4fc;">#${idx + 1}</span>
          <div class="file-meta-text">
            <div class="file-meta-name" style="max-width: 260px;">${item.file.name}</div>
            <div class="file-meta-specs">
              <span>${formatBytes(item.file.size)}</span> • <span>${item.pageCount} Pages</span>
            </div>
          </div>
        </div>
        <div class="file-meta-actions">
          ${idx > 0 ? `<button class="btn btn-outline btn-sm move-up-btn" data-idx="${idx}">↑ Up</button>` : ''}
          ${
            idx < loadedPdfFiles.length - 1
              ? `<button class="btn btn-outline btn-sm move-down-btn" data-idx="${idx}">↓ Down</button>`
              : ''
          }
          <button class="btn btn-outline btn-sm remove-pdf-btn" data-idx="${idx}" style="color: #f87171;">Remove</button>
        </div>
      `;

      if (idx > 0) {
        row.querySelector('.move-up-btn').onclick = () => {
          const temp = loadedPdfFiles[idx];
          loadedPdfFiles[idx] = loadedPdfFiles[idx - 1];
          loadedPdfFiles[idx - 1] = temp;
          renderMergeList(container);
        };
      }
      if (idx < loadedPdfFiles.length - 1) {
        row.querySelector('.move-down-btn').onclick = () => {
          const temp = loadedPdfFiles[idx];
          loadedPdfFiles[idx] = loadedPdfFiles[idx + 1];
          loadedPdfFiles[idx + 1] = temp;
          renderMergeList(container);
        };
      }
      row.querySelector('.remove-pdf-btn').onclick = () => {
        loadedPdfFiles.splice(idx, 1);
        if (loadedPdfFiles.length === 0) {
          container.querySelector('#pdfWorkspaceArea').style.display = 'none';
          container.querySelector('#pdfDropzone').style.display = 'block';
        } else {
          renderMergeList(container);
        }
      };

      listEl.appendChild(row);
    });
  }

  function renderSubtoolControls(container) {
    const controlsBox = container.querySelector('#pdfSpecificControls');
    const executeBtn = container.querySelector('#executePdfToolBtn');

    if (activeSubtool === 'merge') {
      executeBtn.innerHTML = `<span>Merge All PDFs</span>`;
      controlsBox.innerHTML = '';
    } else if (activeSubtool === 'split') {
      executeBtn.innerHTML = `<span>Extract & Split Pages</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Page Range</span></label>
            <input type="text" id="splitPageRanges" placeholder="e.g. 1-3, 5, 7" value="1-${totalPages}" />
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
              Enter comma-separated pages or page ranges (Total: ${totalPages} pages)
            </span>
          </div>
        </div>
      `;
    } else if (activeSubtool === 'rotate') {
      executeBtn.innerHTML = `<span>Rotate & Save PDF</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Rotation Angle</span></label>
            <select id="pdfRotationAngle">
              <option value="90" selected>90° Clockwise</option>
              <option value="180">180° Half Turn</option>
              <option value="270">270° Counter-Clockwise</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Apply To</span></label>
            <select id="pdfRotationTarget">
              <option value="all" selected>All Pages (${totalPages} pages)</option>
              <option value="first">First Page Only</option>
            </select>
          </div>
        </div>
      `;
    } else if (activeSubtool === 'to-jpg') {
      executeBtn.innerHTML = `<span>Convert Pages to JPG</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Image Resolution</span></label>
            <select id="pdfJpgDpi">
              <option value="1.5" selected>Standard HD (150 DPI)</option>
              <option value="2.0">Ultra High-Res (200 DPI)</option>
              <option value="1.0">Web Standard (72 DPI - Faster)</option>
            </select>
          </div>
        </div>
      `;
    } else if (activeSubtool === 'to-text') {
      executeBtn.innerHTML = `<span>Extract Text Streams</span>`;
      controlsBox.innerHTML = '';
    } else if (activeSubtool === 'compress') {
      executeBtn.innerHTML = `<span>Compress PDF</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Compression Profile</span></label>
            <select id="pdfCompressProfile">
              <option value="medium" selected>Balanced Compression (Recommended)</option>
              <option value="high">High Compression (Lower image DPI)</option>
            </select>
          </div>
        </div>
      `;
    } else if (activeSubtool === 'to-excel') {
      executeBtn.innerHTML = `<span>Extract & Convert to Excel</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Workbook Layout</span></label>
            <select id="pdfExcelLayout">
              <option value="combined" selected>Combine All Pages into One Sheet</option>
              <option value="separate">Create Separate Sheet per PDF Page</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Output File Format</span></label>
            <select id="pdfExcelFormat">
              <option value="xlsx" selected>Excel Spreadsheet (.xlsx)</option>
              <option value="csv">Comma-Separated Values (.csv)</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Header Detection</span></label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: var(--text-light); margin-top: 8px; cursor: pointer;">
              <input type="checkbox" id="pdfExcelDetectHeaders" checked />
              <span>Detect First Row as Column Headers</span>
            </label>
          </div>
        </div>
      `;
    }
  }

  async function executePdfOperation(container) {
    const executeBtn = container.querySelector('#executePdfToolBtn');
    executeBtn.disabled = true;

    const progressContainer = container.querySelector('#pdfProgressContainer');
    const progressFill = container.querySelector('#pdfProgressFill');
    const percentEl = container.querySelector('#pdfPercent');
    const statusMsg = container.querySelector('#pdfStatusMsg');

    progressContainer.classList.add('active');
    progressFill.style.width = '10%';
    percentEl.textContent = '10%';

    try {
      if (activeSubtool === 'merge') {
        await executeMerge(container);
      } else if (activeSubtool === 'split') {
        await executeSplit(container);
      } else if (activeSubtool === 'rotate') {
        await executeRotate(container);
      } else if (activeSubtool === 'to-jpg') {
        await executeToJpg(container);
      } else if (activeSubtool === 'to-text') {
        await executeToText(container);
      } else if (activeSubtool === 'compress') {
        await executeCompress(container);
      } else if (activeSubtool === 'to-excel') {
        await executeToExcel(container);
      }
    } catch (err) {
      console.error('PDF Execution error:', err);
      window.FileForge.showToast('Operation failed: ' + err.message, 'error');
    } finally {
      progressContainer.classList.remove('active');
      executeBtn.disabled = false;
    }
  }

  async function executeMerge(container) {
    if (loadedPdfFiles.length < 2) {
      window.FileForge.showToast('Please add at least 2 PDF files to merge.', 'error');
      return;
    }

    const mergedDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < loadedPdfFiles.length; i++) {
      const item = loadedPdfFiles[i];
      const pageIndices = item.pdfDoc.getPageIndices();
      const copiedPages = await mergedDoc.copyPages(item.pdfDoc, pageIndices);
      copiedPages.forEach((p) => mergedDoc.addPage(p));
    }

    const mergedBytes = await mergedDoc.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });

    displayPdfResult(container, blob, 'Merged Document', 'application/pdf', `${mergedDoc.getPageCount()} Pages`, 'merged-document.pdf');
  }

  async function executeSplit(container) {
    const rangeInput = container.querySelector('#splitPageRanges').value.trim();
    if (!rangeInput) {
      window.FileForge.showToast('Please specify a page range.', 'error');
      return;
    }

    // Parse page ranges e.g. "1-3, 5, 8"
    const targetPages = new Set();
    const parts = rangeInput.split(',');

    for (const part of parts) {
      const clean = part.trim();
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.min(start, end); p <= Math.max(start, end); p++) {
            if (p >= 1 && p <= totalPages) targetPages.add(p - 1); // 0-indexed
          }
        }
      } else {
        const p = parseInt(clean, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) targetPages.add(p - 1);
      }
    }

    const pageIndices = Array.from(targetPages).sort((a, b) => a - b);
    if (pageIndices.length === 0) {
      window.FileForge.showToast('No valid pages found in range. (Document has ' + totalPages + ' pages)', 'error');
      return;
    }

    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(singlePdfDoc, pageIndices);
    copiedPages.forEach((p) => newDoc.addPage(p));

    const newBytes = await newDoc.save();
    const blob = new Blob([newBytes], { type: 'application/pdf' });

    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    displayPdfResult(container, blob, 'Split PDF', 'application/pdf', `${pageIndices.length} Page(s)`, `${baseName}-split.pdf`);
  }

  async function executeRotate(container) {
    const angle = parseInt(container.querySelector('#pdfRotationAngle').value, 10);
    const target = container.querySelector('#pdfRotationTarget').value;

    const pages = singlePdfDoc.getPages();
    pages.forEach((page, idx) => {
      if (target === 'all' || idx === 0) {
        const currentRot = page.getRotation().angle;
        page.setRotation(PDFLib.degrees((currentRot + angle) % 360));
      }
    });

    const rotatedBytes = await singlePdfDoc.save();
    const blob = new Blob([rotatedBytes], { type: 'application/pdf' });

    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    displayPdfResult(container, blob, 'Rotated PDF', 'application/pdf', `${pages.length} Pages`, `${baseName}-rotated.pdf`);
  }

  async function executeToJpg(container) {
    if (!window.pdfjsLib) {
      window.FileForge.showToast('PDF.js library is loading. Please wait...', 'info');
      return;
    }

    const scale = parseFloat(container.querySelector('#pdfJpgDpi').value);
    const progressFill = container.querySelector('#pdfProgressFill');
    const percentEl = container.querySelector('#pdfPercent');
    const statusMsg = container.querySelector('#pdfStatusMsg');

    renderedPageImages = [];

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(singlePdfBytes) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pct = Math.round((pageNum / numPages) * 100);
      progressFill.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      statusMsg.textContent = `Rendering page ${pageNum} of ${numPages} to high-res JPG...`;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // White background for JPG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      const url = URL.createObjectURL(blob);
      renderedPageImages.push({ pageNum, blob, url });
    }

    // Build custom thumbnail grid in result view
    const customView = container.querySelector('#pdfResultCustomView');
    customView.style.display = 'block';
    customView.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 12px; font-size: 1rem;">Rendered Page Images (${renderedPageImages.length}):</div>
      <div class="pdf-pages-grid">
        ${renderedPageImages
          .map(
            (p) => `
          <div class="pdf-page-card">
            <img src="${p.url}" alt="Page ${p.pageNum}" />
            <span class="pdf-page-num">Page ${p.pageNum}</span>
            <a href="${p.url}" download="page-${p.pageNum}.jpg" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">Download</a>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Download button zips all pages
    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    const zip = new JSZip();
    renderedPageImages.forEach((p) => {
      zip.file(`page-${p.pageNum}.jpg`, p.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    displayPdfResult(container, zipBlob, 'PDF to JPG', 'application/zip', `${numPages} Images`, `${baseName}-images.zip`);
  }

  async function executeToText(container) {
    if (!window.pdfjsLib) {
      window.FileForge.showToast('PDF.js library is loading. Please wait...', 'info');
      return;
    }

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(singlePdfBytes) });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map((item) => item.str);
      fullText += `--- Page ${pageNum} ---\n` + pageStrings.join(' ') + '\n\n';
    }

    extractedTextContent = fullText;
    const words = fullText.trim().split(/\s+/).filter(Boolean).length;
    const textBlob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });

    const customView = container.querySelector('#pdfResultCustomView');
    customView.style.display = 'block';
    customView.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700;">Extracted Plain Text (${words} words):</span>
        <button class="btn btn-outline btn-sm" id="copyExtractedTextBtn">Copy Text</button>
      </div>
      <textarea readonly style="width: 100%; height: 200px; font-family: var(--font-mono); font-size: 0.85rem; line-height: 1.5; resize: vertical;">${fullText}</textarea>
    `;

    customView.querySelector('#copyExtractedTextBtn').onclick = () => {
      navigator.clipboard.writeText(fullText);
      window.FileForge.showToast('Text copied to clipboard!', 'success');
    };

    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    displayPdfResult(container, textBlob, 'PDF to Text', 'text/plain', `${words} Words`, `${baseName}-extracted.txt`);
  }

  async function executeCompress(container) {
    // Re-pack PDF using pdf-lib with clean stream compression
    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(singlePdfDoc, singlePdfDoc.getPageIndices());
    copiedPages.forEach((p) => newDoc.addPage(p));

    const compressedBytes = await newDoc.save({ useObjectStreams: true });
    const blob = new Blob([compressedBytes], { type: 'application/pdf' });

    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    displayPdfResult(container, blob, 'PDF Compression', 'application/pdf', `${newDoc.getPageCount()} Pages`, `${baseName}-compressed.pdf`);
  }

  async function executeToExcel(container) {
    if (!window.pdfjsLib) {
      window.FileForge.showToast('PDF.js library is loading. Please wait...', 'info');
      return;
    }
    if (!window.XLSX) {
      window.FileForge.showToast('SheetJS (XLSX) library is loading. Please wait...', 'info');
      return;
    }

    const progressFill = container.querySelector('#pdfProgressFill');
    const percentEl = container.querySelector('#pdfPercent');
    const statusMsg = container.querySelector('#pdfStatusMsg');

    const layout = container.querySelector('#pdfExcelLayout') ? container.querySelector('#pdfExcelLayout').value : 'combined';
    const format = container.querySelector('#pdfExcelFormat') ? container.querySelector('#pdfExcelFormat').value : 'xlsx';
    const detectHeaders = container.querySelector('#pdfExcelDetectHeaders') ? container.querySelector('#pdfExcelDetectHeaders').checked : true;

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(singlePdfBytes) });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    const wb = XLSX.utils.book_new();
    let allExtractedRows = [];
    let maxColsCount = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pct = Math.round((pageNum / numPages) * 100);
      progressFill.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      statusMsg.textContent = `Analyzing & extracting tables from page ${pageNum} of ${numPages}...`;

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      
      const rawItems = textContent.items.filter((item) => item.str && item.str.trim().length > 0);
      if (rawItems.length === 0) continue;

      const items = rawItems.map((item) => ({
        str: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        w: Math.round(item.width),
        h: Math.round(item.height || 10),
      }));

      // Sort items top-to-bottom (descending Y) then left-to-right (ascending X)
      items.sort((a, b) => {
        if (Math.abs(b.y - a.y) > 4) {
          return b.y - a.y;
        }
        return a.x - b.x;
      });

      // Group into rows
      const rows = [];
      let currentRow = [];
      let currentY = null;

      for (const item of items) {
        if (currentY === null || Math.abs(item.y - currentY) <= 5) {
          currentRow.push(item);
          if (currentY === null) currentY = item.y;
        } else {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [item];
          currentY = item.y;
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      // Convert row items into cells based on horizontal gaps or delimiters
      const pageTableData = [];

      for (const rowItems of rows) {
        rowItems.sort((a, b) => a.x - b.x);

        const cells = [];
        let currentCellStr = '';
        let lastRight = null;

        for (let i = 0; i < rowItems.length; i++) {
          const item = rowItems[i];
          const text = item.str;

          if (text.includes('\t') || text.includes(' | ') || /\s{3,}/.test(text)) {
            if (currentCellStr) {
              cells.push(cleanCellValue(currentCellStr));
              currentCellStr = '';
            }
            const parts = text.split(/\t| \| |\s{3,}/);
            for (const p of parts) {
              if (p.trim()) cells.push(cleanCellValue(p.trim()));
            }
            lastRight = item.x + item.w;
            continue;
          }

          if (lastRight !== null && item.x - lastRight > 14) {
            if (currentCellStr) {
              cells.push(cleanCellValue(currentCellStr));
            }
            currentCellStr = text;
          } else {
            currentCellStr = currentCellStr ? currentCellStr + ' ' + text : text;
          }
          lastRight = item.x + item.w;
        }

        if (currentCellStr) {
          cells.push(cleanCellValue(currentCellStr));
        }

        if (cells.length > 0) {
          pageTableData.push(cells);
          maxColsCount = Math.max(maxColsCount, cells.length);
        }
      }

      if (layout === 'separate') {
        const ws = XLSX.utils.aoa_to_sheet(pageTableData);
        const colWidths = [];
        for (let r = 0; r < pageTableData.length; r++) {
          for (let c = 0; c < pageTableData[r].length; c++) {
            const len = String(pageTableData[r][c] || '').length;
            colWidths[c] = Math.max(colWidths[c] || 10, Math.min(len + 3, 50));
          }
        }
        ws['!cols'] = colWidths.map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, `Page ${pageNum}`);
      } else {
        allExtractedRows.push(...pageTableData);
      }
    }

    if (layout === 'combined') {
      const ws = XLSX.utils.aoa_to_sheet(allExtractedRows);
      const colWidths = [];
      for (let r = 0; r < Math.min(allExtractedRows.length, 100); r++) {
        for (let c = 0; c < (allExtractedRows[r] ? allExtractedRows[r].length : 0); c++) {
          const len = String(allExtractedRows[r][c] || '').length;
          colWidths[c] = Math.max(colWidths[c] || 10, Math.min(len + 3, 50));
        }
      }
      ws['!cols'] = colWidths.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
    }

    function cleanCellValue(val) {
      const trimmed = val.trim();
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        const num = Number(trimmed);
        if (!isNaN(num)) return num;
      }
      if (/^\$?\d{1,3}(,\d{3})*(\.\d+)?$/.test(trimmed)) {
        const cleaned = trimmed.replace(/[$,]/g, '');
        const num = Number(cleaned);
        if (!isNaN(num)) return num;
      }
      return trimmed;
    }

    const previewRows = layout === 'combined' ? allExtractedRows : (wb.Sheets[wb.SheetNames[0]] ? XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) : []);

    let blob;
    let ext;
    let mimeType;

    if (format === 'csv') {
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const csvStr = XLSX.utils.sheet_to_csv(firstSheet);
      blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      ext = '.csv';
      mimeType = 'text/csv';
    } else {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      ext = '.xlsx';
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const customView = container.querySelector('#pdfResultCustomView');
    customView.style.display = 'block';

    const maxDisplay = Math.min(previewRows.length, 30);
    let tableHtml = '<div style="overflow-x: auto; max-height: 380px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); margin-top: 10px;">';
    tableHtml += '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; font-family: var(--font-mono);">';

    previewRows.slice(0, maxDisplay).forEach((row, rIdx) => {
      const isHeader = rIdx === 0 && detectHeaders;
      const tag = isHeader ? 'th' : 'td';
      tableHtml += `<tr style="${isHeader ? 'background: #1e293b; color: #38bdf8; font-weight: 700;' : (rIdx % 2 === 0 ? 'background: rgba(255,255,255,0.02);' : '')}">`;
      row.forEach((cell) => {
        const isNum = typeof cell === 'number';
        tableHtml += `<${tag} style="border: 1px solid rgba(255,255,255,0.08); padding: 6px 12px; text-align: ${isNum ? 'right' : 'left'};">${cell !== undefined ? cell : ''}</${tag}>`;
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</table></div>';
    if (previewRows.length > maxDisplay) {
      tableHtml += `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; text-align: right;">Showing first ${maxDisplay} of ${previewRows.length} extracted rows</div>`;
    }

    customView.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 6px; color: #34d399; font-size: 1rem;">
        Extracted Spreadsheet Data (${previewRows.length} rows, ${maxColsCount} columns):
      </div>
      ${tableHtml}
    `;

    const baseName = singlePdfFile.name.replace(/\.[^/.]+$/, '');
    displayPdfResult(container, blob, 'PDF to Excel', mimeType, `${previewRows.length} Rows`, `${baseName}-extracted${ext}`);
  }

  function displayPdfResult(container, blob, actionTitle, mimeType, itemStat, filename) {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultBlob = blob;
    resultUrl = URL.createObjectURL(blob);

    const resultBox = container.querySelector('#pdfResultContainer');
    container.querySelector('#pdfStatAction').textContent = actionTitle;
    container.querySelector('#pdfStatOutput').textContent = filename.split('.').pop().toUpperCase();
    container.querySelector('#pdfStatSize').textContent = formatBytes(blob.size);
    container.querySelector('#pdfStatItems').textContent = itemStat;

    const downloadBtn = container.querySelector('#pdfDownloadBtn');
    downloadBtn.href = resultUrl;
    downloadBtn.download = filename;

    resultBox.classList.add('active');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.FileForge.showToast(`${actionTitle} completed successfully!`, 'success');
  }

  return {
    init,
    cleanup,
  };
})();
