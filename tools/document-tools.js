/**
 * FileForge - Document Tools Suite
 * Browser-based Excel processing (via SheetJS) and DOCX processing (via Mammoth.js).
 * Features accurate column alignment detection (numbers right, codes center, text left),
 * landscape/portrait auto-selection, direct vector PDF generation via pdf-lib,
 * and high-fidelity print-to-PDF styles.
 */

window.FileForge = window.FileForge || {};
window.FileForge.DocumentTools = (function () {
  let currentFile = null;
  let activeSubtool = 'excel-to-pdf';
  let parsedWorkbook = null;
  let parsedWordHtml = null;
  let currentSheetName = null;
  let currentSheetData = null; // 2D array
  let columnAlignments = []; // 'left' | 'center' | 'right'
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
    currentFile = null;
    parsedWorkbook = null;
    parsedWordHtml = null;
    currentSheetName = null;
    currentSheetData = null;
    columnAlignments = [];
  }

  function init(containerEl, file = null, subtool = 'excel-to-pdf') {
    cleanup();
    activeSubtool = subtool;
    renderInterface(containerEl);
    if (file) {
      handleFileSelected(file, containerEl);
    }
  }

  function isUnsupported(subtool) {
    return [
      'word-to-excel',
      'excel-to-word',
      'excel-to-jpg',
      'powerpoint-to-pdf',
      'powerpoint-to-jpg',
    ].includes(subtool);
  }

  function renderInterface(container) {
    const unsupported = isUnsupported(activeSubtool);

    const titles = {
      'excel-to-pdf': { title: 'Excel to PDF', desc: 'Convert spreadsheet worksheets and CSV data into clean, accurately aligned PDF documents.' },
      'word-to-pdf': { title: 'Word to PDF', desc: 'Convert supported Word (.docx) documents into formatted PDF files.' },
      'word-to-jpg': { title: 'Word to JPG', desc: 'Render Word document pages into image previews.' },
      'word-to-excel': { title: 'Word to Excel', desc: 'Convert Word tables into Excel spreadsheets.' },
      'excel-to-word': { title: 'Excel to Word', desc: 'Convert spreadsheet sheets into Word document format.' },
      'excel-to-jpg': { title: 'Excel to JPG', desc: 'Render spreadsheets as image files.' },
      'powerpoint-to-pdf': { title: 'PowerPoint to PDF', desc: 'Convert PPTX presentation slides into PDF.' },
      'powerpoint-to-jpg': { title: 'PowerPoint to JPG', desc: 'Export presentation slides as JPG images.' },
    };

    const currentInfo = titles[activeSubtool] || { title: 'Document Tool', desc: 'Process document files in your browser.' };

    container.innerHTML = `
      <div class="tool-workspace">
        ${
          unsupported
            ? `
          <div class="notice-box">
            <div class="notice-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <div>
              <div class="notice-title">Browser-Only Security Notice</div>
              <p class="notice-desc">
                This conversion requires advanced document processing and is not currently available in browser-only mode.
                <br /><br />
                FileForge operates under a strict <strong>Zero Server Upload</strong> policy to safeguard your data. Complex proprietary presentations (.pptx) and deep cross-format document rasterizers require server-side headless office engines (like LibreOffice or MS Office automation) which cannot run reliably inside client-side JavaScript without compromising file privacy.
              </p>
            </div>
          </div>
        `
            : `
          <!-- Dropzone -->
          <div class="tool-dropzone" id="docDropzone">
            <div class="tool-dropzone-icon" style="background: rgba(16, 185, 129, 0.12); color: #34d399;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <h3 class="tool-dropzone-title">Drop your ${activeSubtool.includes('excel') ? 'Excel/CSV' : 'Word (.docx)'} file here</h3>
            <p class="tool-dropzone-sub">
              ${activeSubtool.includes('excel') ? 'Supports .xlsx, .xls, .csv' : 'Supports Microsoft Word .docx'} (Processed 100% locally)
            </p>
            <button class="btn btn-secondary" id="browseDocBtn">Browse File</button>
            <input type="file" id="docFileInput" class="file-input-hidden" accept="${activeSubtool.includes('excel') ? '.xlsx,.xls,.csv' : '.docx'}" />
          </div>

          <!-- Document Workspace -->
          <div id="docWorkspaceArea" style="display: none; flex-direction: column; gap: 24px;">
            <div class="file-meta-card">
              <div class="file-meta-info">
                <div class="file-meta-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                </div>
                <div class="file-meta-text">
                  <div class="file-meta-name" id="docFileName">file.xlsx</div>
                  <div class="file-meta-specs">
                    <span>Size: <strong id="docFileSize">0 KB</strong></span>
                    <span>•</span>
                    <span>Status: <strong id="docStatus">Loaded Locally</strong></span>
                    <span id="docSheetSpecs" style="display: none;">• Rows: <strong id="docRowCount">0</strong> • Cols: <strong id="docColCount">0</strong></span>
                  </div>
                </div>
              </div>
              <div class="file-meta-actions">
                <button class="btn btn-outline btn-sm" id="changeDocBtn">Change File</button>
              </div>
            </div>

            <!-- PDF Layout & Styling Settings (Only for Excel to PDF) -->
            ${
              activeSubtool.includes('excel')
                ? `
              <div class="tool-settings-grid" id="excelPdfSettingsGrid">
                <div class="setting-group" id="sheetSelectGroup" style="display: none;">
                  <label class="setting-label"><span>Active Sheet</span></label>
                  <select id="excelSheetSelect"></select>
                </div>
                <div class="setting-group">
                  <label class="setting-label"><span>Page Orientation</span></label>
                  <select id="excelPdfOrientation">
                    <option value="landscape" selected>Landscape (Recommended for wide tables)</option>
                    <option value="portrait">Portrait (Standard document)</option>
                  </select>
                </div>
                <div class="setting-group">
                  <label class="setting-label"><span>Column Fit</span></label>
                  <select id="excelPdfFit">
                    <option value="fit" selected>Fit All Columns to Page Width</option>
                    <option value="auto">Natural Proportional Width</option>
                  </select>
                </div>
                <div class="setting-group">
                  <label class="setting-label"><span>Paper Format</span></label>
                  <select id="excelPdfPaper">
                    <option value="a4" selected>A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                    <option value="legal">US Legal (8.5 × 14 in)</option>
                  </select>
                </div>
              </div>
            `
                : ''
            }

            <!-- Preview Card -->
            <div id="docPreviewContainer" style="background: rgba(7, 8, 14, 0.85); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px; max-height: 480px; overflow: auto;"></div>

            <!-- Action Controls -->
            <div style="display: flex; justify-content: flex-end; gap: 14px; flex-wrap: wrap;">
              ${
                activeSubtool.includes('excel')
                  ? `
                <button class="btn btn-outline btn-lg" id="printDocPdfBtn" type="button">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  <span>Print / Save as PDF</span>
                </button>
              `
                  : ''
              }
              <button class="btn btn-primary btn-lg" id="exportDocPdfBtn" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        `
        }
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    if (isUnsupported(activeSubtool)) return;

    const dropzone = container.querySelector('#docDropzone');
    const fileInput = container.querySelector('#docFileInput');
    const browseBtn = container.querySelector('#browseDocBtn');
    const changeBtn = container.querySelector('#changeDocBtn');
    const exportBtn = container.querySelector('#exportDocPdfBtn');
    const printBtn = container.querySelector('#printDocPdfBtn');
    const orientationSel = container.querySelector('#excelPdfOrientation');
    const fitSel = container.querySelector('#excelPdfFit');
    const sheetSel = container.querySelector('#excelSheetSelect');

    browseBtn.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    changeBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelected(e.target.files[0], container);
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
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelected(e.dataTransfer.files[0], container);
      }
    });

    exportBtn.addEventListener('click', () => {
      if (activeSubtool.includes('excel')) {
        generateDirectExcelPdf(container);
      } else {
        exportWordToPdf(container);
      }
    });

    if (printBtn) {
      printBtn.addEventListener('click', () => printExcelToPdf(container));
    }

    if (orientationSel) {
      orientationSel.addEventListener('change', () => {
        renderExcelTablePreview(container);
      });
    }

    if (fitSel) {
      fitSel.addEventListener('change', () => {
        renderExcelTablePreview(container);
      });
    }

    if (sheetSel) {
      sheetSel.addEventListener('change', () => {
        if (parsedWorkbook && sheetSel.value) {
          currentSheetName = sheetSel.value;
          loadSelectedSheet(container, currentSheetName);
        }
      });
    }
  }

  async function handleFileSelected(file, container) {
    currentFile = file;
    container.querySelector('#docFileName').textContent = file.name;
    container.querySelector('#docFileSize').textContent = formatBytes(file.size);

    container.querySelector('#docDropzone').style.display = 'none';
    container.querySelector('#docWorkspaceArea').style.display = 'flex';

    const previewBox = container.querySelector('#docPreviewContainer');
    previewBox.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 20px;">Analyzing document...</div>';

    try {
      if (activeSubtool.includes('excel')) {
        await parseExcelFile(file, container);
      } else {
        await parseWordFile(file, previewBox);
      }
    } catch (err) {
      console.error('Doc parse error:', err);
      previewBox.innerHTML = `<div style="color: #f87171; padding: 20px;">Failed to parse: ${err.message}</div>`;
      window.FileForge.showToast('Failed to parse file: ' + err.message, 'error');
    }
  }

  async function parseExcelFile(file, container) {
    if (!window.XLSX) {
      container.querySelector('#docPreviewContainer').innerHTML = '<div style="color: #f87171;">SheetJS library not loaded.</div>';
      return;
    }

    const data = await file.arrayBuffer();
    parsedWorkbook = XLSX.read(data, { type: 'array' });

    // Populate sheet selector if multiple sheets exist
    const sheetSel = container.querySelector('#excelSheetSelect');
    const sheetGroup = container.querySelector('#sheetSelectGroup');
    if (parsedWorkbook.SheetNames.length > 1 && sheetSel && sheetGroup) {
      sheetGroup.style.display = 'flex';
      sheetSel.innerHTML = parsedWorkbook.SheetNames.map((name) => `<option value="${name}">${name}</option>`).join('');
    }

    currentSheetName = parsedWorkbook.SheetNames[0];
    loadSelectedSheet(container, currentSheetName);
  }

  function loadSelectedSheet(container, sheetName) {
    const worksheet = parsedWorkbook.Sheets[sheetName];
    // Read as 2D array of rows
    const rawAoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawAoa || rawAoa.length === 0) {
      container.querySelector('#docPreviewContainer').innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Worksheet contains no data.</div>';
      return;
    }

    currentSheetData = rawAoa;
    const numRows = currentSheetData.length;
    let numCols = 0;
    currentSheetData.forEach((row) => {
      if (row.length > numCols) numCols = row.length;
    });

    // Update specs bar
    const specsSpan = container.querySelector('#docSheetSpecs');
    if (specsSpan) {
      specsSpan.style.display = 'inline-flex';
      container.querySelector('#docRowCount').textContent = numRows;
      container.querySelector('#docColCount').textContent = numCols;
    }

    // Auto-detect column alignments based on data types
    columnAlignments = detectColumnAlignments(currentSheetData, numCols);

    // Auto-select orientation: if > 6 columns, landscape is best
    const orientationSel = container.querySelector('#excelPdfOrientation');
    if (orientationSel) {
      if (numCols > 6) {
        orientationSel.value = 'landscape';
      } else {
        orientationSel.value = 'portrait';
      }
    }

    renderExcelTablePreview(container);
  }

  function detectColumnAlignments(aoa, numCols) {
    const alignments = [];
    const numRows = aoa.length;

    for (let c = 0; c < numCols; c++) {
      let numCount = 0;
      let shortCodeCount = 0;
      let totalNonEmpty = 0;

      // Inspect data rows starting from row 1 (row 0 is header)
      for (let r = 1; r < numRows; r++) {
        const val = aoa[r][c];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          totalNonEmpty++;
          const str = String(val).trim();

          // Check if purely numeric or currency / percentage
          if (/^-?\$?\d{1,3}(,\d{3})*(\.\d+)?%?$/.test(str) || typeof val === 'number') {
            numCount++;
          } else if (str.length <= 8) {
            // Short codes, IDs, statuses, semesters, grades (e.g. CS8201, PASS, FAIL, 2, CSE)
            shortCodeCount++;
          }
        }
      }

      if (totalNonEmpty === 0) {
        alignments[c] = 'left';
      } else if (numCount / totalNonEmpty >= 0.55) {
        alignments[c] = 'right';
      } else if (shortCodeCount / totalNonEmpty >= 0.55) {
        alignments[c] = 'center';
      } else {
        alignments[c] = 'left';
      }
    }

    return alignments;
  }

  function renderExcelTablePreview(container) {
    const previewBox = container.querySelector('#docPreviewContainer');
    if (!currentSheetData || currentSheetData.length === 0) return;

    const numRows = currentSheetData.length;
    const numCols = columnAlignments.length;
    const isWide = numCols > 8;

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.9rem;">
        <span style="font-weight: 700; color: #34d399;">
          Sheet: ${currentSheetName} (${numRows} rows, ${numCols} columns)
        </span>
        <span style="color: var(--text-muted); font-size: 0.8rem;">
          Alignments auto-calibrated: Numbers ➔ Right • Codes ➔ Center • Text ➔ Left
        </span>
      </div>
      <div style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
        <table class="excel-preview-table" style="width: 100%; border-collapse: collapse; font-family: var(--font-sans); font-size: ${isWide ? '0.78rem' : '0.85rem'};">
    `;

    currentSheetData.forEach((row, rIdx) => {
      const isHeader = rIdx === 0;
      const rowBg = isHeader ? '#1e293b' : rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
      const textColor = isHeader ? '#38bdf8' : 'var(--text-light)';
      const fontWeight = isHeader ? '700' : 'normal';

      html += `<tr style="background: ${rowBg};">`;

      for (let c = 0; c < numCols; c++) {
        const cellVal = row[c] !== undefined && row[c] !== null ? row[c] : '';
        const align = columnAlignments[c] || 'left';
        const tag = isHeader ? 'th' : 'td';
        const tabularNums = align === 'right' ? 'font-variant-numeric: tabular-nums;' : '';
        const padding = isWide ? '5px 8px' : '8px 12px';

        html += `
          <${tag} style="border: 1px solid rgba(255,255,255,0.08); padding: ${padding}; text-align: ${align}; color: ${textColor}; font-weight: ${fontWeight}; ${tabularNums} white-space: nowrap;">
            ${cellVal}
          </${tag}>
        `;
      }

      html += '</tr>';
    });

    html += '</table></div>';
    previewBox.innerHTML = html;
  }

  async function parseWordFile(file, previewBox) {
    if (!window.mammoth) {
      previewBox.innerHTML = '<div style="color: #f87171;">Mammoth library not loaded.</div>';
      return;
    }

    const arrayBuf = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
    parsedWordHtml = result.value;

    previewBox.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 12px; color: #34d399;">Formatted Document Preview:</div>
      <div style="color: var(--text-light); line-height: 1.6; font-size: 0.95rem; background: rgba(0,0,0,0.3); padding: 24px; border-radius: 8px;">
        ${parsedWordHtml || '<em>(Document contains no renderable text)</em>'}
      </div>
    `;
  }

  // Direct Vector PDF Generation via pdf-lib
  async function generateDirectExcelPdf(container) {
    if (!window.PDFLib) {
      window.FileForge.showToast('PDF-Lib loading. Using Print dialog...', 'info');
      printExcelToPdf(container);
      return;
    }

    if (!currentSheetData || currentSheetData.length === 0) {
      window.FileForge.showToast('No spreadsheet data to convert.', 'error');
      return;
    }

    window.FileForge.showToast('Generating calibrated PDF document...', 'info');

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

      const orientation = container.querySelector('#excelPdfOrientation').value;
      const paper = container.querySelector('#excelPdfPaper').value;

      // Determine dimensions
      let pageW = 841.89; // A4 Landscape
      let pageH = 595.28;

      if (paper === 'letter') {
        pageW = orientation === 'landscape' ? 792.0 : 612.0;
        pageH = orientation === 'landscape' ? 612.0 : 792.0;
      } else if (paper === 'legal') {
        pageW = orientation === 'landscape' ? 1008.0 : 612.0;
        pageH = orientation === 'landscape' ? 612.0 : 1008.0;
      } else {
        pageW = orientation === 'landscape' ? 841.89 : 595.28;
        pageH = orientation === 'landscape' ? 595.28 : 841.89;
      }

      const marginX = 28;
      const marginY = 32;
      const usableWidth = pageW - marginX * 2;
      const numCols = columnAlignments.length;

      // Font sizing and row height scaled by column count
      let fontSize = 9;
      let rowHeight = 18;
      if (numCols > 12) {
        fontSize = 7.5;
        rowHeight = 15;
      } else if (numCols > 8) {
        fontSize = 8.5;
        rowHeight = 17;
      }

      // Calculate column widths based on maximum string lengths
      const colLengths = [];
      for (let c = 0; c < numCols; c++) {
        let maxL = 6;
        for (let r = 0; r < Math.min(currentSheetData.length, 100); r++) {
          const s = String(currentSheetData[r][c] || '');
          if (s.length > maxL) maxL = s.length;
        }
        colLengths[c] = Math.min(maxL, 35);
      }

      const totalWeight = colLengths.reduce((a, b) => a + b, 0);
      const colWidths = colLengths.map((len) => Math.max((len / totalWeight) * usableWidth, 24));

      // Re-normalize column widths to sum precisely to usableWidth
      const sumW = colWidths.reduce((a, b) => a + b, 0);
      const scaleFactor = usableWidth / sumW;
      for (let i = 0; i < colWidths.length; i++) {
        colWidths[i] *= scaleFactor;
      }

      // Cumulative X positions for each column
      const colX = [];
      let curX = marginX;
      for (let c = 0; c < numCols; c++) {
        colX[c] = curX;
        curX += colWidths[c];
      }

      let page = pdfDoc.addPage([pageW, pageH]);
      let curY = pageH - marginY;

      // Draw Document Title
      const titleStr = `${currentFile.name.replace(/\.[^/.]+$/, '')} — ${currentSheetName}`;
      page.drawText(titleStr, {
        x: marginX,
        y: curY,
        size: fontSize + 4,
        font: fontBold,
        color: PDFLib.rgb(0.12, 0.16, 0.24),
      });
      curY -= rowHeight + 8;

      function drawHeaderRow() {
        // Background fill for header
        page.drawRectangle({
          x: marginX,
          y: curY - rowHeight + 3,
          width: usableWidth,
          height: rowHeight,
          color: PDFLib.rgb(0.12, 0.16, 0.23), // Dark Navy
        });

        // Header cells
        for (let c = 0; c < numCols; c++) {
          const headerText = String(currentSheetData[0][c] || '');
          const align = columnAlignments[c] || 'left';
          const maxTextW = colWidths[c] - 6;

          let displayStr = headerText;
          while (fontBold.widthOfTextAtSize(displayStr, fontSize) > maxTextW && displayStr.length > 2) {
            displayStr = displayStr.slice(0, -1);
          }
          if (displayStr !== headerText) displayStr += '..';

          const textW = fontBold.widthOfTextAtSize(displayStr, fontSize);
          let tx = colX[c] + 4;
          if (align === 'right') {
            tx = colX[c] + colWidths[c] - textW - 4;
          } else if (align === 'center') {
            tx = colX[c] + (colWidths[c] - textW) / 2;
          }

          page.drawText(displayStr, {
            x: tx,
            y: curY - 9,
            size: fontSize,
            font: fontBold,
            color: PDFLib.rgb(1, 1, 1),
          });
        }
        curY -= rowHeight;
      }

      drawHeaderRow();

      // Data rows
      for (let r = 1; r < currentSheetData.length; r++) {
        // Page break if bottom reached
        if (curY - rowHeight < marginY) {
          page = pdfDoc.addPage([pageW, pageH]);
          curY = pageH - marginY;
          drawHeaderRow();
        }

        const row = currentSheetData[r];
        const isEven = r % 2 === 0;

        // Alternating row background
        if (isEven) {
          page.drawRectangle({
            x: marginX,
            y: curY - rowHeight + 3,
            width: usableWidth,
            height: rowHeight,
            color: PDFLib.rgb(0.97, 0.98, 0.99),
          });
        }

        // Draw horizontal gridline
        page.drawLine({
          start: { x: marginX, y: curY - rowHeight + 3 },
          end: { x: marginX + usableWidth, y: curY - rowHeight + 3 },
          thickness: 0.5,
          color: PDFLib.rgb(0.88, 0.91, 0.94),
        });

        // Cell contents
        for (let c = 0; c < numCols; c++) {
          const valStr = String(row[c] !== undefined && row[c] !== null ? row[c] : '');
          const align = columnAlignments[c] || 'left';
          const maxTextW = colWidths[c] - 6;

          let displayStr = valStr;
          while (font.widthOfTextAtSize(displayStr, fontSize) > maxTextW && displayStr.length > 2) {
            displayStr = displayStr.slice(0, -1);
          }
          if (displayStr !== valStr && displayStr.length > 3) displayStr = displayStr.slice(0, -2) + '..';

          const textW = font.widthOfTextAtSize(displayStr, fontSize);
          let tx = colX[c] + 4;
          if (align === 'right') {
            tx = colX[c] + colWidths[c] - textW - 4;
          } else if (align === 'center') {
            tx = colX[c] + (colWidths[c] - textW) / 2;
          }

          page.drawText(displayStr, {
            x: tx,
            y: curY - 9,
            size: fontSize,
            font: font,
            color: PDFLib.rgb(0.15, 0.18, 0.24),
          });
        }

        curY -= rowHeight;
      }

      // Outer border around whole table
      page.drawRectangle({
        x: marginX,
        y: curY + 3,
        width: usableWidth,
        height: pageH - marginY - curY - rowHeight - 8,
        borderColor: PDFLib.rgb(0.75, 0.8, 0.86),
        borderWidth: 0.75,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'document';
      const cleanSheetName = currentSheetName ? currentSheetName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Sheet';
      const filename = `${baseName}-${cleanSheetName}.pdf`;

      if (window.FileForge && typeof window.FileForge.downloadBlob === 'function') {
        window.FileForge.downloadBlob(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
      }

      window.FileForge.showToast('Accurate PDF generated and downloaded!', 'success');
    } catch (err) {
      console.error('PDF Generation error:', err);
      window.FileForge.showToast('Direct PDF failed, opening Print dialog...', 'info');
      printExcelToPdf(container);
    }
  }

  // High-Fidelity Print-to-PDF Window with Accurate Column Alignments & CSS @page
  function printExcelToPdf(container) {
    if (!currentSheetData || currentSheetData.length === 0) return;

    window.FileForge.showToast('Opening print dialog with calibrated alignments...', 'info');

    const orientation = container.querySelector('#excelPdfOrientation').value;
    const paper = container.querySelector('#excelPdfPaper').value;
    const numCols = columnAlignments.length;
    const isWide = numCols > 8;

    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) {
      window.FileForge.showToast('Popup blocked. Please allow popups or use "Download PDF".', 'error');
      return;
    }

    let rowsHtml = '';
    currentSheetData.forEach((row, rIdx) => {
      const isHeader = rIdx === 0;
      const tag = isHeader ? 'th' : 'td';
      rowsHtml += '<tr>';
      for (let c = 0; c < numCols; c++) {
        const align = columnAlignments[c] || 'left';
        const val = row[c] !== undefined && row[c] !== null ? row[c] : '';
        rowsHtml += `<${tag} class="col-align-${align}">${val}</${tag}>`;
      }
      rowsHtml += '</tr>';
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${currentFile.name} — ${currentSheetName}</title>
          <style>
            @page {
              size: ${paper} ${orientation};
              margin: 10mm;
            }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 15px;
            }
            .header-bar {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .title {
              font-size: 16px;
              font-weight: 800;
              color: #0f172a;
            }
            .meta {
              font-size: 11px;
              color: #64748b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: ${isWide ? '10px' : '12px'};
              line-height: 1.35;
              table-layout: auto;
            }
            thead {
              display: table-header-group;
            }
            tr {
              page-break-inside: avoid;
            }
            th {
              background-color: #1e293b !important;
              color: #ffffff !important;
              font-weight: 700;
              padding: ${isWide ? '5px 6px' : '8px 10px'};
              border: 1px solid #334155;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            td {
              padding: ${isWide ? '4px 6px' : '7px 10px'};
              border: 1px solid #cbd5e1;
            }
            tr:nth-child(even) td {
              background-color: #f8fafc !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /* Explicit Column Alignments */
            .col-align-right {
              text-align: right !important;
              font-variant-numeric: tabular-nums;
            }
            .col-align-center {
              text-align: center !important;
            }
            .col-align-left {
              text-align: left !important;
            }
            @media print {
              body { padding: 0; }
              th { background-color: #1e293b !important; color: #ffffff !important; }
              tr:nth-child(even) td { background-color: #f8fafc !important; }
            }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div class="title">${currentFile.name} — ${currentSheetName}</div>
            <div class="meta">Exported via FileForge Client Engine • ${currentSheetData.length} Rows • ${numCols} Columns</div>
          </div>
          <table>
            <thead>
              ${rowsHtml.slice(0, rowsHtml.indexOf('</tr>') + 5)}
            </thead>
            <tbody>
              ${rowsHtml.slice(rowsHtml.indexOf('</tr>') + 5)}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function exportWordToPdf(container) {
    const previewBox = container.querySelector('#docPreviewContainer');
    if (!previewBox) return;

    window.FileForge.showToast('Opening print dialog for Word document...', 'info');

    const printWindow = window.open('', '_blank', 'width=850,height=900');
    if (!printWindow) {
      window.FileForge.showToast('Popup blocked. Please allow popups.', 'error');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${currentFile.name} - FileForge Export</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #ccc; padding: 8px 12px; }
            th { background: #f4f4f4; font-weight: bold; }
            h1, h2, h3 { color: #222; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h2>${currentFile.name}</h2>
          <hr style="border: 0; border-top: 1px solid #ddd; margin-bottom: 20px;" />
          ${previewBox.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return {
    init,
    cleanup,
  };
})();
