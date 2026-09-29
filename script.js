/**
 * FileForge - Main Application Controller
 * Handles Navigation, Tool Registry, Universal Dropzone, Search & Filters,
 * Dynamic Tool Routing, and Toast Notifications.
 */

window.FileForge = window.FileForge || {};

(function () {
  // Global Toast Notification Helper
  window.FileForge.showToast = function (message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div style="flex: 1;">${message}</div>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 4000);
  };

  // Reliable cross-browser Blob download helper
  window.FileForge.downloadBlob = function (blob, filename) {
    if (typeof window.saveAs === 'function') {
      window.saveAs(blob, filename);
      return;
    }
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
    }, 4000);
  };

  // Complete Tool Registry
  const TOOLS = [
    // Video Tools
    {
      id: 'video-compressor',
      name: 'Video Compressor',
      category: 'video',
      description: 'Reduce video file size while controlling quality and resolution in your browser.',
      formats: ['MP4', 'WEBM', 'MOV', 'MKV'],
      isPopular: true,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'video-resizer',
      name: 'Video Resizer',
      category: 'video',
      description: 'Resize video resolution to 1080p, 720p, 480p, or custom aspect dimensions.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'video-converter',
      name: 'Video Converter',
      category: 'video',
      description: 'Convert video files between MP4, WebM, and browser-supported codecs.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'video-to-mp3',
      name: 'Video to MP3 / Audio',
      category: 'video',
      description: 'Extract audio soundtrack tracks directly from your video files.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'video-to-gif',
      name: 'Video to GIF',
      category: 'video',
      description: 'Convert video segments into animated lightweight GIF animations.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'change-video-resolution',
      name: 'Change Video Resolution',
      category: 'video',
      description: 'Scale down high-resolution 4K and 1080p videos to lower bandwidth resolutions.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },
    {
      id: 'change-video-quality',
      name: 'Change Video Quality',
      category: 'video',
      description: 'Re-encode video with specific target bitrates for email and messaging limits.',
      formats: ['MP4', 'WEBM'],
      isPopular: false,
      isReady: true,
      module: 'VideoCompressor',
    },

    // Image Tools
    {
      id: 'image-compressor',
      name: 'Image Compressor',
      category: 'image',
      description: 'Compress JPG, PNG and WebP images while maintaining visual quality.',
      formats: ['JPG', 'PNG', 'WEBP', 'GIF'],
      isPopular: true,
      isReady: true,
      module: 'ImageCompressor',
    },
    {
      id: 'image-resizer',
      name: 'Image Resizer',
      category: 'image',
      description: 'Resize image dimensions with aspect ratio lock and social media presets.',
      formats: ['JPG', 'PNG', 'WEBP', 'BMP'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'resizer',
    },
    {
      id: 'image-converter',
      name: 'Image Converter',
      category: 'image',
      description: 'Convert images instantly between JPG, PNG, WebP, and BMP formats.',
      formats: ['JPG', 'PNG', 'WEBP', 'BMP'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'converter',
    },
    {
      id: 'jpg-to-png',
      name: 'JPG to PNG',
      category: 'image',
      description: 'Convert JPG photos to lossless PNG format with transparent canvas support.',
      formats: ['JPG'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'jpg-to-png',
    },
    {
      id: 'png-to-jpg',
      name: 'PNG to JPG',
      category: 'image',
      description: 'Convert PNG graphics to compressed universal JPG format with background fill.',
      formats: ['PNG'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'png-to-jpg',
    },
    {
      id: 'webp-to-jpg',
      name: 'WebP to JPG',
      category: 'image',
      description: 'Transform modern WebP files into universally compatible JPG images.',
      formats: ['WEBP'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'webp-to-jpg',
    },
    {
      id: 'jpg-to-webp',
      name: 'JPG to WebP',
      category: 'image',
      description: 'Convert JPG to high-efficiency next-gen WebP to save up to 80% bandwidth.',
      formats: ['JPG'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'jpg-to-webp',
    },
    {
      id: 'png-to-webp',
      name: 'PNG to WebP',
      category: 'image',
      description: 'Convert lossless PNGs to efficient WebP while preserving alpha transparency.',
      formats: ['PNG'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'png-to-webp',
    },
    {
      id: 'image-to-pdf',
      name: 'Image to PDF',
      category: 'image',
      description: 'Combine images into a clean, downloadable multi-page PDF document.',
      formats: ['JPG', 'PNG', 'WEBP'],
      isPopular: true,
      isReady: true,
      module: 'ImageTools',
      subtool: 'to-pdf',
    },
    {
      id: 'image-cropper',
      name: 'Image Cropper',
      category: 'image',
      description: 'Interactive canvas crop tool with 1:1, 16:9, 4:3 and custom aspect ratios.',
      formats: ['JPG', 'PNG', 'WEBP'],
      isPopular: false,
      isReady: true,
      module: 'ImageTools',
      subtool: 'cropper',
    },

    // PDF Tools
    {
      id: 'pdf-to-word',
      name: 'PDF to Word',
      category: 'pdf',
      description: 'Convert PDF documents into editable Word files.',
      formats: ['PDF'],
      isPopular: true,
      isReady: false, // Requires proprietary server-side layout OCR; transparently handled
      module: 'PdfTools',
      subtool: 'to-word',
    },
    {
      id: 'word-to-pdf',
      name: 'Word to PDF',
      category: 'document',
      description: 'Convert supported Word documents into PDF.',
      formats: ['DOCX'],
      isPopular: true,
      isReady: true,
      module: 'DocumentTools',
      subtool: 'word-to-pdf',
    },
    {
      id: 'excel-to-pdf',
      name: 'Excel to PDF',
      category: 'document',
      description: 'Convert spreadsheet data into PDF.',
      formats: ['XLSX', 'XLS', 'CSV'],
      isPopular: true,
      isReady: true,
      module: 'DocumentTools',
      subtool: 'excel-to-pdf',
    },
    {
      id: 'merge-pdf',
      name: 'Merge PDF',
      category: 'pdf',
      description: 'Combine multiple PDF documents into one single organized PDF file.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'merge',
    },
    {
      id: 'split-pdf',
      name: 'Split PDF',
      category: 'pdf',
      description: 'Extract specific page ranges or individual pages from a PDF document.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'split',
    },
    {
      id: 'rotate-pdf',
      name: 'Rotate PDF',
      category: 'pdf',
      description: 'Permanently rotate PDF page orientation by 90°, 180°, or 270° degrees.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'rotate',
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      category: 'pdf',
      description: 'Convert each PDF page into high-resolution JPG images with batch ZIP export.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'to-jpg',
    },
    {
      id: 'pdf-to-text',
      name: 'PDF to Text',
      category: 'pdf',
      description: 'Extract plain text streams and words from all pages of your PDF document.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'to-text',
    },
    {
      id: 'pdf-compressor',
      name: 'PDF Compressor',
      category: 'pdf',
      description: 'Optimize internal streams and reduce overall PDF file weight locally.',
      formats: ['PDF'],
      isPopular: false,
      isReady: true,
      module: 'PdfTools',
      subtool: 'compress',
    },
    {
      id: 'pdf-to-excel',
      name: 'PDF to Excel',
      category: 'pdf',
      description: 'Extract tables, records, and structured data from PDF files into Excel (.xlsx).',
      formats: ['PDF'],
      isPopular: true,
      isReady: true,
      module: 'PdfTools',
      subtool: 'to-excel',
    },

    // Document Tools
    {
      id: 'word-to-excel',
      name: 'Word to Excel',
      category: 'document',
      description: 'Convert Word document tables into spreadsheet format.',
      formats: ['DOCX'],
      isPopular: false,
      isReady: true,
      module: 'DocumentTools',
      subtool: 'word-to-excel',
    },
    {
      id: 'word-to-jpg',
      name: 'Word to JPG',
      category: 'document',
      description: 'Render Word document preview pages into JPG image files.',
      formats: ['DOCX'],
      isPopular: false,
      isReady: true,
      module: 'DocumentTools',
      subtool: 'word-to-jpg',
    },
    {
      id: 'excel-to-word',
      name: 'Excel to Word',
      category: 'document',
      description: 'Convert Excel spreadsheet tables into Word document tables.',
      formats: ['XLSX', 'XLS'],
      isPopular: false,
      isReady: true,
      module: 'DocumentTools',
      subtool: 'excel-to-word',
    },
    {
      id: 'excel-to-jpg',
      name: 'Excel to JPG',
      category: 'document',
      description: 'Render spreadsheet worksheets as high-resolution image snapshots.',
      formats: ['XLSX', 'XLS'],
      isPopular: false,
      isReady: false,
      module: 'DocumentTools',
      subtool: 'excel-to-jpg',
    },
    {
      id: 'powerpoint-to-pdf',
      name: 'PowerPoint to PDF',
      category: 'document',
      description: 'Convert PowerPoint (.pptx) slides into PDF presentation documents.',
      formats: ['PPTX', 'PPT'],
      isPopular: false,
      isReady: false,
      module: 'DocumentTools',
      subtool: 'powerpoint-to-pdf',
    },
    {
      id: 'powerpoint-to-jpg',
      name: 'PowerPoint to JPG',
      category: 'document',
      description: 'Export PowerPoint presentation slides as individual JPG images.',
      formats: ['PPTX', 'PPT'],
      isPopular: false,
      isReady: false,
      module: 'DocumentTools',
      subtool: 'powerpoint-to-jpg',
    },

    // Other Tools
    {
      id: 'qr-generator',
      name: 'QR Code Generator',
      category: 'other',
      description: 'Generate high-res QR codes for websites, WiFi, and texts with color themes.',
      formats: ['PNG', 'SVG'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'qr-generator',
    },
    {
      id: 'qr-scanner',
      name: 'QR Code Scanner',
      category: 'other',
      description: 'Scan and decode QR codes from image files or directly from your webcam.',
      formats: ['JPG', 'PNG', 'CAM'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'qr-scanner',
    },
    {
      id: 'text-to-pdf',
      name: 'Text to PDF',
      category: 'other',
      description: 'Convert raw text, notes, and code snippets into clean formatted PDF files.',
      formats: ['TXT'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'text-to-pdf',
    },
    {
      id: 'text-to-word',
      name: 'Text to Word',
      category: 'other',
      description: 'Convert plain text notes into standard editable Microsoft Word (.doc) files.',
      formats: ['TXT'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'text-to-word',
    },
    {
      id: 'file-info',
      name: 'File Information & Hasher',
      category: 'other',
      description: 'Inspect exact byte sizes, MIME types, SHA-256 hash checksums, and hex dump.',
      formats: ['ANY'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'file-info',
    },
    {
      id: 'file-size-calculator',
      name: 'File Size Calculator',
      category: 'other',
      description: 'Calculate video bitrates, streaming file sizes, and download network times.',
      formats: ['CALC'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'file-size-calculator',
    },
    {
      id: 'zip-creator',
      name: 'ZIP Creator',
      category: 'other',
      description: 'Bundle and compress multiple files into a single downloadable .zip archive.',
      formats: ['ANY'],
      isPopular: false,
      isReady: true,
      module: 'OtherTools',
      subtool: 'zip-creator',
    },
  ];

  let currentActiveCategory = 'all';
  let searchQuery = '';

  // DOM Elements
  const headerEl = document.querySelector('.site-header');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  const popularToolsGrid = document.getElementById('popularToolsGrid');
  const allToolsGrid = document.getElementById('allToolsGrid');
  const searchInput = document.getElementById('searchToolsInput');
  const categoryTabs = document.getElementById('categoryTabs');
  const homeView = document.getElementById('homeView');
  const toolViewSection = document.getElementById('toolViewSection');
  const toolDynamicContainer = document.getElementById('toolDynamicContainer');
  const toolBreadcrumbCategory = document.getElementById('toolBreadcrumbCategory');
  const toolBreadcrumbName = document.getElementById('toolBreadcrumbName');
  const toolViewTitle = document.getElementById('toolViewTitle');
  const toolViewSubtitle = document.getElementById('toolViewSubtitle');
  const toolViewIcon = document.getElementById('toolViewIcon');
  const backToToolsBtn = document.getElementById('backToToolsBtn');

  // Universal Dropzone in Hero
  const heroDropzone = document.getElementById('heroDropzone');
  const heroFileInput = document.getElementById('heroFileInput');
  const heroBrowseBtn = document.getElementById('heroBrowseBtn');

  function init() {
    setupHeaderScroll();
    setupMobileMenu();
    renderPopularTools();
    renderAllTools();
    setupSearchAndFilter();
    setupUniversalHeroDropzone();
    setupRouting();
  }

  function setupHeaderScroll() {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 20) {
        headerEl.classList.add('scrolled');
      } else {
        headerEl.classList.remove('scrolled');
      }
    });
  }

  function setupMobileMenu() {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('active');
      mobileNav.classList.toggle('open');
    });

    document.querySelectorAll('.mobile-nav .nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        hamburgerBtn.classList.remove('active');
        mobileNav.classList.remove('open');
      });
    });
  }

  function getCategoryIcon(cat) {
    if (cat === 'video') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
    }
    if (cat === 'image') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    }
    if (cat === 'pdf') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
    }
    if (cat === 'document') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
  }

  function createToolCardElement(tool) {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.setAttribute('data-id', tool.id);

    const formatBadges = tool.formats.map((f) => `<span class="tool-badge">${f}</span>`).join('');
    const statusBadge = tool.isReady
      ? `<span class="tool-badge status-ready">Client-Side</span>`
      : `<span class="tool-badge status-notice">Notice</span>`;

    card.innerHTML = `
      <div class="tool-card-top">
        <div class="tool-icon-box ${tool.category}">
          ${getCategoryIcon(tool.category)}
        </div>
        <div>
          <h3 class="tool-title">${tool.name}</h3>
          <p class="tool-desc">${tool.description}</p>
        </div>
      </div>
      <div>
        <div class="tool-badge-row">
          ${formatBadges}
          ${statusBadge}
        </div>
        <div class="tool-card-bottom">
          <span class="open-tool-btn">
            <span>Open Tool</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      openTool(tool.id);
    });

    return card;
  }

  function renderPopularTools() {
    if (!popularToolsGrid) return;
    popularToolsGrid.innerHTML = '';
    const popularList = TOOLS.filter((t) => t.isPopular);
    popularList.forEach((tool) => {
      popularToolsGrid.appendChild(createToolCardElement(tool));
    });
  }

  function renderAllTools() {
    if (!allToolsGrid) return;
    allToolsGrid.innerHTML = '';

    const filtered = TOOLS.filter((tool) => {
      const matchesCat = currentActiveCategory === 'all' || tool.category === currentActiveCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.description.toLowerCase().includes(q) ||
        tool.formats.some((f) => f.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });

    if (filtered.length === 0) {
      allToolsGrid.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <h3>No matching tools found</h3>
          <p style="margin-top: 6px;">Try adjusting your search terms or filter category.</p>
        </div>
      `;
      return;
    }

    filtered.forEach((tool) => {
      allToolsGrid.appendChild(createToolCardElement(tool));
    });

    updateCategoryTabCounts();
  }

  function updateCategoryTabCounts() {
    if (!categoryTabs) return;
    categoryTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      const cat = btn.getAttribute('data-category');
      const countEl = btn.querySelector('.tab-count');
      if (countEl) {
        if (cat === 'all') {
          countEl.textContent = TOOLS.length;
        } else {
          countEl.textContent = TOOLS.filter((t) => t.category === cat).length;
        }
      }
    });
  }

  function setupSearchAndFilter() {
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderAllTools();
      });
    }

    if (categoryTabs) {
      categoryTabs.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          categoryTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          currentActiveCategory = btn.getAttribute('data-category');
          renderAllTools();
        });
      });
    }
  }

  // Universal Dropzone: Smart Dispatcher
  function setupUniversalHeroDropzone() {
    if (!heroDropzone || !heroFileInput) return;

    heroBrowseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      heroFileInput.click();
    });

    heroDropzone.addEventListener('click', () => {
      heroFileInput.click();
    });

    heroFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        smartDispatchFiles(Array.from(e.target.files));
      }
    });

    heroDropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      heroDropzone.classList.add('dragover');
    });

    heroDropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      heroDropzone.classList.remove('dragover');
    });

    heroDropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      heroDropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        smartDispatchFiles(Array.from(e.dataTransfer.files));
      }
    });
  }

  function smartDispatchFiles(files) {
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      // Multiple files: check if all images
      const allImages = files.every((f) => f.type.startsWith('image/'));
      if (allImages) {
        openTool('image-compressor', files);
        return;
      }
      const allPdfs = files.every((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      if (allPdfs) {
        openTool('merge-pdf', files);
        return;
      }
      // General package
      openTool('zip-creator', files);
      return;
    }

    const file = files[0];
    const name = file.name.toLowerCase();
    const type = file.type;

    if (type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(name)) {
      openTool('video-compressor', file);
    } else if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(name)) {
      openTool('image-compressor', file);
    } else if (type === 'application/pdf' || /\.pdf$/i.test(name)) {
      openTool('pdf-to-jpg', file);
    } else if (/\.(xlsx|xls|csv)$/i.test(name)) {
      openTool('excel-to-pdf', file);
    } else if (/\.(docx|doc)$/i.test(name)) {
      openTool('word-to-pdf', file);
    } else {
      openTool('file-info', file);
    }
  }

  // Routing and Tool View Launch
  function setupRouting() {
    window.addEventListener('hashchange', handleRoute);
    if (window.location.hash) {
      handleRoute();
    }

    backToToolsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '';
      closeToolView();
    });

    // Logo click: return home
    document.querySelectorAll('.logo-container').forEach((logo) => {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '';
        closeToolView();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Nav Links click
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href.startsWith('#category-')) {
          e.preventDefault();
          const cat = href.replace('#category-', '');
          closeToolView();
          selectCategory(cat);
          const allToolsSection = document.getElementById('allToolsSection');
          if (allToolsSection) allToolsSection.scrollIntoView({ behavior: 'smooth' });
        } else if (href === '#all-tools') {
          e.preventDefault();
          closeToolView();
          selectCategory('all');
          const allToolsSection = document.getElementById('allToolsSection');
          if (allToolsSection) allToolsSection.scrollIntoView({ behavior: 'smooth' });
        } else if (href === '#' || href === '#home') {
          e.preventDefault();
          closeToolView();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  function selectCategory(cat) {
    currentActiveCategory = cat;
    if (categoryTabs) {
      categoryTabs.querySelectorAll('.tab-btn').forEach((btn) => {
        if (btn.getAttribute('data-category') === cat) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    renderAllTools();
  }

  function handleRoute() {
    const hash = window.location.hash;
    if (hash.startsWith('#tool/')) {
      const toolId = hash.replace('#tool/', '');
      openTool(toolId);
    } else if (!hash) {
      closeToolView();
    }
  }

  function openTool(toolId, incomingFile = null) {
    const tool = TOOLS.find((t) => t.id === toolId);
    if (!tool) {
      window.FileForge.showToast('Tool not found.', 'error');
      return;
    }

    window.location.hash = `tool/${toolId}`;

    // Update Breadcrumbs & Header
    toolBreadcrumbCategory.textContent = tool.category.toUpperCase();
    toolBreadcrumbName.textContent = tool.name;
    toolViewTitle.textContent = tool.name;
    toolViewSubtitle.textContent = tool.description;
    toolViewIcon.innerHTML = getCategoryIcon(tool.category);
    toolViewIcon.className = `tool-view-icon tool-icon-box ${tool.category}`;

    // Cleanup any active module
    cleanupAllModules();

    // Show Tool View
    homeView.style.display = 'none';
    toolViewSection.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Initialize Tool Module
    const container = toolDynamicContainer;
    container.innerHTML = '';

    if (tool.module === 'VideoCompressor' && window.FileForge.VideoCompressor) {
      window.FileForge.VideoCompressor.init(container, incomingFile);
    } else if (tool.module === 'ImageCompressor' && window.FileForge.ImageCompressor) {
      window.FileForge.ImageCompressor.init(container, incomingFile);
    } else if (tool.module === 'ImageTools' && window.FileForge.ImageTools) {
      window.FileForge.ImageTools.init(container, incomingFile, tool.subtool || 'resizer');
    } else if (tool.module === 'PdfTools' && window.FileForge.PdfTools) {
      window.FileForge.PdfTools.init(container, incomingFile, tool.subtool || 'merge');
    } else if (tool.module === 'DocumentTools' && window.FileForge.DocumentTools) {
      window.FileForge.DocumentTools.init(container, incomingFile, tool.subtool || 'excel-to-pdf');
    } else if (tool.module === 'OtherTools' && window.FileForge.OtherTools) {
      window.FileForge.OtherTools.init(container, incomingFile, tool.subtool || 'qr-generator');
    } else {
      container.innerHTML = `
        <div class="notice-box">
          <div class="notice-title">${tool.name}</div>
          <p class="notice-desc">Initializing tool module...</p>
        </div>
      `;
    }
  }

  function closeToolView() {
    cleanupAllModules();
    toolViewSection.classList.remove('active');
    homeView.style.display = 'block';
  }

  function cleanupAllModules() {
    if (window.FileForge.VideoCompressor) window.FileForge.VideoCompressor.cleanup();
    if (window.FileForge.ImageCompressor) window.FileForge.ImageCompressor.cleanup();
    if (window.FileForge.ImageTools) window.FileForge.ImageTools.cleanup();
    if (window.FileForge.PdfTools) window.FileForge.PdfTools.cleanup();
    if (window.FileForge.DocumentTools) window.FileForge.DocumentTools.cleanup();
    if (window.FileForge.OtherTools) window.FileForge.OtherTools.cleanup();
  }

  // Export functions to global scope
  window.FileForge.openTool = openTool;
  window.FileForge.closeToolView = closeToolView;

  // Run on load
  document.addEventListener('DOMContentLoaded', init);
})();
