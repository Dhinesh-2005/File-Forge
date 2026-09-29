/**
 * FileForge - Image Compressor Tool
 * Pure client-side batch image compression, resizing, and format conversion
 * using HTML5 Canvas API and JSZip for batch downloads.
 */

window.FileForge = window.FileForge || {};
window.FileForge.ImageCompressor = (function () {
  let loadedImages = []; // { id, file, url, img, origWidth, origHeight, compressedBlob, compressedUrl }
  let isProcessing = false;

  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function cleanup() {
    loadedImages.forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    });
    loadedImages = [];
    isProcessing = false;
  }

  function init(containerEl, initialFiles = null) {
    cleanup();
    renderInterface(containerEl);
    if (initialFiles) {
      const filesArr = Array.isArray(initialFiles) ? initialFiles : [initialFiles];
      handleFilesSelected(filesArr, containerEl);
    }
  }

  function renderInterface(container) {
    container.innerHTML = `
      <div class="tool-workspace">
        <!-- Dropzone -->
        <div class="tool-dropzone" id="imgDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <h3 class="tool-dropzone-title">Drop your images here</h3>
          <p class="tool-dropzone-sub">Supports JPG, PNG, WebP, GIF, BMP (Batch upload supported)</p>
          <button class="btn btn-secondary" id="browseImagesBtn">Browse Images</button>
          <input type="file" id="imageFileInput" class="file-input-hidden" accept="image/*" multiple />
        </div>

        <!-- Working Area (hidden until images uploaded) -->
        <div id="imgSettingsSection" style="display: none; flex-direction: column; gap: 24px;">
          <!-- Batch Header -->
          <div class="file-meta-card">
            <div class="file-meta-info">
              <div class="file-meta-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
              </div>
              <div class="file-meta-text">
                <div class="file-meta-name" id="imgBatchTitle">0 Images Selected</div>
                <div class="file-meta-specs">
                  <span>Total Size: <strong id="imgBatchSize">0 MB</strong></span>
                  <span>•</span>
                  <span>Processed: <strong id="imgBatchProcessedCount">0 / 0</strong></span>
                </div>
              </div>
            </div>
            <div class="file-meta-actions">
              <button class="btn btn-outline btn-sm" id="addMoreImagesBtn">+ Add More</button>
              <button class="btn btn-outline btn-sm" id="clearAllImagesBtn" style="color: #f87171;">Clear All</button>
            </div>
          </div>

          <!-- Thumbnail Gallery -->
          <div class="multi-preview-grid" id="imgThumbsGrid"></div>

          <!-- Settings Panel -->
          <div class="tool-settings-grid">
            <!-- Quality Slider -->
            <div class="setting-group">
              <label class="setting-label" for="imgQualityRange">
                <span>Compression Quality</span>
                <span class="setting-value-badge" id="imgQualityVal">75%</span>
              </label>
              <input type="range" id="imgQualityRange" class="custom-range" min="5" max="100" value="75" />
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                <span>Smaller Size</span>
                <span>Best Quality</span>
              </div>
            </div>

            <!-- Output Format -->
            <div class="setting-group">
              <label class="setting-label" for="imgFormatSelect">
                <span>Output Format</span>
                <span class="setting-value-badge" id="formatBadge">Original</span>
              </label>
              <select id="imgFormatSelect">
                <option value="original" selected>Keep Original Format</option>
                <option value="image/jpeg">JPG / JPEG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP (High Efficiency)</option>
              </select>
            </div>

            <!-- Resize Width & Height -->
            <div class="setting-group">
              <label class="setting-label">
                <span>Resize Dimensions</span>
                <span class="setting-value-badge" id="resizeBadge">Original Size</span>
              </label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="number" id="imgCustomWidth" placeholder="Width (px)" style="width: 100%;" min="10" />
                <span style="color: var(--text-muted);">×</span>
                <input type="number" id="imgCustomHeight" placeholder="Height (px)" style="width: 100%;" min="10" />
              </div>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; margin-top: 4px;">
                <input type="checkbox" id="imgAspectRatioCheck" checked />
                <span>Maintain aspect ratio</span>
              </label>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button class="btn btn-primary btn-lg" id="startImgCompressBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M3 21l7-7"></path></svg>
              <span>Compress All Images</span>
            </button>
          </div>
        </div>

        <!-- Processing Progress -->
        <div class="tool-progress-container" id="imgProgressContainer">
          <div class="progress-header">
            <span class="progress-status-text">
              <span class="progress-spinner"></span>
              <span id="imgStatusMsg">Compressing images locally...</span>
            </span>
            <span class="progress-percent" id="imgPercent">0%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="imgProgressFill"></div>
          </div>
        </div>

        <!-- Result Card -->
        <div class="tool-result-container" id="imgResultContainer">
          <div class="result-heading">
            <h3 class="result-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              All Images Compressed!
            </h3>
            <span class="result-badge-success">Lossless & Near-Lossless</span>
          </div>

          <!-- Comparison Stats -->
          <div class="result-stats-grid">
            <div class="stat-box">
              <div class="stat-label">Original Total</div>
              <div class="stat-value" id="imgResOrigSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Compressed Total</div>
              <div class="stat-value highlight" id="imgResCompSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Saved</div>
              <div class="stat-value highlight" id="imgResSavedSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Average Reduction</div>
              <div class="stat-value highlight" id="imgResReduction">0%</div>
            </div>
          </div>

          <!-- Download Options -->
          <div class="result-actions-row">
            <button class="btn btn-secondary" id="imgResetBtn">Compress More Images</button>
            <button class="btn btn-primary btn-lg" id="downloadAllZipBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download All as ZIP</span>
            </button>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    const dropzone = container.querySelector('#imgDropzone');
    const fileInput = container.querySelector('#imageFileInput');
    const browseBtn = container.querySelector('#browseImagesBtn');
    const addMoreBtn = container.querySelector('#addMoreImagesBtn');
    const clearAllBtn = container.querySelector('#clearAllImagesBtn');
    const startBtn = container.querySelector('#startImgCompressBtn');
    const resetBtn = container.querySelector('#imgResetBtn');
    const downloadZipBtn = container.querySelector('#downloadAllZipBtn');
    const qualityRange = container.querySelector('#imgQualityRange');
    const qualityVal = container.querySelector('#imgQualityVal');
    const formatSelect = container.querySelector('#imgFormatSelect');
    const formatBadge = container.querySelector('#formatBadge');
    const widthInput = container.querySelector('#imgCustomWidth');
    const heightInput = container.querySelector('#imgCustomHeight');
    const aspectCheck = container.querySelector('#imgAspectRatioCheck');

    browseBtn.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('click', (e) => {
      if (e.target !== browseBtn) fileInput.click();
    });

    addMoreBtn.addEventListener('click', () => fileInput.click());
    clearAllBtn.addEventListener('click', () => {
      cleanup();
      container.querySelector('#imgSettingsSection').style.display = 'none';
      container.querySelector('#imgDropzone').style.display = 'block';
      container.querySelector('#imgResultContainer').classList.remove('active');
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelected(Array.from(e.target.files), container);
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
        const imageFiles = Array.from(e.dataTransfer.files).filter(
          (f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f.name)
        );
        if (imageFiles.length > 0) {
          handleFilesSelected(imageFiles, container);
        } else {
          window.FileForge.showToast('Please select valid image files.', 'error');
        }
      }
    });

    qualityRange.addEventListener('input', () => {
      qualityVal.textContent = qualityRange.value + '%';
    });

    formatSelect.addEventListener('change', () => {
      formatBadge.textContent = formatSelect.options[formatSelect.selectedIndex].text;
    });

    // Aspect ratio synchronization
    widthInput.addEventListener('input', () => {
      if (aspectCheck.checked && loadedImages.length > 0 && loadedImages[0].origWidth) {
        const ratio = loadedImages[0].origHeight / loadedImages[0].origWidth;
        const w = parseInt(widthInput.value, 10);
        if (w > 0) heightInput.value = Math.round(w * ratio);
      }
    });

    heightInput.addEventListener('input', () => {
      if (aspectCheck.checked && loadedImages.length > 0 && loadedImages[0].origHeight) {
        const ratio = loadedImages[0].origWidth / loadedImages[0].origHeight;
        const h = parseInt(heightInput.value, 10);
        if (h > 0) widthInput.value = Math.round(h * ratio);
      }
    });

    startBtn.addEventListener('click', () => startCompression(container));

    resetBtn.addEventListener('click', () => {
      container.querySelector('#imgResultContainer').classList.remove('active');
      container.querySelector('#imgDropzone').style.display = 'block';
      container.querySelector('#imgSettingsSection').style.display = 'none';
      cleanup();
    });

    downloadZipBtn.addEventListener('click', () => downloadAllAsZip());
  }

  function handleFilesSelected(files, container) {
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const item = {
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        file: file,
        url: url,
        img: img,
        origWidth: 0,
        origHeight: 0,
        compressedBlob: null,
        compressedUrl: null,
        savedPct: 0,
      };

      img.onload = () => {
        item.origWidth = img.naturalWidth;
        item.origHeight = img.naturalHeight;
        renderThumbnails(container);
      };

      img.src = url;
      loadedImages.push(item);
    });

    container.querySelector('#imgDropzone').style.display = 'none';
    container.querySelector('#imgSettingsSection').style.display = 'flex';
    container.querySelector('#imgResultContainer').classList.remove('active');

    updateBatchInfo(container);
    renderThumbnails(container);
  }

  function updateBatchInfo(container) {
    const totalSize = loadedImages.reduce((acc, cur) => acc + cur.file.size, 0);
    container.querySelector('#imgBatchTitle').textContent = `${loadedImages.length} Image${loadedImages.length > 1 ? 's' : ''} Selected`;
    container.querySelector('#imgBatchSize').textContent = formatBytes(totalSize);
    container.querySelector('#imgBatchProcessedCount').textContent = `0 / ${loadedImages.length}`;
  }

  function renderThumbnails(container) {
    const grid = container.querySelector('#imgThumbsGrid');
    grid.innerHTML = '';

    loadedImages.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'preview-thumb-card';
      card.id = 'thumb_' + item.id;

      let resultHtml = '';
      if (item.compressedBlob) {
        const compSizeStr = formatBytes(item.compressedBlob.size);
        const savedBadge = item.savedPct > 0 ? `<span style="color: #34d399; font-weight: 700;">-${item.savedPct}%</span>` : `<span>Same</span>`;
        resultHtml = `
          <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 4px; display: flex; justify-content: space-between;">
            <span>${compSizeStr}</span>
            ${savedBadge}
          </div>
          <a href="${item.compressedUrl}" download="${getCompressedFilename(item)}" class="btn btn-primary btn-sm" style="margin-top: 6px; font-size: 0.75rem; padding: 4px 8px;">
            Download
          </a>
        `;
      }

      card.innerHTML = `
        <img src="${item.url}" class="preview-thumb-img" alt="${item.file.name}" />
        <div class="preview-thumb-name" title="${item.file.name}">${item.file.name}</div>
        <div class="preview-thumb-size">
          ${formatBytes(item.file.size)} ${item.origWidth ? `• ${item.origWidth}×${item.origHeight}` : ''}
        </div>
        ${resultHtml}
        <button class="remove-thumb-btn" data-id="${item.id}" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px;">×</button>
      `;

      card.querySelector('.remove-thumb-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeImageItem(item.id, container);
      });

      grid.appendChild(card);
    });
  }

  function removeImageItem(id, container) {
    const idx = loadedImages.findIndex((x) => x.id === id);
    if (idx !== -1) {
      if (loadedImages[idx].url) URL.revokeObjectURL(loadedImages[idx].url);
      if (loadedImages[idx].compressedUrl) URL.revokeObjectURL(loadedImages[idx].compressedUrl);
      loadedImages.splice(idx, 1);
    }
    if (loadedImages.length === 0) {
      container.querySelector('#imgSettingsSection').style.display = 'none';
      container.querySelector('#imgDropzone').style.display = 'block';
    } else {
      updateBatchInfo(container);
      renderThumbnails(container);
    }
  }

  function getCompressedFilename(item, targetFormat) {
    const originalName = item.file.name;
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    let ext = '.jpg';
    if (targetFormat === 'image/png') ext = '.png';
    else if (targetFormat === 'image/webp') ext = '.webp';
    else if (targetFormat === 'image/jpeg') ext = '.jpg';
    else {
      // Keep original extension
      const match = originalName.match(/\.[^/.]+$/);
      ext = match ? match[0].toLowerCase() : '.jpg';
    }
    return `${baseName}-compressed${ext}`;
  }

  async function startCompression(container) {
    if (loadedImages.length === 0) return;
    if (isProcessing) return;

    isProcessing = true;
    const startBtn = container.querySelector('#startImgCompressBtn');
    startBtn.disabled = true;

    const progressContainer = container.querySelector('#imgProgressContainer');
    const progressFill = container.querySelector('#imgProgressFill');
    const percentEl = container.querySelector('#imgPercent');
    const statusMsg = container.querySelector('#imgStatusMsg');
    const resultContainer = container.querySelector('#imgResultContainer');

    resultContainer.classList.remove('active');
    progressContainer.classList.add('active');

    const quality = parseInt(container.querySelector('#imgQualityRange').value, 10) / 100;
    const formatSetting = container.querySelector('#imgFormatSelect').value;
    const customW = parseInt(container.querySelector('#imgCustomWidth').value, 10) || 0;
    const customH = parseInt(container.querySelector('#imgCustomHeight').value, 10) || 0;

    let totalOrig = 0;
    let totalComp = 0;

    for (let i = 0; i < loadedImages.length; i++) {
      const item = loadedImages[i];
      const pct = Math.round(((i + 1) / loadedImages.length) * 100);
      progressFill.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      statusMsg.textContent = `Compressing ${item.file.name} (${i + 1} of ${loadedImages.length})...`;

      // Determine dimensions
      let targetW = item.origWidth || 800;
      let targetH = item.origHeight || 600;

      if (customW > 0 && customH > 0) {
        targetW = customW;
        targetH = customH;
      } else if (customW > 0) {
        targetH = Math.round((customW / (item.origWidth || 1)) * (item.origHeight || 1));
        targetW = customW;
      } else if (customH > 0) {
        targetW = Math.round((customH / (item.origHeight || 1)) * (item.origWidth || 1));
        targetH = customH;
      }

      // Determine mime type
      let outMime = formatSetting === 'original' ? item.file.type || 'image/jpeg' : formatSetting;
      if (!outMime.startsWith('image/')) outMime = 'image/jpeg';

      const blob = await compressSingleCanvas(item.img, targetW, targetH, outMime, quality);

      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
      item.compressedBlob = blob;
      item.compressedUrl = URL.createObjectURL(blob);

      const saved = Math.max(0, item.file.size - blob.size);
      item.savedPct = item.file.size > 0 ? (((item.file.size - blob.size) / item.file.size) * 100).toFixed(1) : 0;

      totalOrig += item.file.size;
      totalComp += blob.size;

      // Small async tick
      await new Promise((r) => setTimeout(r, 15));
    }

    renderThumbnails(container);

    progressContainer.classList.remove('active');
    startBtn.disabled = false;
    isProcessing = false;

    // Show summary stats
    const totalSaved = Math.max(0, totalOrig - totalComp);
    const overallReduction = totalOrig > 0 ? (((totalOrig - totalComp) / totalOrig) * 100).toFixed(1) : 0;

    container.querySelector('#imgResOrigSize').textContent = formatBytes(totalOrig);
    container.querySelector('#imgResCompSize').textContent = formatBytes(totalComp);
    container.querySelector('#imgResSavedSize').textContent = formatBytes(totalSaved);
    container.querySelector('#imgResReduction').textContent = overallReduction + '%';

    resultContainer.classList.add('active');
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.FileForge.showToast(`Compressed ${loadedImages.length} images! Saved ${formatBytes(totalSaved)} in total.`, 'success');
  }

  function compressSingleCanvas(imgElement, width, height, mimeType, quality) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Fill white background for JPEG conversions if transparent
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(imgElement, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        mimeType,
        quality
      );
    });
  }

  async function downloadAllAsZip() {
    if (!window.JSZip) {
      window.FileForge.showToast('JSZip library loading. Please try again.', 'error');
      return;
    }

    const compressedItems = loadedImages.filter((x) => x.compressedBlob);
    if (compressedItems.length === 0) {
      window.FileForge.showToast('Please compress images first.', 'info');
      return;
    }

    try {
      window.FileForge.showToast('Creating ZIP archive...', 'info');
      const zip = new JSZip();
      compressedItems.forEach((item) => {
        const fname = getCompressedFilename(item);
        zip.file(fname, item.compressedBlob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = 'FileForge-Compressed-Images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(zipUrl), 3000);
      window.FileForge.showToast('ZIP file downloaded!', 'success');
    } catch (err) {
      console.error('ZIP creation error:', err);
      window.FileForge.showToast('Failed to create ZIP: ' + err.message, 'error');
    }
  }

  return {
    init,
    cleanup,
  };
})();
