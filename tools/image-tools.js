/**
 * FileForge - Image Tools Suite
 * Handles Image Resizer, Image Converter, Specific Formats (JPG<->PNG<->WebP),
 * Image Cropper, and Image to PDF (via pdf-lib).
 */

window.FileForge = window.FileForge || {};
window.FileForge.ImageTools = (function () {
  let currentFile = null;
  let currentImgUrl = null;
  let currentImg = null;
  let processedBlob = null;
  let processedUrl = null;
  let activeSubtool = 'resizer'; // 'resizer' | 'converter' | 'cropper' | 'to-pdf'
  let multipleFiles = []; // for Image to PDF

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function cleanup() {
    if (currentImgUrl) URL.revokeObjectURL(currentImgUrl);
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    currentImgUrl = null;
    processedUrl = null;
    currentFile = null;
    currentImg = null;
    processedBlob = null;
    multipleFiles = [];
  }

  function init(containerEl, file = null, subtool = 'resizer') {
    cleanup();
    activeSubtool = subtool;
    renderInterface(containerEl);
    if (file) {
      if (Array.isArray(file)) {
        handleMultipleFiles(file, containerEl);
      } else {
        handleFileSelected(file, containerEl);
      }
    }
  }

  function renderInterface(container) {
    const isToPdf = activeSubtool === 'to-pdf';
    const isCropper = activeSubtool === 'cropper';
    const isConverter = activeSubtool.includes('to') || activeSubtool === 'converter';

    let toolTitle = 'Image Resizer';
    let toolSub = 'Resize your image by dimensions, percentage, or social media presets.';
    if (isToPdf) {
      toolTitle = 'Image to PDF';
      toolSub = 'Combine one or multiple images into a clean, downloadable PDF document.';
    } else if (isCropper) {
      toolTitle = 'Image Cropper';
      toolSub = 'Crop, rotate, and frame your photos with aspect ratio presets.';
    } else if (isConverter) {
      toolTitle = 'Image Converter';
      toolSub = 'Convert images instantly between JPG, PNG, WebP, and BMP formats.';
    }

    container.innerHTML = `
      <div class="tool-workspace">
        <!-- Dropzone -->
        <div class="tool-dropzone" id="subImgDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h3 class="tool-dropzone-title">Drop your image${isToPdf ? 's' : ''} here</h3>
          <p class="tool-dropzone-sub">Supports JPG, PNG, WebP, GIF, BMP ${isToPdf ? '(Select multiple)' : ''}</p>
          <button class="btn btn-secondary" id="browseSubImgBtn">Browse Files</button>
          <input type="file" id="subImgInput" class="file-input-hidden" accept="image/*" ${isToPdf ? 'multiple' : ''} />
        </div>

        <!-- Tool Content Area -->
        <div id="subImgWorkspace" style="display: none; flex-direction: column; gap: 24px;">
          <div class="file-meta-card">
            <div class="file-meta-info">
              <div class="file-meta-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <div class="file-meta-text">
                <div class="file-meta-name" id="subImgName">image.jpg</div>
                <div class="file-meta-specs">
                  <span>Size: <strong id="subImgSize">0 KB</strong></span>
                  <span>•</span>
                  <span>Dimensions: <strong id="subImgDims">0 × 0</strong></span>
                </div>
              </div>
            </div>
            <div class="file-meta-actions">
              <button class="btn btn-outline btn-sm" id="subImgChangeBtn">Change File</button>
            </div>
          </div>

          <!-- Dynamic Controls based on subtool -->
          <div id="subtoolControlsContainer"></div>

          <!-- Live Preview / Canvas Container -->
          <div class="media-preview-container" id="previewArea">
            <img id="subtoolPreviewImg" class="media-preview-player" style="max-height: 420px; object-fit: contain;" />
            <canvas id="cropCanvas" style="display: none; max-width: 100%; max-height: 420px;"></canvas>
            <div id="pdfMultiThumbs" class="multi-preview-grid" style="display: none;"></div>
          </div>

          <!-- Action Button -->
          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button class="btn btn-primary btn-lg" id="applySubtoolBtn">
              <span>Process Image</span>
            </button>
          </div>
        </div>

        <!-- Result Card -->
        <div class="tool-result-container" id="subImgResult">
          <div class="result-heading">
            <h3 class="result-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Operation Completed!
            </h3>
            <span class="result-badge-success">Ready to Download</span>
          </div>

          <div class="result-stats-grid">
            <div class="stat-box">
              <div class="stat-label">Original</div>
              <div class="stat-value" id="subOrigStat">0 KB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Result Size</div>
              <div class="stat-value highlight" id="subResultStat">0 KB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Output Format</div>
              <div class="stat-value highlight" id="subFormatStat">PNG</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Result Dimensions</div>
              <div class="stat-value highlight" id="subDimsStat">-</div>
            </div>
          </div>

          <div class="media-preview-container" id="resultPreviewBox">
            <img id="resultImagePreview" class="media-preview-player" style="max-height: 380px; object-fit: contain;" />
          </div>

          <div class="result-actions-row">
            <button class="btn btn-secondary" id="subResetBtn">Process Another</button>
            <a class="btn btn-primary btn-lg" id="subDownloadBtn" download="result.png">
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
    const dropzone = container.querySelector('#subImgDropzone');
    const fileInput = container.querySelector('#subImgInput');
    const browseBtn = container.querySelector('#browseSubImgBtn');
    const changeBtn = container.querySelector('#subImgChangeBtn');
    const applyBtn = container.querySelector('#applySubtoolBtn');
    const resetBtn = container.querySelector('#subResetBtn');

    browseBtn.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    changeBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        if (activeSubtool === 'to-pdf' && e.target.files.length > 1) {
          handleMultipleFiles(Array.from(e.target.files), container);
        } else {
          handleFileSelected(e.target.files[0], container);
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
        if (activeSubtool === 'to-pdf' && e.dataTransfer.files.length > 1) {
          handleMultipleFiles(Array.from(e.dataTransfer.files), container);
        } else {
          handleFileSelected(e.dataTransfer.files[0], container);
        }
      }
    });

    applyBtn.addEventListener('click', () => processTool(container));
    resetBtn.addEventListener('click', () => {
      cleanup();
      container.querySelector('#subImgResult').classList.remove('active');
      container.querySelector('#subImgWorkspace').style.display = 'none';
      container.querySelector('#subImgDropzone').style.display = 'block';
    });
  }

  function handleFileSelected(file, container) {
    currentFile = file;
    if (currentImgUrl) URL.revokeObjectURL(currentImgUrl);
    currentImgUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      currentImg = img;
      container.querySelector('#subImgName').textContent = file.name;
      container.querySelector('#subImgSize').textContent = formatBytes(file.size);
      container.querySelector('#subImgDims').textContent = `${img.naturalWidth} × ${img.naturalHeight}`;

      container.querySelector('#subImgDropzone').style.display = 'none';
      container.querySelector('#subImgWorkspace').style.display = 'flex';
      container.querySelector('#subImgResult').classList.remove('active');

      const previewImg = container.querySelector('#subtoolPreviewImg');
      previewImg.src = currentImgUrl;
      previewImg.style.display = 'block';

      renderSubtoolControls(container);
    };
    img.src = currentImgUrl;
  }

  function handleMultipleFiles(files, container) {
    multipleFiles = files.filter((f) => f.type.startsWith('image/'));
    if (multipleFiles.length === 0) return;

    currentFile = multipleFiles[0];
    const totalSize = multipleFiles.reduce((acc, cur) => acc + cur.size, 0);

    container.querySelector('#subImgName').textContent = `${multipleFiles.length} Images Selected`;
    container.querySelector('#subImgSize').textContent = formatBytes(totalSize);
    container.querySelector('#subImgDims').textContent = 'Multi-page Document';

    container.querySelector('#subImgDropzone').style.display = 'none';
    container.querySelector('#subImgWorkspace').style.display = 'flex';
    container.querySelector('#subtoolPreviewImg').style.display = 'none';

    const multiBox = container.querySelector('#pdfMultiThumbs');
    multiBox.style.display = 'grid';
    multiBox.innerHTML = '';

    multipleFiles.forEach((file) => {
      const u = URL.createObjectURL(file);
      const card = document.createElement('div');
      card.className = 'preview-thumb-card';
      card.innerHTML = `
        <img src="${u}" class="preview-thumb-img" />
        <div class="preview-thumb-name">${file.name}</div>
        <div class="preview-thumb-size">${formatBytes(file.size)}</div>
      `;
      multiBox.appendChild(card);
    });

    renderSubtoolControls(container);
  }

  function renderSubtoolControls(container) {
    const controlsBox = container.querySelector('#subtoolControlsContainer');
    const applyBtn = container.querySelector('#applySubtoolBtn');

    if (activeSubtool === 'resizer') {
      applyBtn.innerHTML = `<span>Resize Image</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <!-- Preset Scales -->
          <div class="setting-group">
            <label class="setting-label"><span>Quick Scale</span></label>
            <div class="preset-radio-group">
              <button type="button" class="btn btn-outline btn-sm quick-scale-btn" data-scale="0.25">25%</button>
              <button type="button" class="btn btn-outline btn-sm quick-scale-btn" data-scale="0.5">50%</button>
              <button type="button" class="btn btn-outline btn-sm quick-scale-btn" data-scale="0.75">75%</button>
              <button type="button" class="btn btn-outline btn-sm quick-scale-btn" data-scale="2">200%</button>
            </div>
          </div>

          <!-- Social Media Presets -->
          <div class="setting-group">
            <label class="setting-label"><span>Social Presets</span></label>
            <select id="socialPresetSelect">
              <option value="">Custom Dimensions</option>
              <option value="1080x1080">Instagram Square (1080 × 1080)</option>
              <option value="1080x1920">Instagram Story / Reel (1080 × 1920)</option>
              <option value="1280x720">YouTube Thumbnail (1280 × 720)</option>
              <option value="1200x675">Twitter/X Post (1200 × 675)</option>
              <option value="1200x630">Facebook Share (1200 × 630)</option>
            </select>
          </div>

          <!-- Width & Height -->
          <div class="setting-group">
            <label class="setting-label"><span>Target Dimensions</span></label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="number" id="resizeW" value="${currentImg ? currentImg.naturalWidth : 800}" />
              <span>×</span>
              <input type="number" id="resizeH" value="${currentImg ? currentImg.naturalHeight : 600}" />
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; margin-top: 4px;">
              <input type="checkbox" id="aspectLock" checked />
              <span>Lock Aspect Ratio</span>
            </label>
          </div>
        </div>
      `;

      const wInput = controlsBox.querySelector('#resizeW');
      const hInput = controlsBox.querySelector('#resizeH');
      const lockCheck = controlsBox.querySelector('#aspectLock');
      const socialSelect = controlsBox.querySelector('#socialPresetSelect');

      controlsBox.querySelectorAll('.quick-scale-btn').forEach((b) => {
        b.addEventListener('click', () => {
          const s = parseFloat(b.dataset.scale);
          if (currentImg) {
            wInput.value = Math.round(currentImg.naturalWidth * s);
            hInput.value = Math.round(currentImg.naturalHeight * s);
          }
        });
      });

      socialSelect.addEventListener('change', () => {
        if (socialSelect.value) {
          const [w, h] = socialSelect.value.split('x');
          wInput.value = w;
          hInput.value = h;
          lockCheck.checked = false;
        }
      });

      wInput.addEventListener('input', () => {
        if (lockCheck.checked && currentImg) {
          const ratio = currentImg.naturalHeight / currentImg.naturalWidth;
          hInput.value = Math.round(parseInt(wInput.value || 0, 10) * ratio);
        }
      });

      hInput.addEventListener('input', () => {
        if (lockCheck.checked && currentImg) {
          const ratio = currentImg.naturalWidth / currentImg.naturalHeight;
          wInput.value = Math.round(parseInt(hInput.value || 0, 10) * ratio);
        }
      });
    } else if (activeSubtool === 'to-pdf') {
      applyBtn.innerHTML = `<span>Generate PDF</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Page Size</span></label>
            <select id="pdfPageSize">
              <option value="fit" selected>Fit Page to Image</option>
              <option value="a4_p">A4 Portrait</option>
              <option value="a4_l">A4 Landscape</option>
              <option value="letter_p">US Letter Portrait</option>
            </select>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Page Margin</span></label>
            <select id="pdfPageMargin">
              <option value="0">No Margins (Edge-to-Edge)</option>
              <option value="20" selected>Standard (20 pt)</option>
              <option value="40">Wide (40 pt)</option>
            </select>
          </div>
        </div>
      `;
    } else if (activeSubtool === 'cropper') {
      applyBtn.innerHTML = `<span>Crop & Save</span>`;
      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Aspect Ratio Preset</span></label>
            <div class="preset-radio-group">
              <button type="button" class="btn btn-outline btn-sm crop-ratio-btn active" data-ratio="free">Free</button>
              <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" data-ratio="1:1">1:1 Square</button>
              <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" data-ratio="16:9">16:9 HD</button>
              <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" data-ratio="4:3">4:3 Standard</button>
              <button type="button" class="btn btn-outline btn-sm crop-ratio-btn" data-ratio="9:16">9:16 Story</button>
            </div>
          </div>
          <div class="setting-group">
            <label class="setting-label"><span>Rotation</span></label>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="rotateLeftBtn">↺ Rotate 90° Left</button>
              <button type="button" class="btn btn-secondary btn-sm" id="rotateRightBtn">↻ Rotate 90° Right</button>
            </div>
          </div>
        </div>
      `;
      initCropperCanvas(container);
    } else {
      // Converter
      applyBtn.innerHTML = `<span>Convert Image</span>`;
      let defaultTarget = 'image/png';
      if (activeSubtool === 'jpg-to-png') defaultTarget = 'image/png';
      else if (activeSubtool === 'png-to-jpg' || activeSubtool === 'webp-to-jpg') defaultTarget = 'image/jpeg';
      else if (activeSubtool === 'jpg-to-webp' || activeSubtool === 'png-to-webp') defaultTarget = 'image/webp';

      controlsBox.innerHTML = `
        <div class="tool-settings-grid">
          <div class="setting-group">
            <label class="setting-label"><span>Target Format</span></label>
            <select id="converterTargetSelect">
              <option value="image/png" ${defaultTarget === 'image/png' ? 'selected' : ''}>PNG (Lossless, Transparency)</option>
              <option value="image/jpeg" ${defaultTarget === 'image/jpeg' ? 'selected' : ''}>JPG / JPEG (Universal)</option>
              <option value="image/webp" ${defaultTarget === 'image/webp' ? 'selected' : ''}>WebP (High Efficiency)</option>
              <option value="image/bmp">BMP (Raw Bitmap)</option>
            </select>
          </div>
          <div class="setting-group" id="bgColorSetting" style="display: ${defaultTarget === 'image/jpeg' ? 'flex' : 'none'};">
            <label class="setting-label"><span>Background Color (for transparent PNGs)</span></label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="color" id="bgHexColor" value="#FFFFFF" style="width: 50px; height: 38px; padding: 2px;" />
              <span style="font-size: 0.85rem; color: var(--text-muted);">Replaces transparent alpha</span>
            </div>
          </div>
        </div>
      `;

      const targetSel = controlsBox.querySelector('#converterTargetSelect');
      const bgBox = controlsBox.querySelector('#bgColorSetting');
      targetSel.addEventListener('change', () => {
        bgBox.style.display = targetSel.value === 'image/jpeg' ? 'flex' : 'none';
      });
    }
  }

  // Cropper interactive canvas
  let cropState = {
    x: 20,
    y: 20,
    w: 200,
    h: 200,
    rotation: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    fixedRatio: null,
  };

  function initCropperCanvas(container) {
    const canvas = container.querySelector('#cropCanvas');
    const previewImg = container.querySelector('#subtoolPreviewImg');
    previewImg.style.display = 'none';
    canvas.style.display = 'block';

    if (!currentImg) return;
    canvas.width = currentImg.naturalWidth;
    canvas.height = currentImg.naturalHeight;
    cropState.w = Math.min(canvas.width * 0.8, 400);
    cropState.h = Math.min(canvas.height * 0.8, 300);
    cropState.x = (canvas.width - cropState.w) / 2;
    cropState.y = (canvas.height - cropState.h) / 2;

    drawCropCanvas(canvas);

    // Mouse events for box drag
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      if (mouseX >= cropState.x && mouseX <= cropState.x + cropState.w && mouseY >= cropState.y && mouseY <= cropState.y + cropState.h) {
        dragging = true;
        dragStartX = mouseX - cropState.x;
        dragStartY = mouseY - cropState.y;
      }
    };

    window.onmousemove = (e) => {
      if (!dragging) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      cropState.x = Math.max(0, Math.min(mouseX - dragStartX, canvas.width - cropState.w));
      cropState.y = Math.max(0, Math.min(mouseY - dragStartY, canvas.height - cropState.h));
      drawCropCanvas(canvas);
    };

    window.onmouseup = () => {
      dragging = false;
    };

    // Ratio buttons
    container.querySelectorAll('.crop-ratio-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.crop-ratio-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const r = btn.dataset.ratio;
        if (r === 'free') {
          cropState.fixedRatio = null;
        } else if (r === '1:1') {
          cropState.fixedRatio = 1;
          cropState.h = cropState.w;
        } else if (r === '16:9') {
          cropState.fixedRatio = 16 / 9;
          cropState.h = cropState.w / (16 / 9);
        } else if (r === '4:3') {
          cropState.fixedRatio = 4 / 3;
          cropState.h = cropState.w / (4 / 3);
        } else if (r === '9:16') {
          cropState.fixedRatio = 9 / 16;
          cropState.h = cropState.w / (9 / 16);
        }
        drawCropCanvas(canvas);
      });
    });

    container.querySelector('#rotateRightBtn').addEventListener('click', () => {
      cropState.rotation = (cropState.rotation + 90) % 360;
      drawCropCanvas(canvas);
    });
    container.querySelector('#rotateLeftBtn').addEventListener('click', () => {
      cropState.rotation = (cropState.rotation - 90 + 360) % 360;
      drawCropCanvas(canvas);
    });
  }

  function drawCropCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Rotate canvas around center if needed
    if (cropState.rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((cropState.rotation * Math.PI) / 180);
      ctx.drawImage(currentImg, -currentImg.naturalWidth / 2, -currentImg.naturalHeight / 2);
    } else {
      ctx.drawImage(currentImg, 0, 0);
    }
    ctx.restore();

    // Dark overlay outside crop box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, cropState.y);
    ctx.fillRect(0, cropState.y + cropState.h, canvas.width, canvas.height - (cropState.y + cropState.h));
    ctx.fillRect(0, cropState.y, cropState.x, cropState.h);
    ctx.fillRect(cropState.x + cropState.w, cropState.y, canvas.width - (cropState.x + cropState.w), cropState.h);

    // Crop box outline
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.strokeRect(cropState.x, cropState.y, cropState.w, cropState.h);

    // Rule of thirds lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cropState.x + cropState.w / 3, cropState.y);
    ctx.lineTo(cropState.x + cropState.w / 3, cropState.y + cropState.h);
    ctx.moveTo(cropState.x + (2 * cropState.w) / 3, cropState.y);
    ctx.lineTo(cropState.x + (2 * cropState.w) / 3, cropState.y + cropState.h);
    ctx.moveTo(cropState.x, cropState.y + cropState.h / 3);
    ctx.lineTo(cropState.x + cropState.w, cropState.y + cropState.h / 3);
    ctx.moveTo(cropState.x, cropState.y + (2 * cropState.h) / 3);
    ctx.lineTo(cropState.x + cropState.w, cropState.y + (2 * cropState.h) / 3);
    ctx.stroke();
  }

  async function processTool(container) {
    if (activeSubtool === 'to-pdf') {
      await processImageToPdf(container);
    } else if (activeSubtool === 'cropper') {
      await processCropper(container);
    } else if (activeSubtool === 'resizer') {
      await processResizer(container);
    } else {
      await processConverter(container);
    }
  }

  async function processResizer(container) {
    const w = parseInt(container.querySelector('#resizeW').value, 10);
    const h = parseInt(container.querySelector('#resizeH').value, 10);

    if (!w || !h || w <= 0 || h <= 0) {
      window.FileForge.showToast('Invalid dimensions specified.', 'error');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(currentImg, 0, 0, w, h);

    const outMime = currentFile.type || 'image/png';
    canvas.toBlob((blob) => {
      displayResult(container, blob, outMime, `${w} × ${h}`, 'resized');
    }, outMime, 0.92);
  }

  async function processConverter(container) {
    const targetMime = container.querySelector('#converterTargetSelect').value;
    const bgColor = container.querySelector('#bgHexColor') ? container.querySelector('#bgHexColor').value : '#FFFFFF';

    const canvas = document.createElement('canvas');
    canvas.width = currentImg.naturalWidth;
    canvas.height = currentImg.naturalHeight;
    const ctx = canvas.getContext('2d');

    if (targetMime === 'image/jpeg') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(currentImg, 0, 0);

    canvas.toBlob((blob) => {
      displayResult(container, blob, targetMime, `${canvas.width} × ${canvas.height}`, 'converted');
    }, targetMime, 0.92);
  }

  async function processCropper(container) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropState.w);
    canvas.height = Math.round(cropState.h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Source image rotated if any
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = currentImg.naturalWidth;
    srcCanvas.height = currentImg.naturalHeight;
    const srcCtx = srcCanvas.getContext('2d');

    if (cropState.rotation !== 0) {
      srcCtx.translate(srcCanvas.width / 2, srcCanvas.height / 2);
      srcCtx.rotate((cropState.rotation * Math.PI) / 180);
      srcCtx.drawImage(currentImg, -currentImg.naturalWidth / 2, -currentImg.naturalHeight / 2);
    } else {
      srcCtx.drawImage(currentImg, 0, 0);
    }

    ctx.drawImage(srcCanvas, cropState.x, cropState.y, cropState.w, cropState.h, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      displayResult(container, blob, 'image/png', `${canvas.width} × ${canvas.height}`, 'cropped');
    }, 'image/png');
  }

  async function processImageToPdf(container) {
    if (!window.PDFLib) {
      window.FileForge.showToast('PDF-Lib library loading. Please wait...', 'info');
      return;
    }

    const filesToConvert = multipleFiles.length > 0 ? multipleFiles : [currentFile];
    if (filesToConvert.length === 0) return;

    try {
      window.FileForge.showToast('Generating PDF document...', 'info');
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageSizeSetting = container.querySelector('#pdfPageSize').value;
      const margin = parseInt(container.querySelector('#pdfPageMargin').value, 10) || 0;

      for (const f of filesToConvert) {
        const arrayBuf = await f.arrayBuffer();
        let pdfImage;
        if (f.type === 'image/png' || /\.png$/i.test(f.name)) {
          pdfImage = await pdfDoc.embedPng(arrayBuf);
        } else {
          pdfImage = await pdfDoc.embedJpg(arrayBuf);
        }

        const imgW = pdfImage.width;
        const imgH = pdfImage.height;

        let pageW = imgW + margin * 2;
        let pageH = imgH + margin * 2;

        if (pageSizeSetting === 'a4_p') {
          pageW = 595.28;
          pageH = 841.89;
        } else if (pageSizeSetting === 'a4_l') {
          pageW = 841.89;
          pageH = 595.28;
        } else if (pageSizeSetting === 'letter_p') {
          pageW = 612.0;
          pageH = 792.0;
        }

        const page = pdfDoc.addPage([pageW, pageH]);

        if (pageSizeSetting === 'fit') {
          page.drawImage(pdfImage, {
            x: margin,
            y: margin,
            width: imgW,
            height: imgH,
          });
        } else {
          // Fit inside page bounds preserving aspect ratio
          const maxDrawW = pageW - margin * 2;
          const maxDrawH = pageH - margin * 2;
          const scale = Math.min(maxDrawW / imgW, maxDrawH / imgH);
          const drawW = imgW * scale;
          const drawH = imgH * scale;
          const posX = (pageW - drawW) / 2;
          const posY = (pageH - drawH) / 2;

          page.drawImage(pdfImage, {
            x: posX,
            y: posY,
            width: drawW,
            height: drawH,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

      displayResult(container, pdfBlob, 'application/pdf', `${filesToConvert.length} Page(s)`, 'pdf');
    } catch (err) {
      console.error('Image to PDF error:', err);
      window.FileForge.showToast('Failed to generate PDF: ' + err.message, 'error');
    }
  }

  function displayResult(container, blob, mimeType, dimsStr, actionType) {
    if (processedUrl) URL.revokeObjectURL(processedUrl);
    processedBlob = blob;
    processedUrl = URL.createObjectURL(blob);

    const resultBox = container.querySelector('#subImgResult');
    container.querySelector('#subOrigStat').textContent = formatBytes(currentFile ? currentFile.size : 0);
    container.querySelector('#subResultStat').textContent = formatBytes(blob.size);
    container.querySelector('#subFormatStat').textContent = mimeType.replace('image/', '').replace('application/', '').toUpperCase();
    container.querySelector('#subDimsStat').textContent = dimsStr;

    const previewBox = container.querySelector('#resultPreviewBox');
    const resultImg = container.querySelector('#resultImagePreview');

    if (mimeType.includes('pdf')) {
      previewBox.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--text-light);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" style="margin-bottom: 12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          <div style="font-weight: 700; font-size: 1.1rem;">PDF Document Ready</div>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 4px;">Created with pdf-lib</p>
        </div>
      `;
    } else {
      resultImg.src = processedUrl;
      resultImg.style.display = 'block';
    }

    const baseName = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'image';
    let ext = '.png';
    if (mimeType === 'image/jpeg') ext = '.jpg';
    else if (mimeType === 'image/webp') ext = '.webp';
    else if (mimeType === 'application/pdf') ext = '.pdf';

    const downloadBtn = container.querySelector('#subDownloadBtn');
    downloadBtn.href = processedUrl;
    downloadBtn.download = `${baseName}-${actionType}${ext}`;

    resultBox.classList.add('active');
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.FileForge.showToast('Image processing successful!', 'success');
  }

  return {
    init,
    cleanup,
  };
})();
