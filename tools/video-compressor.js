/**
 * FileForge - Video Compressor Tool
 * Pure client-side browser video compression engine using Canvas API,
 * Web Audio API, and MediaRecorder with dynamic bitrate & resolution scaling.
 */

window.FileForge = window.FileForge || {};
window.FileForge.VideoCompressor = (function () {
  let currentFile = null;
  let currentVideoUrl = null;
  let compressedVideoUrl = null;
  let videoMetadata = null;
  let isProcessing = false;
  let cancelRequested = false;
  let activeRecorder = null;
  let animFrameId = null;

  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  function cleanup() {
    if (currentVideoUrl) {
      URL.revokeObjectURL(currentVideoUrl);
      currentVideoUrl = null;
    }
    if (compressedVideoUrl) {
      URL.revokeObjectURL(compressedVideoUrl);
      compressedVideoUrl = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    currentFile = null;
    videoMetadata = null;
    isProcessing = false;
    cancelRequested = false;
    activeRecorder = null;
  }

  function init(containerEl, file = null) {
    cleanup();
    renderInterface(containerEl);
    if (file) {
      handleFileSelected(file, containerEl);
    }
  }

  function renderInterface(container) {
    container.innerHTML = `
      <div class="tool-workspace">
        <!-- Dropzone -->
        <div class="tool-dropzone" id="videoDropzone">
          <div class="tool-dropzone-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>
          <h3 class="tool-dropzone-title">Drop your video here</h3>
          <p class="tool-dropzone-sub">Supports MP4, WebM, MOV, MKV, AVI (Processed 100% locally)</p>
          <button class="btn btn-secondary" id="browseVideoBtn">Browse Video</button>
          <input type="file" id="videoFileInput" class="file-input-hidden" accept="video/*" />
        </div>

        <!-- File Details & Video Preview (hidden until loaded) -->
        <div id="videoDetailsSection" style="display: none; flex-direction: column; gap: 24px;">
          <div class="file-meta-card">
            <div class="file-meta-info">
              <div class="file-meta-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
              </div>
              <div class="file-meta-text">
                <div class="file-meta-name" id="videoFileName">video.mp4</div>
                <div class="file-meta-specs">
                  <span>Size: <strong id="videoOrigSize">0 MB</strong></span>
                  <span>•</span>
                  <span>Duration: <strong id="videoDuration">00:00</strong></span>
                  <span>•</span>
                  <span>Resolution: <strong id="videoResolution">1920 × 1080</strong></span>
                </div>
              </div>
            </div>
            <div class="file-meta-actions">
              <button class="btn btn-outline btn-sm" id="changeVideoBtn">Change File</button>
            </div>
          </div>

          <!-- Video Preview Player -->
          <div class="media-preview-container">
            <video id="videoPreviewPlayer" class="media-preview-player" controls playsinline muted></video>
          </div>

          <!-- Compression Controls -->
          <div class="tool-settings-grid">
            <!-- Quality Presets -->
            <div class="setting-group">
              <label class="setting-label">
                <span>Quality Preset</span>
                <span class="setting-value-badge" id="qualityBadge">Medium Quality</span>
              </label>
              <div class="preset-radio-group">
                <input type="radio" name="videoQuality" id="vqHigh" value="high" class="preset-radio-input" />
                <label for="vqHigh" class="preset-radio-label">High</label>

                <input type="radio" name="videoQuality" id="vqMed" value="medium" class="preset-radio-input" checked />
                <label for="vqMed" class="preset-radio-label">Medium</label>

                <input type="radio" name="videoQuality" id="vqLow" value="low" class="preset-radio-input" />
                <label for="vqLow" class="preset-radio-label">Low</label>

                <input type="radio" name="videoQuality" id="vqCustom" value="custom" class="preset-radio-input" />
                <label for="vqCustom" class="preset-radio-label">Custom</label>
              </div>
            </div>

            <!-- Target Resolution -->
            <div class="setting-group">
              <label class="setting-label" for="videoResSelect">
                <span>Output Resolution</span>
                <span class="setting-value-badge" id="resBadge">Original</span>
              </label>
              <select id="videoResSelect">
                <option value="original" selected>Original Resolution</option>
                <option value="1080">1080p Full HD (1920 × 1080)</option>
                <option value="720">720p HD (1280 × 720)</option>
                <option value="480">480p SD (854 × 480)</option>
                <option value="360">360p Low (640 × 360)</option>
              </select>
            </div>

            <!-- Custom Bitrate Slider (shown only when Custom selected) -->
            <div class="setting-group" id="customBitrateGroup" style="display: none;">
              <label class="setting-label" for="customBitrateSlider">
                <span>Custom Bitrate</span>
                <span class="setting-value-badge" id="customBitrateVal">1500 kbps</span>
              </label>
              <input type="range" id="customBitrateSlider" class="custom-range" min="300" max="8000" step="100" value="1500" />
            </div>

            <!-- Output Container Option -->
            <div class="setting-group">
              <label class="setting-label" for="videoFormatSelect">
                <span>Output Format</span>
                <span class="setting-value-badge">Browser Optimized</span>
              </label>
              <select id="videoFormatSelect">
                <option value="mp4" selected>MP4 (H.264 / AAC)</option>
                <option value="webm">WebM (VP9 / Opus)</option>
              </select>
            </div>
          </div>

          <!-- Compress Action Button -->
          <div style="display: flex; justify-content: flex-end; gap: 14px;">
            <button class="btn btn-primary btn-lg" id="startCompressBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M3 21l7-7"></path></svg>
              <span>Compress Video</span>
            </button>
          </div>
        </div>

        <!-- Processing Progress Bar -->
        <div class="tool-progress-container" id="videoProgressContainer">
          <div class="progress-header">
            <span class="progress-status-text">
              <span class="progress-spinner"></span>
              <span id="videoStatusMsg">Compressing video in browser...</span>
            </span>
            <span class="progress-percent" id="videoPercent">0%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="videoProgressFill"></div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
            <button class="btn btn-outline btn-sm" id="cancelCompressBtn">Cancel Processing</button>
          </div>
        </div>

        <!-- Result Card -->
        <div class="tool-result-container" id="videoResultContainer">
          <div class="result-heading">
            <h3 class="result-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Compression Complete!
            </h3>
            <span class="result-badge-success">Locally Transcoded</span>
          </div>

          <!-- Comparison Stats -->
          <div class="result-stats-grid">
            <div class="stat-box">
              <div class="stat-label">Original Size</div>
              <div class="stat-value" id="resOrigSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Compressed Size</div>
              <div class="stat-value highlight" id="resCompSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Saved Space</div>
              <div class="stat-value highlight" id="resSavedSize">0 MB</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Reduction</div>
              <div class="stat-value highlight" id="resReduction">0%</div>
            </div>
          </div>

          <!-- Result Preview Player -->
          <div class="media-preview-container">
            <video id="compressedVideoPlayer" class="media-preview-player" controls playsinline></video>
          </div>

          <!-- Download Actions -->
          <div class="result-actions-row">
            <button class="btn btn-secondary" id="compressAnotherBtn">Compress Another Video</button>
            <a class="btn btn-primary btn-lg" id="downloadCompressedBtn" download="compressed-video.mp4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download Compressed Video</span>
            </a>
          </div>
        </div>
      </div>
    `;

    bindEvents(container);
  }

  function bindEvents(container) {
    const dropzone = container.querySelector('#videoDropzone');
    const fileInput = container.querySelector('#videoFileInput');
    const browseBtn = container.querySelector('#browseVideoBtn');
    const changeBtn = container.querySelector('#changeVideoBtn');
    const startBtn = container.querySelector('#startCompressBtn');
    const cancelBtn = container.querySelector('#cancelCompressBtn');
    const compressAnotherBtn = container.querySelector('#compressAnotherBtn');
    const qualityRadios = container.querySelectorAll('input[name="videoQuality"]');
    const customGroup = container.querySelector('#customBitrateGroup');
    const customSlider = container.querySelector('#customBitrateSlider');
    const customValBadge = container.querySelector('#customBitrateVal');
    const qualityBadge = container.querySelector('#qualityBadge');
    const resSelect = container.querySelector('#videoResSelect');
    const resBadge = container.querySelector('#resBadge');

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

    // Drag and drop handlers
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|flv)$/i.test(file.name)) {
          handleFileSelected(file, container);
        } else {
          window.FileForge.showToast('Please select a valid video file.', 'error');
        }
      }
    });

    // Quality Presets change
    qualityRadios.forEach((r) => {
      r.addEventListener('change', () => {
        if (r.value === 'custom') {
          customGroup.style.display = 'flex';
          qualityBadge.textContent = 'Custom (' + customSlider.value + ' kbps)';
        } else {
          customGroup.style.display = 'none';
          qualityBadge.textContent = r.value.charAt(0).toUpperCase() + r.value.slice(1) + ' Quality';
        }
      });
    });

    customSlider.addEventListener('input', () => {
      customValBadge.textContent = customSlider.value + ' kbps';
      qualityBadge.textContent = 'Custom (' + customSlider.value + ' kbps)';
    });

    resSelect.addEventListener('change', () => {
      resBadge.textContent = resSelect.options[resSelect.selectedIndex].text;
    });

    startBtn.addEventListener('click', () => startCompression(container));
    cancelBtn.addEventListener('click', () => {
      cancelRequested = true;
      if (activeRecorder && activeRecorder.state !== 'inactive') {
        activeRecorder.stop();
      }
      window.FileForge.showToast('Compression cancelled.', 'info');
      container.querySelector('#videoProgressContainer').classList.remove('active');
      startBtn.disabled = false;
    });

    compressAnotherBtn.addEventListener('click', () => {
      container.querySelector('#videoResultContainer').classList.remove('active');
      container.querySelector('#videoDropzone').style.display = 'block';
      container.querySelector('#videoDetailsSection').style.display = 'none';
      cleanup();
    });
  }

  function handleFileSelected(file, container) {
    currentFile = file;
    if (currentVideoUrl) URL.revokeObjectURL(currentVideoUrl);
    currentVideoUrl = URL.createObjectURL(file);

    const videoPlayer = container.querySelector('#videoPreviewPlayer');
    videoPlayer.src = currentVideoUrl;

    container.querySelector('#videoFileName').textContent = file.name;
    container.querySelector('#videoOrigSize').textContent = formatBytes(file.size);

    // Read video metadata
    videoPlayer.onloadedmetadata = function () {
      videoMetadata = {
        width: videoPlayer.videoWidth || 1920,
        height: videoPlayer.videoHeight || 1080,
        duration: videoPlayer.duration || 0,
      };

      container.querySelector('#videoDuration').textContent = formatDuration(videoMetadata.duration);
      container.querySelector('#videoResolution').textContent = `${videoMetadata.width} × ${videoMetadata.height}`;

      // Update resolution selector labels if necessary
      container.querySelector('#videoDropzone').style.display = 'none';
      container.querySelector('#videoDetailsSection').style.display = 'flex';
      container.querySelector('#videoResultContainer').classList.remove('active');
    };

    videoPlayer.onerror = function () {
      window.FileForge.showToast('Unable to preview this video codec. Standard MP4/WebM is recommended.', 'error');
      // Still show section
      container.querySelector('#videoDropzone').style.display = 'none';
      container.querySelector('#videoDetailsSection').style.display = 'flex';
    };
  }

  function computeTargetDimensions(origWidth, origHeight, targetRes) {
    if (targetRes === 'original') return { width: origWidth, height: origHeight };

    const targetH = parseInt(targetRes, 10);
    const aspect = origWidth / origHeight;
    let targetW = Math.round(targetH * aspect);
    // Even dimensions are required for video codecs
    if (targetW % 2 !== 0) targetW += 1;
    let finalH = targetH;
    if (finalH % 2 !== 0) finalH += 1;

    // Do not upscale if target is larger than original
    if (targetH > origHeight) {
      return { width: origWidth, height: origHeight };
    }
    return { width: targetW, height: finalH };
  }

  function computeTargetBitrate(quality, origSize, duration, customBps) {
    if (quality === 'custom') {
      return customBps * 1000;
    }

    // High: ~2500 kbps, Medium: ~1200 kbps, Low: ~600 kbps
    // Or scale down based on original file bitrate if known
    let baseBps = 1500000;
    if (duration > 0 && origSize > 0) {
      const origBps = (origSize * 8) / duration;
      if (quality === 'high') {
        baseBps = Math.min(origBps * 0.7, 3000000);
      } else if (quality === 'medium') {
        baseBps = Math.min(origBps * 0.45, 1500000);
      } else if (quality === 'low') {
        baseBps = Math.min(origBps * 0.25, 750000);
      }
    } else {
      if (quality === 'high') baseBps = 2500000;
      if (quality === 'medium') baseBps = 1200000;
      if (quality === 'low') baseBps = 600000;
    }

    return Math.max(baseBps, 250000);
  }

  async function startCompression(container) {
    if (!currentFile || !videoMetadata) {
      window.FileForge.showToast('Please select a video file first.', 'error');
      return;
    }

    if (isProcessing) return;
    isProcessing = true;
    cancelRequested = false;

    const startBtn = container.querySelector('#startCompressBtn');
    startBtn.disabled = true;

    const progressContainer = container.querySelector('#videoProgressContainer');
    const progressFill = container.querySelector('#videoProgressFill');
    const percentEl = container.querySelector('#videoPercent');
    const statusMsg = container.querySelector('#videoStatusMsg');
    const resultContainer = container.querySelector('#videoResultContainer');

    resultContainer.classList.remove('active');
    progressContainer.classList.add('active');
    progressFill.style.width = '0%';
    percentEl.textContent = '0%';
    statusMsg.textContent = 'Initializing in-browser compression engine...';

    // Get Settings
    const qualityRadio = container.querySelector('input[name="videoQuality"]:checked').value;
    const resValue = container.querySelector('#videoResSelect').value;
    const customSliderVal = parseInt(container.querySelector('#customBitrateSlider').value, 10);
    const formatValue = container.querySelector('#videoFormatSelect').value;

    const targetDims = computeTargetDimensions(videoMetadata.width, videoMetadata.height, resValue);
    const targetBitrate = computeTargetBitrate(qualityRadio, currentFile.size, videoMetadata.duration, customSliderVal);

    statusMsg.textContent = `Transcoding to ${targetDims.width}×${targetDims.height} at ${(targetBitrate / 1000).toFixed(0)} kbps...`;

    try {
      // Create hidden video element to process
      const procVideo = document.createElement('video');
      procVideo.src = currentVideoUrl;
      procVideo.muted = false; // preserve audio if present
      procVideo.playsInline = true;
      procVideo.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        procVideo.onloadeddata = resolve;
        procVideo.onerror = reject;
      });

      // Canvas for scaling
      const canvas = document.createElement('canvas');
      canvas.width = targetDims.width;
      canvas.height = targetDims.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Capture canvas video stream
      const fps = 30;
      const canvasStream = canvas.captureStream(fps);

      // Web Audio to capture audio track
      let combinedStream = canvasStream;
      let audioCtx = null;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaElementSource(procVideo);
        const destination = audioCtx.createMediaStreamDestination();
        source.connect(destination);
        // Do not connect to audioCtx.destination to avoid echoing aloud during compression

        const audioTracks = destination.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
        }
      } catch (err) {
        console.warn('Audio processing bypass or silent video:', err);
      }

      // Check supported MIME type
      let mimeType = 'video/webm;codecs=vp9';
      if (formatValue === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        mimeType = 'video/webm;codecs=vp8,opus';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }

      const recorderOptions = {
        mimeType: mimeType,
        videoBitsPerSecond: targetBitrate,
        audioBitsPerSecond: 128000,
      };

      const recorder = new MediaRecorder(combinedStream, recorderOptions);
      activeRecorder = recorder;
      const recordedChunks = [];

      recorder.ondataavailable = function (e) {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      recorder.onstop = function () {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();

        if (cancelRequested) {
          isProcessing = false;
          startBtn.disabled = false;
          return;
        }

        const blobType = mimeType.includes('mp4') ? 'video/mp4' : 'video/webm';
        const compressedBlob = new Blob(recordedChunks, { type: blobType });

        renderResults(container, compressedBlob, mimeType);
      };

      // Playback loop and frame draw
      procVideo.currentTime = 0;
      await procVideo.play();
      recorder.start(100);

      const duration = procVideo.duration || videoMetadata.duration || 1;

      function renderFrame() {
        if (cancelRequested) {
          procVideo.pause();
          return;
        }

        ctx.drawImage(procVideo, 0, 0, canvas.width, canvas.height);

        const currentT = procVideo.currentTime;
        const pct = Math.min(Math.round((currentT / duration) * 100), 99);
        progressFill.style.width = pct + '%';
        percentEl.textContent = pct + '%';

        if (!procVideo.paused && !procVideo.ended) {
          animFrameId = requestAnimationFrame(renderFrame);
        }
      }

      animFrameId = requestAnimationFrame(renderFrame);

      procVideo.onended = function () {
        progressFill.style.width = '100%';
        percentEl.textContent = '100%';
        statusMsg.textContent = 'Finalizing compressed video...';
        setTimeout(() => {
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }, 300);
      };
    } catch (err) {
      console.error('Video compression error:', err);
      window.FileForge.showToast('Compression failed: ' + (err.message || 'Browser codec error'), 'error');
      progressContainer.classList.remove('active');
      startBtn.disabled = false;
      isProcessing = false;
    }
  }

  function renderResults(container, compressedBlob, mimeType) {
    isProcessing = false;
    const progressContainer = container.querySelector('#videoProgressContainer');
    const resultContainer = container.querySelector('#videoResultContainer');
    const startBtn = container.querySelector('#startCompressBtn');

    progressContainer.classList.remove('active');
    startBtn.disabled = false;

    if (compressedVideoUrl) URL.revokeObjectURL(compressedVideoUrl);
    compressedVideoUrl = URL.createObjectURL(compressedBlob);

    const origSize = currentFile.size;
    const compSize = compressedBlob.size;
    const saved = Math.max(0, origSize - compSize);
    const reductionPct = origSize > 0 ? (((origSize - compSize) / origSize) * 100).toFixed(1) : 0;

    container.querySelector('#resOrigSize').textContent = formatBytes(origSize);
    container.querySelector('#resCompSize').textContent = formatBytes(compSize);
    container.querySelector('#resSavedSize').textContent = formatBytes(saved);
    container.querySelector('#resReduction').textContent = (reductionPct > 0 ? `${reductionPct}%` : '0%');

    const resultPlayer = container.querySelector('#compressedVideoPlayer');
    resultPlayer.src = compressedVideoUrl;

    // Output filename e.g. "myvideo-compressed.mp4"
    const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
    const ext = mimeType.includes('mp4') ? '.mp4' : '.webm';
    const outputFilename = `${baseName}-compressed${ext}`;

    const downloadBtn = container.querySelector('#downloadCompressedBtn');
    downloadBtn.href = compressedVideoUrl;
    downloadBtn.download = outputFilename;

    resultContainer.classList.add('active');
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    window.FileForge.showToast(`Video successfully compressed! Saved ${formatBytes(saved)} (${reductionPct}% reduction)`, 'success');
  }

  return {
    init,
    cleanup,
  };
})();
