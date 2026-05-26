'use strict';

(function () {
  // Constants for canvas constraints and file validation
  const MAX_BG_WIDTH = 900; // Maximum width for background image
  const MAX_BG_HEIGHT = 600; // Maximum height for background image
  const MIN_SCALE_PERCENT = 5; // Minimum scale percentage for images
  const MAX_SCALE_PERCENT = 300; // Maximum scale percentage for images

  // File constraints - security limits
  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  // Export formats
  const EXPORT_JPG = 'jpg';
  const EXPORT_PNG = 'png';

  // UI feedback timeout
  const FEEDBACK_DURATION_MS = 3000;
  const RESIZE_HANDLE_SIZE = 16;
  const DEBOUNCE_DELAY_MS = 16; // ~60fps

  const DOM = {
    canvas: document.getElementById('composite'), // Main canvas for composition
    canvasWrap: document.getElementById('canvas-wrap'),
    stateEmpty: document.getElementById('state-empty'),
    canvasHint: document.getElementById('canvas-hint'),
    bgDrop: document.getElementById('bg-drop'), // Drop zone for background image
    bgInput: document.getElementById('bg-input'), // Input for background image
    bgThumb: document.getElementById('bg-thumb'), // Preview for background image
    fgDrop: document.getElementById('fg-drop'), // Drop zone for foreground image
    fgInput: document.getElementById('fg-input'), // Input for foreground image
    fgThumb: document.getElementById('fg-thumb'), // Preview for foreground image
    sizeSlider: document.getElementById('size-slider'), // Slider for image size
    sizeValue: document.getElementById('size-val'),
    opacitySlider: document.getElementById('opacity-slider'),
    opacityValue: document.getElementById('opacity-val'),
    rotSlider: document.getElementById('rot-slider'),
    rotValue: document.getElementById('rot-val'),
    qualitySlider: document.getElementById('quality-slider'),
    qualityValue: document.getElementById('quality-val'),
    textInput: document.getElementById('text-input'),
    textInputCount: document.getElementById('text-word-count'),
    textSizeSlider: document.getElementById('text-size-slider'),
    textSizeValue: document.getElementById('text-size-val'),
    textColor: document.getElementById('text-color'),
    textFont: document.getElementById('text-font'),
    subtitleInput: document.getElementById('subtitle-input'),
    subtitleSizeSlider: document.getElementById('subtitle-size-slider'),
    subtitleSizeValue: document.getElementById('subtitle-size-val'),
    subtitleFont: document.getElementById('subtitle-font'),
    subtitleItalic: document.getElementById('subtitle-italic'),
    subtitleColorInput: document.getElementById('subtitle-color-input'),
    descInput: document.getElementById('desc-input'),
    descSizeSlider: document.getElementById('desc-size-slider'),
    descSizeValue: document.getElementById('desc-size-val'),
    descColor: document.getElementById('desc-color'),
    descFont: document.getElementById('desc-font'),
    previewTextSize: document.getElementById('preview-text-size'),
    previewSubtitle: document.getElementById('preview-subtitle'),
    previewDescription: document.getElementById('preview-description'),
    previewPanel: document.querySelector('.preview-panel'),
    previewTextFont: document.getElementById('preview-text-font'),
    previewTextHandle: document.getElementById('preview-text-handle'),
    previewTextColorBtn: document.getElementById('preview-text-color-btn'),
    previewTextColorInput: document.getElementById('preview-text-color-input'),
    previewTextFontBtn: document.getElementById('preview-text-font-btn'),
    canvasTextOverlay: document.getElementById('canvas-text-overlay'),
    canvasTextSizeDec: document.getElementById('canvas-text-size-dec'),
    canvasTextSizeInc: document.getElementById('canvas-text-size-inc'),
    canvasTextBold: document.getElementById('canvas-text-bold'),
    canvasTextItalic: document.getElementById('canvas-text-italic'),
    canvasTextUnderline: document.getElementById('canvas-text-underline'),
    canvasTextColorBtn: document.getElementById('canvas-text-color-btn'),
    canvasTextColorInput: document.getElementById('canvas-text-color-input'),
    canvasTextFontBtn: document.getElementById('canvas-text-font-btn'),
    canvasTextFontSelect: document.getElementById('canvas-text-font-select'),
    canvasTextFontSelectbg: document.getElementById('canvas-text-bg-input'),
    canvasTextBgClear: document.getElementById('canvas-text-bg-clear'),
    textPosition: document.getElementById('text-position'),
    btnCenter: document.getElementById('btn-center'),
    btnFitW: document.getElementById('btn-fit-w'),
    btnFitH: document.getElementById('btn-fit-h'),
    btnReset: document.getElementById('btn-reset'),
    btnFlipH: document.getElementById('btn-flip-h'),
    btnFlipV: document.getElementById('btn-flip-v'),
    btnExport: document.getElementById('btn-export'),
    btnExportPng: document.getElementById('btn-export-png'),
  };

  let seleccionComponente = 0;//es el valor de selección del componente de los textos
  //Valores son 1 Titulo, 2 Descripción y 3 Subtítulo

  // Feedback notification system
  const feedback = {
    element: null,
    timeoutId: null,

    init() {
      // Create feedback element if not exists
      if (!this.element) {
        this.element = document.createElement('div');
        this.element.setAttribute('role', 'status');
        this.element.setAttribute('aria-live', 'polite');
        this.element.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 12px 16px;
          background: rgba(0,0,0,0.8);
          color: #fff;
          border-radius: 6px;
          font-size: 14px;
          z-index: 1000;
          max-width: 300px;
          display: none;
          animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(this.element);
      }
    },

    show(message, type = 'info') {
      this.init();
      this.element.textContent = message;
      this.element.style.backgroundColor = type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(0, 0, 0, 0.8)';
      this.element.style.display = 'block';

      window.clearTimeout(this.timeoutId);
      this.timeoutId = window.setTimeout(() => {
        this.element.style.display = 'none';
      }, FEEDBACK_DURATION_MS);
    },

    error(message) {
      this.show(message, 'error');
    },
  };

  let ctx = null;
  const state = {
    bgImg: null,
    fgImg: null,
    fg: {
      x: 50,
      y: 50,
      w: 200,
      h: 200,
      scale: 1,
      opacity: 1,
      rot: 0,
      flipH: false,
      flipV: false,
      borderRadiusPercent: 6,
      borderBlur: 12,
    },
    text: {
      content: '',
      size: 40,
      color: '#292828',
      backgroundColor: '#ffffff',
      position: 'top',
      x: null,
      y: null,
      fontFamily: "'Syne', 'Inter', sans-serif",
      bold: false,
      italic: false,
      underline: false,
    },
    description: {
      content: '',
      size: 18,
      color: '#2d2c2c',
      fontFamily: "'Inter', sans-serif",
      x: null,
      y: null,
      bold: false,
      italic: false,
      underline: false,
    },
    subtitle: {
      content: '',
      size: 28,
      color: '#373636',
      fontFamily: "'Inter', sans-serif",
      italic: false,
      x: null,
      y: null,
      bold: false,
      italic: false,
      underline: false,
    },
    dragging: false,
    draggingSubtitle: false,
    resizing: false,
    draggingText: false,
    draggingDesc: false,
    dragStart: { mx: 0, my: 0, fx: 0, fy: 0 },
    resizeStart: {},
    textDragStart: {},
    descDragStart: {},
    subtitleDragStart: {},
    overlayPinned: false,
    hintTimer: null,
  };

  // Security: validate file type and size
  const isValidImageFile = (file) => {
    if (!file) return false;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) return false;
    if (file.size > MAX_FILE_SIZE_BYTES) return false;
    return true;
  };

  const getFileErrorMessage = (file) => {
    if (!file) return 'Por favor selecciona un archivo.';
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return `Formato no permitido. Usa: JPEG, PNG o WebP.`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `El archivo es demasiado grande. Máximo: ${MAX_FILE_SIZE_MB}MB.`;
    }
    return 'Archivo inválido.';
  };
  // Utility: clamp value between min and max
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  // Utility: update element text content safely
  const updateText = (element, value) => {
    if (element) element.textContent = value;
  };

  const setCanvasVisibility = visible => {
    if (DOM.canvasWrap) DOM.canvasWrap.style.display = visible ? 'block' : 'none';
    if (DOM.stateEmpty) DOM.stateEmpty.style.display = visible ? 'none' : 'block';
  };

  async function loadImage(file) {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.alt = ''; // Security: empty alt for programmatic images

    return new Promise((resolve, reject) => {
      // Security: timeout to prevent hanging
      const timeoutId = window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Carga de imagen agotada.'));
      }, 10000);

      image.onload = () => {
        window.clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = () => {
        window.clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo cargar la imagen. Verifica que sea un archivo válido.'));
      };

      image.src = objectUrl;
    });
  }

  function render() {
    if (!state.bgImg) {
      return;
    }

    const canvas = DOM.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.bgImg, 0, 0, canvas.width, canvas.height);

    if (state.fgImg) {
      const cw = state.fg.w * state.fg.scale;
      const ch = state.fg.h * state.fg.scale;
      const cx = state.fg.x + cw / 2;
      const cy = state.fg.y + ch / 2;

      // Draw foreground image with rounded corners
      ctx.save();
      ctx.globalAlpha = state.fg.opacity;
      ctx.translate(cx, cy);
      ctx.rotate((state.fg.rot * Math.PI) / 180);
      ctx.scale(state.fg.flipH ? -1 : 1, state.fg.flipV ? -1 : 1);
      const radius = Math.min(cw, ch) * (state.fg.borderRadiusPercent / 100);
      try {
        roundedRectPath(ctx, -cw / 2, -ch / 2, cw, ch, radius);
        ctx.clip();
      } catch (e) {
        // fallback to no clipping
      }
      ctx.drawImage(state.fgImg, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();

      // Draw blurred rounded border (axis-aligned to current bbox)
      try {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = state.fg.borderBlur || 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(2, (state.fg.borderBlur || 12) / 2);
        roundedRectPath(ctx, state.fg.x - 1, state.fg.y - 1, cw + 2, ch + 2, radius);
        ctx.stroke();
        ctx.restore();
      } catch (e) {
        // ignore border drawing errors
      }
      // Draw selection border and resize handle
      try {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(state.fg.x - 1, state.fg.y - 1, cw + 2, ch + 2);
        ctx.setLineDash([]);

        // handle at bottom-right
        const handleX = state.fg.x + cw;
        const handleY = state.fg.y + ch;
        const hs = RESIZE_HANDLE_SIZE;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(handleX - hs / 2, handleY - hs / 2, hs, hs);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } catch (e) {
        // Drawing helpers should not break main render
      }
    }

    drawDescriptionOverlay(ctx, DOM.canvas.width, DOM.canvas.height);
    drawTextOverlay(ctx, DOM.canvas.width, DOM.canvas.height);
    // draw subtitle below main text
    try { drawSubtitleOverlay(ctx, DOM.canvas.width, DOM.canvas.height); } catch (e) {}
    // Update overlay position only when pinned (stay put while editing)
    try { if (state.overlayPinned) updateTextOverlayPosition(); } catch (e) {}
  }

  // Position the floating overlay controls above the text anchor on the page
  // Position the floating overlay controls. If pointerPage is provided (clientX/clientY), prefer that
  // to position the overlay near the pointer; otherwise place above the text anchor.
  function updateTextOverlayPosition(pointerPage) {
    const overlay = DOM.canvasTextOverlay;
    if (!overlay) return;
    const content = state.text.content && state.text.content.trim();
    if (!content) {
      overlay.style.display = 'none';
      return;
    }

    const metrics = computeTextBlockMetrics(DOM.canvas.width, DOM.canvas.height);
    if (!metrics) {
      overlay.style.display = 'none';
      return;
    }

    const canvasRect = DOM.canvas.getBoundingClientRect();
    const containerRect = overlay.parentElement ? overlay.parentElement.getBoundingClientRect() : canvasRect;
    let pageX, pageY;
    if (pointerPage && typeof pointerPage.x === 'number' && typeof pointerPage.y === 'number') {
      pageX = pointerPage.x;
      pageY = pointerPage.y - 12; // offset slightly above pointer
    } else {
      const scaleX = canvasRect.width / DOM.canvas.width;
      const scaleY = canvasRect.height / DOM.canvas.height;
      pageX = canvasRect.left + metrics.anchorX * scaleX;
      pageY = canvasRect.top + metrics.anchorY * scaleY;
    }

    // Convert page coords to overlay-parent relative coords
    const relLeft = pageX - containerRect.left;
    const relTop = pageY - containerRect.top;

    overlay.style.display = 'flex';
    overlay.style.left = `${relLeft}px`;
    overlay.style.top = `${relTop}px`;
  }

  function drawDescriptionOverlay(renderCtx, width, height) {
    const content = state.description.content.trim();
    if (!content) return;

    renderCtx.save();
    renderCtx.font = `${state.description.size}px ${state.description.fontFamily}`;
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'middle';
    renderCtx.fillStyle = state.description.color;
    renderCtx.strokeStyle = 'rgba(0,0,0,0.45)';
    renderCtx.lineWidth = Math.max(1, state.description.size * 0.04);

    const maxTextWidth = width * 0.6;
    const lines = wrapText(renderCtx, content, maxTextWidth);
    const lineHeight = state.description.size * 1.15;

    // default position: below foreground image if present
    let anchorX = state.description.x;
    let anchorY = state.description.y;
    if (anchorX === null || anchorY === null) {
      if (state.fgImg) {
        const cw = state.fg.w * state.fg.scale;
        const ch = state.fg.h * state.fg.scale;
        anchorX = state.fg.x + cw / 2;
        anchorY = Math.min(height - lineHeight, state.fg.y + ch + lineHeight);
      } else {
        anchorX = width / 2;
        anchorY = height - lineHeight * lines.length - 10;
      }
    }

    const blockHeight = lines.length * lineHeight;
    const startY = anchorY - blockHeight / 2 + lineHeight / 2;
    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      renderCtx.strokeText(line, anchorX, lineY, maxTextWidth);
      renderCtx.fillText(line, anchorX, lineY, maxTextWidth);
    });
    renderCtx.restore();
  }

  function computeDescBlockMetrics(width, height) {
    if (!ctx) return null;
    const content = state.description.content.trim();
    if (!content) return null;
    ctx.save();
    ctx.font = `${state.description.size}px ${state.description.fontFamily}`;
    const maxTextWidth = width * 0.6;
    const lines = wrapText(ctx, content, maxTextWidth);
    const lineHeight = state.description.size * 1.15;
    const blockHeight = lines.length * lineHeight;

    let anchorX = state.description.x;
    let anchorY = state.description.y;
    if (anchorX === null || anchorY === null) {
      if (state.fgImg) {
        const cw = state.fg.w * state.fg.scale;
        const ch = state.fg.h * state.fg.scale;
        anchorX = state.fg.x + cw / 2;
        anchorY = Math.min(height - lineHeight, state.fg.y + ch + lineHeight);
      } else {
        anchorX = width / 2;
        anchorY = height - lineHeight * lines.length - 10;
      }
    }

    // estimate max line width
    let maxLineWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });

    const left = anchorX - maxLineWidth / 2;
    const top = anchorY - blockHeight / 2;
    ctx.restore();
    return { left, top, width: maxLineWidth, height: blockHeight, anchorX, anchorY };
  }

  function isOnDescription(x, y) {
    const metrics = computeDescBlockMetrics(DOM.canvas.width, DOM.canvas.height);
    if (!metrics) return false;
    return x >= metrics.left && x <= metrics.left + metrics.width && y >= metrics.top && y <= metrics.top + metrics.height;
  }

  function wrapText(renderCtx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        lines.push('');
        return;
      }

      let currentLine = words[0];
      for (let i = 1; i < words.length; i += 1) {
        const word = words[i];
        const candidate = `${currentLine} ${word}`;
        const width = renderCtx.measureText(candidate).width;
        if (width <= maxWidth) {
          currentLine = candidate;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
    });

    return lines;
  }

  function drawTextOverlay(renderCtx, width, height) {
    const content = state.text.content.trim();
    if (!content) {
      return;
    }

    // Compute text block metrics
    renderCtx.save();
    const textItalicPrefix = state.text.italic ? 'italic ' : '';
    const textWeightPrefix = state.text.bold ? '700 ' : '';
    renderCtx.font = `${textItalicPrefix}${textWeightPrefix}${state.text.size}px ${state.text.fontFamily}`;
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'middle';
    renderCtx.fillStyle = state.text.color;
    renderCtx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    renderCtx.lineWidth = Math.max(2, state.text.size * 0.06);
    renderCtx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    renderCtx.shadowBlur = 10;

    const maxTextWidth = width * 0.85;
    const lines = wrapText(renderCtx, content, maxTextWidth);
    const lineHeight = state.text.size * 1.2;

    // Determine anchor position (use stored x/y if user moved the text)
    let anchorX = state.text.x;
    let anchorY = state.text.y;

    const blockHeight = lines.length * lineHeight;
    let defaultY = height * 0.15;
    if (state.text.position === 'center') {
      defaultY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    } else if (state.text.position === 'bottom') {
      defaultY = height * 0.75 - ((lines.length - 1) * lineHeight) / 2;
    }

    if (anchorX === null || anchorY === null) {
      anchorX = width / 2;
      anchorY = defaultY + (blockHeight - lineHeight) / 2;
    }

    const startY = anchorY - blockHeight / 2 + lineHeight / 2;

    const drawBackground = state.text.backgroundColor && state.text.backgroundColor !== '#ffffff';
    if (drawBackground) {
      const padding = Math.max(8, Math.round(state.text.size * 0.2));
      let maxLineWidth = 0;
      lines.forEach(line => {
        const metrics = renderCtx.measureText(line);
        if (metrics.width > maxLineWidth) maxLineWidth = metrics.width;
      });
      const blockWidth = maxLineWidth + padding * 2;
      const blockTop = startY - lineHeight / 2 - padding;
      const blockLeft = anchorX - blockWidth / 2;
      const blockHeightWithPadding = blockHeight + padding * 2;

      renderCtx.save();
      renderCtx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      renderCtx.shadowBlur = 8;
      renderCtx.fillStyle = state.text.backgroundColor;
      renderCtx.fillRect(blockLeft, blockTop, blockWidth, blockHeightWithPadding);
      renderCtx.restore();
    }

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      renderCtx.strokeText(line, anchorX, lineY, maxTextWidth);
      renderCtx.fillText(line, anchorX, lineY, maxTextWidth);

      // Underline support: draw a line below the text if enabled
      if (state.text.underline) {
        try {
          const metrics = renderCtx.measureText(line) || { width: renderCtx.measureText(line).width };
          const textWidth = metrics.width || renderCtx.measureText(line).width;
          const underlineThickness = Math.max(1, Math.round(state.text.size * 0.06));
          // baseline is 'middle' so offset downwards
          const underlineOffset = state.text.size * 0.45;
          const startX = anchorX - textWidth / 2;
          const endX = anchorX + textWidth / 2;
          renderCtx.save();
          renderCtx.shadowBlur = 0; // keep underline crisp
          renderCtx.lineWidth = underlineThickness;
          renderCtx.strokeStyle = state.text.color;
          renderCtx.beginPath();
          renderCtx.moveTo(startX, lineY + underlineOffset);
          renderCtx.lineTo(endX, lineY + underlineOffset);
          renderCtx.stroke();
          renderCtx.restore();
        } catch (e) {
          // ignore underline drawing errors
        }
      }
    });
    renderCtx.restore();
  }

  function drawSubtitleOverlay(renderCtx, width, height) {
    const content = state.subtitle.content && state.subtitle.content.trim();
    if (!content) return;

    renderCtx.save();
    const italicPrefix = state.subtitle.italic ? 'italic ' : '';
    renderCtx.font = `${italicPrefix}${state.subtitle.size}px ${state.subtitle.fontFamily}`;
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'middle';
    renderCtx.fillStyle = state.subtitle.color || state.text.color || '#ffffff';
    renderCtx.lineWidth = Math.max(1, state.subtitle.size * 0.04);
    renderCtx.strokeStyle = 'rgba(0,0,0,0.45)';

    const maxTextWidth = width * 0.85;
    const lines = wrapText(renderCtx, content, maxTextWidth);
    const lineHeight = state.subtitle.size * 1.15;

    // position relative to main text anchor (below it) or explicit state.subtitle.x/y
    let mainMetrics = computeTextBlockMetrics(width, height);
    let anchorX = width / 2;
    let anchorY = height * 0.15 + 50;
    if (mainMetrics) {
      anchorX = mainMetrics.anchorX;
      anchorY = mainMetrics.anchorY + mainMetrics.height / 2 + lineHeight;
    }
    if (typeof state.subtitle.x === 'number') anchorX = state.subtitle.x;
    if (typeof state.subtitle.y === 'number') anchorY = state.subtitle.y;

    const blockHeight = lines.length * lineHeight;
    const startY = anchorY - blockHeight / 2 + lineHeight / 2;
    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      renderCtx.strokeText(line, anchorX, lineY, maxTextWidth);
      renderCtx.fillText(line, anchorX, lineY, maxTextWidth);
    });
    renderCtx.restore();
  }

  // Helper: rounded rectangle path
  function roundedRectPath(ctx2, x, y, w, h, r) {
    const radius = Math.max(0, r);
    ctx2.beginPath();
    ctx2.moveTo(x + radius, y);
    ctx2.lineTo(x + w - radius, y);
    ctx2.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx2.lineTo(x + w, y + h - radius);
    ctx2.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx2.lineTo(x + radius, y + h);
    ctx2.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx2.lineTo(x, y + radius);
    ctx2.quadraticCurveTo(x, y, x + radius, y);
    ctx2.closePath();
  }

  // Compute text block metrics for hit testing
  function computeTextBlockMetrics(width, height) {
    if (!ctx) return null;
    const content = state.text.content.trim();
    if (!content) return null;

    ctx.save();
    const metricsItalicPrefix = state.text.italic ? 'italic ' : '';
    const metricsWeightPrefix = state.text.bold ? '700 ' : '';
    ctx.font = `${metricsItalicPrefix}${metricsWeightPrefix}${state.text.size}px ${state.text.fontFamily}`;
    const maxTextWidth = width * 0.85;
    const lines = wrapText(ctx, content, maxTextWidth);
    const lineHeight = state.text.size * 1.2;
    const blockHeight = lines.length * lineHeight;

    let anchorX = state.text.x;
    let anchorY = state.text.y;
    let defaultY = height * 0.15;
    if (state.text.position === 'center') {
      defaultY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
    } else if (state.text.position === 'bottom') {
      defaultY = height * 0.75 - ((lines.length - 1) * lineHeight) / 2;
    }
    if (anchorX === null || anchorY === null) {
      anchorX = width / 2;
      anchorY = defaultY + (blockHeight - lineHeight) / 2;
    }

    // Determine max line width
    let maxLineWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });

    const left = anchorX - maxLineWidth / 2;
    const top = anchorY - blockHeight / 2;
    ctx.restore();

    return { left, top, width: maxLineWidth, height: blockHeight, anchorX, anchorY };
  }

  function isOnText(x, y) {
    const metrics = computeTextBlockMetrics(DOM.canvas.width, DOM.canvas.height);
    if (!metrics) return false;
    return x >= metrics.left && x <= metrics.left + metrics.width && y >= metrics.top && y <= metrics.top + metrics.height;
  }

  // Compute subtitle block metrics for hit testing
  function computeSubtitleBlockMetrics(width, height) {
    if (!ctx) return null;
    const content = state.subtitle.content && state.subtitle.content.trim();
    if (!content) return null;

    ctx.save();
    const italicPrefix = state.subtitle.italic ? 'italic ' : '';
    ctx.font = `${italicPrefix}${state.subtitle.size}px ${state.subtitle.fontFamily}`;
    const maxTextWidth = width * 0.85;
    const lines = wrapText(ctx, content, maxTextWidth);
    const lineHeight = state.subtitle.size * 1.15;
    const blockHeight = lines.length * lineHeight;

    let mainMetrics = computeTextBlockMetrics(width, height);
    let anchorX = width / 2;
    let anchorY = height * 0.15 + 50;
    if (mainMetrics) {
      anchorX = mainMetrics.anchorX;
      anchorY = mainMetrics.anchorY + mainMetrics.height / 2 + lineHeight;
    }
    if (typeof state.subtitle.x === 'number') anchorX = state.subtitle.x;
    if (typeof state.subtitle.y === 'number') anchorY = state.subtitle.y;

    // Determine max line width
    let maxLineWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });

    const left = anchorX - maxLineWidth / 2;
    const top = anchorY - blockHeight / 2;
    ctx.restore();

    return { left, top, width: maxLineWidth, height: blockHeight, anchorX, anchorY };
  }

  function isOnSubtitle(x, y) {
    const metrics = computeSubtitleBlockMetrics(DOM.canvas.width, DOM.canvas.height);
    if (!metrics) return false;
    return x >= metrics.left && x <= metrics.left + metrics.width && y >= metrics.top && y <= metrics.top + metrics.height;
  }

  function getCanvasPosition(event) {
    const rect = DOM.canvas.getBoundingClientRect();
    const scaleX = DOM.canvas.width / rect.width;
    const scaleY = DOM.canvas.height / rect.height;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function isInsideForeground(x, y) {
    if (!state.fgImg) {
      return false;
    }

    const cw = state.fg.w * state.fg.scale;
    const ch = state.fg.h * state.fg.scale;
    return x >= state.fg.x && x <= state.fg.x + cw && y >= state.fg.y && y <= state.fg.y + ch;
  }

  // Hit detection: check if point is on the resize handle corner
  function isOnResizeHandle(x, y) {
    if (!state.fgImg) {
      return false;
    }

    const cw = state.fg.w * state.fg.scale;
    const ch = state.fg.h * state.fg.scale;
    const handleX = state.fg.x + cw;
    const handleY = state.fg.y + ch;
    return Math.abs(x - handleX) < RESIZE_HANDLE_SIZE && Math.abs(y - handleY) < RESIZE_HANDLE_SIZE;
  }

  function updateSizeControls(percent) {
    const clamped = clamp(percent, MIN_SCALE_PERCENT, MAX_SCALE_PERCENT);
    state.fg.scale = clamped / 100;
    if (DOM.sizeSlider) DOM.sizeSlider.value = String(clamped);
    updateText(DOM.sizeValue, `${clamped}%`);
  }

  function updateRotationControls(angle) {
    state.fg.rot = angle;
    updateText(DOM.rotValue, `${angle}°`);
  }

  function updateOpacityControls(value) {
    state.fg.opacity = value;
    updateText(DOM.opacityValue, `${Math.round(value * 100)}%`);
  }

  function showHint() {
    DOM.canvasHint.classList.add('show');
    window.clearTimeout(state.hintTimer);
    state.hintTimer = window.setTimeout(() => {
      DOM.canvasHint.classList.remove('show');
    }, 2500);
  }

  function setupBackground(image) {
    state.bgImg = image;

    const ratio = Math.min(
      MAX_BG_WIDTH / image.naturalWidth,
      MAX_BG_HEIGHT / image.naturalHeight,
      1,
    );

    DOM.canvas.width = Math.round(image.naturalWidth * ratio);
    DOM.canvas.height = Math.round(image.naturalHeight * ratio);

    setCanvasVisibility(true);
    render();
  }

  function setupForeground(image) {
    state.fgImg = image;
    state.fg.w = Math.round((image.naturalWidth * DOM.canvas.width) / image.naturalWidth * 0.4);
    state.fg.h = Math.round((image.naturalHeight * state.fg.w) / image.naturalWidth);
    state.fg.x = Math.round((DOM.canvas.width - state.fg.w) / 2);
    state.fg.y = Math.round((DOM.canvas.height - state.fg.h) / 2);
    state.fg.scale = 1;
    state.fg.rot = 0;
    state.fg.flipH = false;
    state.fg.flipV = false;
    state.fg.opacity = 1;

    updateSizeControls(100);
    updateRotationControls(0);
    updateOpacityControls(1);
    showHint();
    render();
  }

  function configureDropZone(dropElement, inputElement, thumbElement, callback) {
    const setPreview = (file) => {
      const previewUrl = URL.createObjectURL(file);
      thumbElement.src = previewUrl;
      thumbElement.classList.add('visible');

      // Security: revoke URL immediately after image loads
      const revokeUrl = () => {
        thumbElement.removeEventListener('load', revokeUrl);
        URL.revokeObjectURL(previewUrl);
      };
      thumbElement.addEventListener('load', revokeUrl);

      dropElement.classList.add('loaded');
    };

    inputElement.addEventListener('change', async event => {
      const file = event.target.files?.[0];

      if (!isValidImageFile(file)) {
        feedback.error(getFileErrorMessage(file));
        return;
      }

      setPreview(file);
      try {
        const image = await loadImage(file);
        callback(image);
      } catch (error) {
        feedback.error(error?.message || 'Error al cargar la imagen.');
        // Reset preview on error
        thumbElement.src = '';
        thumbElement.classList.remove('visible');
        dropElement.classList.remove('loaded');
      }
    });

    dropElement.addEventListener('dragover', event => {
      event.preventDefault();
      event.stopPropagation();
      dropElement.classList.add('active');
    });

    dropElement.addEventListener('dragleave', event => {
      event.preventDefault();
      event.stopPropagation();
      dropElement.classList.remove('active');
    });

    dropElement.addEventListener('drop', async event => {
      event.preventDefault();
      event.stopPropagation();
      dropElement.classList.remove('active');

      const file = event.dataTransfer?.files?.[0];

      if (!isValidImageFile(file)) {
        feedback.error(getFileErrorMessage(file));
        return;
      }

      setPreview(file);
      try {
        const image = await loadImage(file);
        callback(image);
      } catch (error) {
        feedback.error(error?.message || 'Error al cargar la imagen.');
        thumbElement.src = '';
        thumbElement.classList.remove('visible');
        dropElement.classList.remove('loaded');
      }
    });
  }

  function exportComposite(format, quality) {
    if (!state.bgImg) {
      feedback.show('Carga el fondo primero.');
      return;
    }

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = state.bgImg.naturalWidth;
      exportCanvas.height = state.bgImg.naturalHeight;

      if (exportCanvas.width <= 0 || exportCanvas.height <= 0) {
        feedback.error('Las dimensiones de la imagen no son válidas.');
        return;
      }

      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) {
        feedback.error('No se pudo crear el contexto de exportación.');
        return;
      }

      exportCtx.drawImage(state.bgImg, 0, 0, exportCanvas.width, exportCanvas.height);

      if (state.fgImg) {
        const scaleX = state.bgImg.naturalWidth / DOM.canvas.width;
        const scaleY = state.bgImg.naturalHeight / DOM.canvas.height;
        const cw = state.fg.w * state.fg.scale * scaleX;
        const ch = state.fg.h * state.fg.scale * scaleY;
        const cx = (state.fg.x + (state.fg.w * state.fg.scale) / 2) * scaleX;
        const cy = (state.fg.y + (state.fg.h * state.fg.scale) / 2) * scaleY;

        exportCtx.save();
        exportCtx.globalAlpha = clamp(state.fg.opacity, 0, 1);
        exportCtx.translate(cx, cy);
        exportCtx.rotate((state.fg.rot * Math.PI) / 180);
        exportCtx.scale(state.fg.flipH ? -1 : 1, state.fg.flipV ? -1 : 1);
        exportCtx.drawImage(state.fgImg, -cw / 2, -ch / 2, cw, ch);
        exportCtx.restore();
      }

      // Draw description first (same order as on-screen render), then main text
      drawDescriptionOverlay(exportCtx, exportCanvas.width, exportCanvas.height);
      drawTextOverlay(exportCtx, exportCanvas.width, exportCanvas.height);
      try { drawSubtitleOverlay(exportCtx, exportCanvas.width, exportCanvas.height); } catch (e) {}

      const mimeType = format === EXPORT_PNG ? 'image/png' : 'image/jpeg';
      const extension = format === EXPORT_PNG ? EXPORT_PNG : EXPORT_JPG;
      const clampedQuality = clamp(quality, 0, 1);
      const dataUrl = exportCanvas.toDataURL(mimeType, clampedQuality);

      if (!dataUrl) {
        feedback.error('No se pudo exportar la imagen.');
        return;
      }

      // Security: validate data URL format before creating link
      if (!dataUrl.startsWith('data:')) {
        feedback.error('Error de seguridad en la exportación.');
        return;
      }

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `fotomix_resultado_${Date.now()}.${extension}`;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();

      // Security: cleanup
      window.setTimeout(() => {
        document.body.removeChild(link);
        link.href = '';
      }, 100);

      feedback.show('Imagen exportada correctamente.');
    } catch (error) {
      feedback.error('Error al exportar la imagen.');
    }
  }

  // Performance: debounce utility for high-frequency events
  function debounce(func, delay) {
    let timeoutId;
    return function debounced(...args) {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => func(...args), delay);
    };
  }

  function initializeControls() {
    if (DOM.bgDrop && DOM.bgInput && DOM.bgThumb) {
      configureDropZone(DOM.bgDrop, DOM.bgInput, DOM.bgThumb, setupBackground);
    }

    if (DOM.fgDrop && DOM.fgInput && DOM.fgThumb) {
      configureDropZone(DOM.fgDrop, DOM.fgInput, DOM.fgThumb, image => {
        if (!state.bgImg) {
          feedback.show('Primero carga el fondo.');
          return;
        }
        setupForeground(image);
      });
    }

    // Size control - validate input
    if (DOM.sizeSlider) {
      DOM.sizeSlider.addEventListener('input', event => {
        const percent = Number.parseInt(event.target.value, 10);
        if (!Number.isNaN(percent)) {
          updateSizeControls(percent);
          render();
        }
      });
    }

    // Opacity control - validate input
    if (DOM.opacitySlider) {
      DOM.opacitySlider.addEventListener('input', event => {
        const value = clamp(Number.parseInt(event.target.value, 10) / 100, 0, 1);
        updateOpacityControls(value);
        render();
      });
    }

    // Rotation control - validate input
    if (DOM.rotSlider) {
      DOM.rotSlider.addEventListener('input', event => {
        const degrees = Number.parseInt(event.target.value, 10);
        if (!Number.isNaN(degrees)) {
          updateRotationControls(degrees);
          render();
        }
      });
    }

    // Quality control
    if (DOM.qualitySlider) {
      DOM.qualitySlider.addEventListener('input', event => {
        const value = Number.parseInt(event.target.value, 10);
        if (!Number.isNaN(value)) {
          updateText(DOM.qualityValue, `${value}%`);
        }
      });
    }

    if (DOM.textInput) {
      DOM.textInput.addEventListener('input', event => {
        const value = event.target.value;
        state.text.content = value;
        updateText(DOM.textInputCount, `${value.length} / 120`);
        render();
      });
    }

    if (DOM.subtitleInput) {
      DOM.subtitleInput.addEventListener('input', event => {
        const value = event.target.value;
        state.subtitle.content = value;
        if (DOM.previewSubtitle) DOM.previewSubtitle.textContent = value || 'Subtítulo de ejemplo';
        try { updateText(DOM.subtitleSizeValue, `${state.subtitle.size}px`); } catch (e) {}
        try { updateText(document.getElementById('subtitle-word-count'), `${value.length}`); } catch (e) {}
        render();
      });
      try { DOM.subtitleInput.value = state.subtitle.content; } catch (e) {}
    }

    if (DOM.subtitleSizeSlider) {
      DOM.subtitleSizeSlider.addEventListener('input', event => {
        const value = clamp(Number.parseInt(event.target.value, 10), 12, 72);
        state.subtitle.size = value;
        updateText(DOM.subtitleSizeValue, `${value}px`);
        render();
      });
      try { DOM.subtitleSizeSlider.value = String(state.subtitle.size); } catch (e) {}
    }

    if (DOM.subtitleFont) {
      DOM.subtitleFont.addEventListener('change', event => {
        state.subtitle.fontFamily = event.target.value;
        try {
          const font = event.target.value;
          if (DOM.previewSubtitle) DOM.previewSubtitle.style.fontFamily = font;
          document.querySelectorAll('.preview-panel>.section-label').forEach(el => el.style.fontFamily = font);
        } catch (e) {}
        render();
      });
      try { DOM.subtitleFont.value = state.subtitle.fontFamily; } catch (e) {}
    }

    if (DOM.subtitleItalic) {
      DOM.subtitleItalic.addEventListener('change', event => {
        state.subtitle.italic = !!event.target.checked;
        render();
      });
      try { DOM.subtitleItalic.checked = state.subtitle.italic; } catch (e) {}
    }

    if (DOM.subtitleColorInput) {
      DOM.subtitleColorInput.addEventListener('input', event => {
        state.subtitle.color = event.target.value;
        try {
          if (DOM.previewSubtitle) DOM.previewSubtitle.style.color = state.subtitle.color;
          document.querySelectorAll('.preview-panel>.section-label').forEach(el => {
            el.style.color = state.subtitle.color;
          });
        } catch (e) {}
        render();
      });
      try { DOM.subtitleColorInput.value = state.subtitle.color || '#ffffff'; } catch (e) {}
    }

    if (DOM.descColor) {
      DOM.descColor.addEventListener('input', event => {
        state.description.color = event.target.value;
        try {
          if (DOM.previewDescription) DOM.previewDescription.style.color = state.description.color;
        } catch (e) {}
        render();
      });
      try { DOM.descColor.value = state.description.color || '#ffffff'; } catch (e) {}
    }

    if (DOM.textSizeSlider) {
      DOM.textSizeSlider.addEventListener('input', event => {
        const value = clamp(Number.parseInt(event.target.value, 10), 16, 96);
        state.text.size = value;
        updateText(DOM.textSizeValue, `${value}px`);
        if (DOM.previewTextSize) DOM.previewTextSize.value = String(value);
        render();
      });
    }

    if (DOM.textColor) {
      DOM.textColor.addEventListener('input', event => {
        state.text.color = event.target.value;
        render();
      });
    }

    if (DOM.textFont) {
      DOM.textFont.addEventListener('change', event => {
        state.text.fontFamily = event.target.value;
        if (DOM.previewTextFont) DOM.previewTextFont.value = event.target.value;
        // Apply selected font to preview-panel DOM elements for immediate feedback
        try {
          const font = event.target.value;
          const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
          previewSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.fontFamily = font);
          });
        } catch (e) {}
        render();
      });
      // initialize select to current font
      try { DOM.textFont.value = state.text.fontFamily; } catch (e) { }
    }

    if (DOM.previewTextSize) {
      DOM.previewTextSize.addEventListener('input', event => {
        const value = clamp(Number.parseInt(event.target.value, 10), 16, 96);
        state.text.size = value;
        updateText(DOM.textSizeValue, `${value}px`);
        if (DOM.textSizeSlider) DOM.textSizeSlider.value = String(value);
        render();
      });
      try { DOM.previewTextSize.value = String(state.text.size); } catch (e) {}
    }

    // Preview resize handle: allow dragging the icon to change preview text size in real time.
    if (DOM.previewTextHandle) {
      DOM.previewTextHandle.addEventListener('mousedown', event => {
        state.previewResizing = true;
        state.overlayPinned = true;
        state.previewResizeStart = { my: event.clientY, size: state.text.size };
        event.preventDefault();
      });

      window.addEventListener('mousemove', event => {
        if (!state.previewResizing) return;
        const dy = state.previewResizeStart.my - event.clientY; // drag up => increase
        const delta = Math.round(dy / 2);
        const newSize = clamp(state.previewResizeStart.size + delta, 16, 96);
        state.text.size = newSize;
        if (DOM.previewTextSize) DOM.previewTextSize.value = String(newSize);
        if (DOM.textSizeSlider) DOM.textSizeSlider.value = String(newSize);
        updateText(DOM.textSizeValue, `${newSize}px`);
        render();
      });

      window.addEventListener('mouseup', () => {
        state.previewResizing = false;
      });

      DOM.previewTextHandle.addEventListener('touchstart', event => {
        const t = event.touches && event.touches[0];
        if (!t) return;
        state.previewResizing = true;
        state.overlayPinned = true;
        state.previewResizeStart = { my: t.clientY, size: state.text.size };
        event.preventDefault();
      }, { passive: false });

      window.addEventListener('touchmove', event => {
        if (!state.previewResizing) return;
        const t = event.touches && event.touches[0];
        if (!t) return;
        const dy = state.previewResizeStart.my - t.clientY;
        const delta = Math.round(dy / 2);
        const newSize = clamp(state.previewResizeStart.size + delta, 16, 96);
        state.text.size = newSize;
        if (DOM.previewTextSize) DOM.previewTextSize.value = String(newSize);
        if (DOM.textSizeSlider) DOM.textSizeSlider.value = String(newSize);
        updateText(DOM.textSizeValue, `${newSize}px`);
        render();
        event.preventDefault();
      }, { passive: false });
    }

    if (DOM.previewTextFont) {
      DOM.previewTextFont.addEventListener('change', event => {
        state.text.fontFamily = event.target.value;
        if (DOM.textFont) DOM.textFont.value = event.target.value;
        try {
          const font = event.target.value;
          const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
          previewSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.fontFamily = font);
          });
        } catch (e) {}
        render();
      });
      try { DOM.previewTextFont.value = state.text.fontFamily; } catch (e) {}
    }

    // Preview text color button -> open hidden color input
    if (DOM.previewTextColorBtn && DOM.previewTextColorInput) {
      DOM.previewTextColorBtn.addEventListener('click', () => {
        DOM.previewTextColorInput.click();
      });

      DOM.previewTextColorInput.addEventListener('input', event => {
        state.text.color = event.target.value;
        if (DOM.textColor) DOM.textColor.value = event.target.value;
        render();
      });
      try { DOM.previewTextColorInput.value = state.text.color; } catch (e) {}
    }

    // Preview font button -> focus/open the preview font select
    if (DOM.previewTextFontBtn && DOM.previewTextFont) {
      DOM.previewTextFontBtn.addEventListener('click', () => {
        try { DOM.previewTextFont.focus(); DOM.previewTextFont.click(); } catch (e) { }
      });
    }

    if (DOM.previewSubtitle) {
      DOM.previewSubtitle.addEventListener('click', () => {
        if (DOM.subtitleColorInput) DOM.subtitleColorInput.click();
      });
      // Make preview subtitle draggable within the preview panel
      try {
        if (DOM.previewPanel) DOM.previewPanel.style.position = DOM.previewPanel.style.position || 'relative';
        const el = DOM.previewSubtitle;
        el.style.cursor = 'grab';
        let dragState = null;

        const startDrag = (clientX, clientY) => {
          const panelRect = DOM.previewPanel.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          // convert to panel-local coordinates
          const offsetX = clientX - elRect.left;
          const offsetY = clientY - elRect.top;
          dragState = { offsetX, offsetY, panelRect };
          el.style.position = 'absolute';
          el.style.zIndex = '5';
          el.style.cursor = 'grabbing';
          // prevent native drag and text selection
          try { el.addEventListener('dragstart', ev => ev.preventDefault()); } catch (e) {}
        };

        const moveDrag = (clientX, clientY) => {
          if (!dragState) return;
          const panelRect = dragState.panelRect;
          let left = clientX - panelRect.left - dragState.offsetX;
          let top = clientY - panelRect.top - dragState.offsetY;
          // clamp to panel
          left = Math.max(0, Math.min(left, panelRect.width - el.offsetWidth));
          top = Math.max(0, Math.min(top, panelRect.height - el.offsetHeight));
          el.style.left = `${left}px`;
          el.style.top = `${top}px`;

          // update canvas state mapping: use center of element as anchor
          const anchorX = left + el.offsetWidth / 2;
          const anchorY = top + el.offsetHeight / 2;
          const relX = anchorX / panelRect.width;
          const relY = anchorY / panelRect.height;
          state.subtitle.x = Math.round(relX * DOM.canvas.width);
          state.subtitle.y = Math.round(relY * DOM.canvas.height);
          render();
        };

        const endDrag = () => {
          dragState = null;
          el.style.cursor = 'grab';
          el.style.zIndex = '';
        };

        el.addEventListener('mousedown', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          startDrag(ev.clientX, ev.clientY);
        });

        window.addEventListener('mousemove', ev => {
          if (!dragState) return;
          moveDrag(ev.clientX, ev.clientY);
        });

        window.addEventListener('mouseup', () => {
          if (!dragState) return;
          endDrag();
        });

        // Touch support
        el.addEventListener('touchstart', ev => {
          const t = ev.touches && ev.touches[0];
          if (!t) return;
          ev.preventDefault();
          ev.stopPropagation();
          startDrag(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', ev => {
          if (!dragState) return;
          const t = ev.touches && ev.touches[0];
          if (!t) return;
          moveDrag(t.clientX, t.clientY);
          ev.preventDefault();
        }, { passive: false });

        window.addEventListener('touchend', () => {
          if (!dragState) return;
          endDrag();
        });
      } catch (e) {}
    }

    if (DOM.previewDescription) {
      DOM.previewDescription.addEventListener('click', () => {
        if (DOM.descColor) DOM.descColor.click();
      });
    }

    // Canvas toolbar: Negrita -> alterna negrita en el título de la vista previa
      try {
        const previewLabel = document.querySelector('.preview-panel>.section-label');
        // Color is now applied only to canvas text through render()
      if (DOM.canvasTextBold) {
        DOM.canvasTextBold.addEventListener('click', () => {
          state.text.bold = !state.text.bold;
          const isActive = state.text.bold;
          // Apply font-weight toggle to all relevant preview elements
          try {
            const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
            document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
              el.classList.toggle('text-bold-active', isActive);
              el.style.fontWeight = isActive ? '800' : '';
            });
          } catch (e) {}
          DOM.canvasTextBold.setAttribute('aria-pressed', String(isActive));
          render();
          try { updateTextOverlayPosition(); } catch (e) {}
        });
      }

      if (DOM.canvasTextItalic) {
        DOM.canvasTextItalic.addEventListener('click', () => {
          state.text.italic = !state.text.italic;
          const isActive = state.text.italic;
          try {
            const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
            document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
              el.classList.toggle('text-italic-active', isActive);
              el.style.fontStyle = isActive ? 'italic' : '';
            });
          } catch (e) {}
          DOM.canvasTextItalic.setAttribute('aria-pressed', String(isActive));
          render();
          try { updateTextOverlayPosition(); } catch (e) {}
        });
      }

      if (DOM.canvasTextUnderline) {
        DOM.canvasTextUnderline.addEventListener('click', () => {
          state.text.underline = !state.text.underline;
          const isActive = state.text.underline;
          try {
            const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
            document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
              el.classList.toggle('text-underline-active', isActive);
              el.style.textDecoration = isActive ? 'underline' : '';
            });
          } catch (e) {}
          DOM.canvasTextUnderline.setAttribute('aria-pressed', String(isActive));
          render();
          try { updateTextOverlayPosition(); } catch (e) {}
        });
      }
    } catch (e) {
      // Non-fatal: do not break init if preview label not present
    }

    // Canvas floating overlay controls
    if (DOM.canvasTextSizeInc) {
      DOM.canvasTextSizeInc.addEventListener('click', () => {
        state.text.size = clamp(state.text.size + 2, 16, 96);
        state.overlayPinned = true;
        if (DOM.textSizeSlider) DOM.textSizeSlider.value = String(state.text.size);
        if (DOM.previewTextSize) DOM.previewTextSize.value = String(state.text.size);
        updateText(DOM.textSizeValue, `${state.text.size}px`);
        render();
        updateTextOverlayPosition();
      });
    }
    if (DOM.canvasTextSizeDec) {
      DOM.canvasTextSizeDec.addEventListener('click', () => {
        state.text.size = clamp(state.text.size - 2, 16, 96);
        state.overlayPinned = true;
        if (DOM.textSizeSlider) DOM.textSizeSlider.value = String(state.text.size);
        if (DOM.previewTextSize) DOM.previewTextSize.value = String(state.text.size);
        updateText(DOM.textSizeValue, `${state.text.size}px`);
        render();
        updateTextOverlayPosition();
      });
    }

    if (DOM.canvasTextColorInput) {
        DOM.canvasTextColorInput.addEventListener('change', event => {
           state.text.color = event.target.value;
          const isActive = state.text.color && state.text.color !== '#ffffff';
          try {
            const previewSelectors = ['.preview-panel>.section-title'];
            document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
              el.classList.toggle('text-color-active', isActive);
              el.style.color = isActive ? state.text.color : '#000000';
            });
          } catch (e) {}
          DOM.canvasTextColorInput.setAttribute('aria-pressed', String(isActive));
          render();
          try { updateTextOverlayPosition(); } catch (e) {}
   
        });
        try { DOM.canvasTextColorInput.value = state.text.color || '#ffffff'; } catch (e) {}          
    }

    if (DOM.canvasTextFontSelectbg) {
        DOM.canvasTextFontSelectbg.addEventListener('change', event => {
           const val = event.target.value;
           state.text.backgroundColor = (val === '' ? null : val);
          const isActive = state.text.backgroundColor !== null && state.text.backgroundColor !== undefined && state.text.backgroundColor !== '#ffffff';
          try {
            const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
            document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
              el.classList.toggle('text-colorbg-active', isActive);
              el.style.backgroundColor = isActive ? state.text.backgroundColor : '';
            });
          } catch (e) {}
          DOM.canvasTextFontSelectbg.setAttribute('aria-pressed', String(isActive));
          render();
          try { updateTextOverlayPosition(); } catch (e) {}

        });
        try { DOM.canvasTextFontSelectbg.value = state.text.backgroundColor || '#ffffff'; } catch (e) {}          
    }

    if (DOM.canvasTextBgClear) {
      DOM.canvasTextBgClear.addEventListener('click', () => {
        state.text.backgroundColor = null;
        try {
          const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
          document.querySelectorAll(previewSelectors.join(',')).forEach(el => {
            el.classList.remove('text-colorbg-active');
            el.style.backgroundColor = '';
          });
          if (DOM.canvasTextFontSelectbg) DOM.canvasTextFontSelectbg.setAttribute('aria-pressed', 'false');
        } catch (e) {}
        try { if (DOM.canvasTextFontSelectbg) DOM.canvasTextFontSelectbg.value = '#ffffff'; } catch (e) {}
        render();
        try { updateTextOverlayPosition(); } catch (e) {}
      });
    }

    if (DOM.canvasTextColorBtn && DOM.canvasTextColorInput) {
      DOM.canvasTextColorBtn.addEventListener('click', () => {
        state.overlayPinned = true;
        updateTextOverlayPosition();
        DOM.canvasTextColorInput.click();
      });

      DOM.canvasTextColorInput.addEventListener('input', event => {
        const color = event.target.value;
        state.text.color = color;
        state.overlayPinned = true;
        if (DOM.textColor) DOM.textColor.value = color;

        render();
        try { updateTextOverlayPosition(); } catch (e) {}
      });

      try { 
        
      } catch (e) {}
    }

    if (DOM.canvasTextFontBtn) {
      DOM.canvasTextFontBtn.addEventListener('click', () => {
        state.overlayPinned = true;
        updateTextOverlayPosition();
        try { if (DOM.previewTextFont) { DOM.previewTextFont.focus(); DOM.previewTextFont.click(); } else if (DOM.textFont) { DOM.textFont.focus(); DOM.textFont.click(); } } catch (e) {}
      });
    }

    // Canvas text font select: apply selected font to messages, preview and canvas
    if (DOM.canvasTextFontSelect) {
      DOM.canvasTextFontSelect.addEventListener('change', event => {
        const font = event.target.value;
        state.text.fontFamily = font;
        // sync other selects
        try { if (DOM.textFont) DOM.textFont.value = font; } catch (e) {}
        try { if (DOM.previewTextFont) DOM.previewTextFont.value = font; } catch (e) {}
        // apply to preview DOM elements
        try {
          const previewSelectors = ['.preview-panel>.section-title', '.preview-panel>.section-label'];
          previewSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.style.fontFamily = font);
          });
        } catch (e) {}
        render();
      });
      try { DOM.canvasTextFontSelect.value = state.text.fontFamily; } catch (e) {}
    }

    // Show overlay only when hovering / touching the text
    if (DOM.canvas) {
      DOM.canvas.addEventListener('mousemove', event => {
        const position = getCanvasPosition(event);
        if (isOnText(position.x, position.y)) {
          if (state.overlayPinned) {
            updateTextOverlayPosition();
          } else {
            updateTextOverlayPosition({ x: event.clientX, y: event.clientY });
          }
        } else if (!state.draggingText && !state.overlayPinned) {
          if (DOM.canvasTextOverlay) {
            DOM.canvasTextOverlay.style.display = 'none';
          }
        }
      });

      DOM.canvas.addEventListener('mouseleave', () => {
        if (DOM.canvasTextOverlay) DOM.canvasTextOverlay.style.display = 'none';
      });

      DOM.canvas.addEventListener('touchstart', event => {
        const t = event.touches && event.touches[0];
        if (!t) return;
        const fakeEv = { touches: [t], clientX: t.clientX, clientY: t.clientY };
        const pos = getCanvasPosition(fakeEv);
        if (isOnText(pos.x, pos.y)) {
          if (state.overlayPinned) updateTextOverlayPosition(); else updateTextOverlayPosition({ x: t.clientX, y: t.clientY });
        } else {
          if (DOM.canvasTextOverlay && !state.overlayPinned) {
            DOM.canvasTextOverlay.style.display = 'none';
          }
        }

      }, { passive: true });

      // Click on canvas text pins the overlay so it stays anchored while editing
      DOM.canvas.addEventListener('mousedown', event => {
        const pos = getCanvasPosition(event);
        if (isOnText(pos.x, pos.y)) {
          state.overlayPinned = true;
          updateTextOverlayPosition();
        }
      });
    }

    // Click outside overlay or canvas hides and unpins it
    window.addEventListener('mousedown', event => {
      const target = event.target;
      if (!DOM.canvasTextOverlay) return;
      if (DOM.canvasTextOverlay.contains(target) || target === DOM.canvas) return;
      DOM.canvasTextOverlay.style.display = 'none';
      state.overlayPinned = false;
    });

    if (DOM.textPosition) {
      DOM.textPosition.addEventListener('change', event => {
        state.text.position = event.target.value;
        render();
      });
    }

    if (DOM.descInput) {
      DOM.descInput.addEventListener('input', event => {
        const value = event.target.value;
        state.description.content = value;
        try { updateText(DOM.descSizeValue, `${state.description.size}px`); } catch (e) {}
        render();
      });
    }

    if (DOM.descSizeSlider) {
      DOM.descSizeSlider.addEventListener('input', event => {
        const value = clamp(Number.parseInt(event.target.value, 10), 12, 64);
        state.description.size = value;
        updateText(DOM.descSizeValue, `${value}px`);
        render();
      });
    }

    if (DOM.descColor) {
      DOM.descColor.addEventListener('input', event => {
        state.description.color = event.target.value;
        render();
      });
    }

    if (DOM.descFont) {
      DOM.descFont.addEventListener('change', event => {
        state.description.fontFamily = event.target.value;
        try {
          const font = event.target.value;
          if (DOM.previewDescription) DOM.previewDescription.style.fontFamily = font;
          document.querySelectorAll('.preview-panel>.section-title, .preview-panel>.section-label').forEach(el => el.style.fontFamily = font);
        } catch (e) {}
        render();
      });
      try { DOM.descFont.value = state.description.fontFamily; } catch (e) {}
    }

    // Action buttons with state validation
    if (DOM.btnCenter) {
      DOM.btnCenter.addEventListener('click', () => {
        if (!state.fgImg) return;
        state.fg.x = (DOM.canvas.width - state.fg.w * state.fg.scale) / 2;
        state.fg.y = (DOM.canvas.height - state.fg.h * state.fg.scale) / 2;
        render();
      });
    }

    if (DOM.btnFitW) {
      DOM.btnFitW.addEventListener('click', () => {
        if (!state.fgImg) return;
        state.fg.scale = DOM.canvas.width / state.fg.w;
        state.fg.x = 0;
        state.fg.y = (DOM.canvas.height - state.fg.h * state.fg.scale) / 2;
        updateSizeControls(Math.round(state.fg.scale * 100));
        render();
      });
    }

    if (DOM.btnFitH) {
      DOM.btnFitH.addEventListener('click', () => {
        if (!state.fgImg) return;
        state.fg.scale = DOM.canvas.height / state.fg.h;
        state.fg.y = 0;
        state.fg.x = (DOM.canvas.width - state.fg.w * state.fg.scale) / 2;
        updateSizeControls(Math.round(state.fg.scale * 100));
        render();
      });
    }

    if (DOM.btnReset) {
      DOM.btnReset.addEventListener('click', () => {
        if (!state.fgImg) return;
        setupForeground(state.fgImg);
      });
    }

    if (DOM.btnFlipH) {
      DOM.btnFlipH.addEventListener('click', () => {
        if (!state.fgImg) return;
        state.fg.flipH = !state.fg.flipH;
        render();
      });
    }

    if (DOM.btnFlipV) {
      DOM.btnFlipV.addEventListener('click', () => {
        if (!state.fgImg) return;
        state.fg.flipV = !state.fg.flipV;
        render();
      });
    }

    if (DOM.btnExport) {
      DOM.btnExport.addEventListener('click', () => {
        const quality = clamp(Number.parseInt(DOM.qualitySlider?.value ?? '100', 10) / 100, 0, 1);
        exportComposite(EXPORT_JPG, quality);
      });
    }

    if (DOM.btnExportPng) {
      DOM.btnExportPng.addEventListener('click', () => {
        exportComposite(EXPORT_PNG, 1);
      });
    }
  }

  function attachCanvasEvents() {
    // Debounced mousemove handler for better performance
    const handleMouseMove = debounce((position) => {
      if (!state.dragging && !state.resizing && !state.draggingText && !state.draggingDesc) {
        // Update cursor only when not interacting
        if (isOnResizeHandle(position.x, position.y)) {
          DOM.canvas.style.cursor = 'nwse-resize';
        } else if (isInsideForeground(position.x, position.y)) {
          DOM.canvas.style.cursor = 'grab';
        } else if (isOnText(position.x, position.y)) {
          DOM.canvas.style.cursor = 'move';
        } else if (isOnSubtitle(position.x, position.y)) {
          DOM.canvas.style.cursor = 'move';
        } else if (isOnDescription(position.x, position.y)) {
          DOM.canvas.style.cursor = 'move';
        } else {
          DOM.canvas.style.cursor = 'default';
        }
        return;
      }

      if (state.dragging) {
        state.fg.x = state.dragStart.fx + (position.x - state.dragStart.mx);
        state.fg.y = state.dragStart.fy + (position.y - state.dragStart.my);
      }

      if (state.resizing) {
        const dx = position.x - state.resizeStart.mx;
        const newWidth = Math.max(20, state.resizeStart.w + dx);
        state.fg.scale = newWidth / state.fg.w;
        updateSizeControls(Math.round(state.fg.scale * 100));
      }

      if (state.draggingText) {
        const dx = position.x - state.textDragStart.mx;
        const dy = position.y - state.textDragStart.my;
        state.text.x = state.textDragStart.tx + dx;
        state.text.y = state.textDragStart.ty + dy;
        seleccionComponente = 1;// selecciona el componente titulo
      }

      if (state.draggingDesc) {
        const dx = position.x - state.descDragStart.mx;
        const dy = position.y - state.descDragStart.my;
        state.description.x = state.descDragStart.dx + dx;
        state.description.y = state.descDragStart.dy + dy;
        seleccionComponente = 2;// selecciona el componente descripcion
      }

      if (state.draggingSubtitle) {
        const dx = position.x - state.subtitleDragStart.mx;
        const dy = position.y - state.subtitleDragStart.my;
        state.subtitle.x = state.subtitleDragStart.sx + dx;
        state.subtitle.y = state.subtitleDragStart.sy + dy;
        seleccionComponente = 3;// selecciona el componente subtitulo
      }

      render();
    }, DEBOUNCE_DELAY_MS);

    DOM.canvas.addEventListener('mousedown', event => {
      const position = getCanvasPosition(event);

      // Prioritize text dragging
      if (isOnText(position.x, position.y)) {
        state.draggingText = true;
        state.textDragStart = {
          mx: position.x,
          my: position.y,
          tx: state.text.x === null ? (DOM.canvas.width / 2) : state.text.x,
          ty: state.text.y === null ? (DOM.canvas.height * 0.15) : state.text.y,
        };
        DOM.canvas.style.cursor = 'grabbing';
        event.preventDefault();
        return;
      }

      // subtitle dragging
      if (isOnSubtitle(position.x, position.y)) {
        state.draggingSubtitle = true;
        state.subtitleDragStart = {
          mx: position.x,
          my: position.y,
          sx: state.subtitle.x === null ? (DOM.canvas.width / 2) : state.subtitle.x,
          sy: state.subtitle.y === null ? (DOM.canvas.height * 0.25) : state.subtitle.y,
        };
        DOM.canvas.style.cursor = 'grabbing';
        event.preventDefault();
        return;
      }

      if (isOnDescription(position.x, position.y)) {
        state.draggingDesc = true;
        state.descDragStart = {
          mx: position.x,
          my: position.y,
          dx: state.description.x === null ? (DOM.canvas.width / 2) : state.description.x,
          dy: state.description.y === null ? (DOM.canvas.height - 40) : state.description.y,
        };
        DOM.canvas.style.cursor = 'grabbing';
        event.preventDefault();
        return;
      }

      if (isOnResizeHandle(position.x, position.y)) {
        state.resizing = true;
        state.resizeStart = {
          mx: position.x,
          my: position.y,
          w: state.fg.w * state.fg.scale,
          h: state.fg.h * state.fg.scale,
        };
      } else if (isInsideForeground(position.x, position.y)) {
        state.dragging = true;
        state.dragStart = {
          mx: position.x,
          my: position.y,
          fx: state.fg.x,
          fy: state.fg.y,
        };
        DOM.canvas.style.cursor = 'grabbing';
      }
      event.preventDefault();
    });

    window.addEventListener('mousemove', event => {
      const position = getCanvasPosition(event);
      handleMouseMove(position);
    });

    window.addEventListener('mouseup', () => {
      state.dragging = false;
      state.resizing = false;
      state.draggingText = false;
      state.draggingDesc = false;
      state.draggingSubtitle = false;
      DOM.canvas.style.cursor = 'default';
    });

    // Touch support for mobile devices
    DOM.canvas.addEventListener('touchstart', event => {
      const position = getCanvasPosition(event);
      if (isOnResizeHandle(position.x, position.y)) {
        state.resizing = true;
        state.resizeStart = {
          mx: position.x,
          my: position.y,
          w: state.fg.w * state.fg.scale,
          h: state.fg.h * state.fg.scale,
        };
      } else if (isOnText(position.x, position.y)) {
        state.draggingText = true;
        state.textDragStart = {
          mx: position.x,
          my: position.y,
          tx: state.text.x === null ? (DOM.canvas.width / 2) : state.text.x,
          ty: state.text.y === null ? (DOM.canvas.height * 0.15) : state.text.y,
        };
      } else if (isOnDescription(position.x, position.y)) {
        state.draggingDesc = true;
        state.descDragStart = {
          mx: position.x,
          my: position.y,
          dx: state.description.x === null ? (DOM.canvas.width / 2) : state.description.x,
          dy: state.description.y === null ? (DOM.canvas.height - 40) : state.description.y,
        };
      } else if (isInsideForeground(position.x, position.y)) {
        state.dragging = true;
        state.dragStart = {
          mx: position.x,
          my: position.y,
          fx: state.fg.x,
          fy: state.fg.y,
        };
      }
      event.preventDefault();
    });

    window.addEventListener('touchmove', event => {
      if (state.dragging || state.resizing || state.draggingText || state.draggingDesc) {
        const position = getCanvasPosition(event);
        handleMouseMove(position);
      }
    });

    window.addEventListener('touchend', () => {
      state.dragging = false;
      state.resizing = false;
      state.draggingText = false;
      state.draggingDesc = false;
      state.draggingSubtitle = false;
    });
  }

  function init() {
    feedback.init();

    if (!DOM.canvas) {
      feedback.error('Elemento canvas no encontrado. Asegúrate de que el HTML contiene un elemento con id "composite".');
      return;
    }

    ctx = DOM.canvas.getContext('2d');
    if (!ctx) {
      feedback.error('Tu navegador no soporta Canvas 2D. Por favor usa un navegador moderno.');
      return;
    }

    setCanvasVisibility(false);
    updateText(DOM.qualityValue, `${DOM.qualitySlider?.value ?? 0}%`);
    initializeControls();
    // Apply initial preview styles (color and font) to preview DOM elements
    try {
      document.querySelectorAll('.preview-panel>.section-title').forEach(el => {
        try { el.style.setProperty('color', state.text.color, 'important'); } catch (e) {}
        try { el.style.fontFamily = state.text.fontFamily; } catch (e) {}
      });
      document.querySelectorAll('.preview-panel>.section-label').forEach(el => {
        try { el.style.setProperty('color', state.subtitle.color, 'important'); } catch (e) {}
        try { el.style.fontFamily = state.subtitle.fontFamily; } catch (e) {}
      });
      if (DOM.previewSubtitle) {
        try { DOM.previewSubtitle.style.color = state.subtitle.color; } catch (e) {}
        try { DOM.previewSubtitle.textContent = state.subtitle.content || 'Subtítulo de ejemplo'; } catch (e) {}
      }
      if (DOM.previewDescription) {
        try { DOM.previewDescription.style.color = state.description.color; } catch (e) {}
        try { DOM.previewDescription.textContent = state.description.content || 'Descripción de mensaje de ejemplo'; } catch (e) {}
      }
      // initialize preview-subtitle position if subtitle coords already present
      try {
        if (DOM.previewSubtitle && DOM.previewPanel && typeof state.subtitle.x === 'number' && typeof state.subtitle.y === 'number') {
          const panelRect = DOM.previewPanel.getBoundingClientRect();
          const relX = state.subtitle.x / DOM.canvas.width;
          const relY = state.subtitle.y / DOM.canvas.height;
          const el = DOM.previewSubtitle;
          el.style.position = 'absolute';
          el.style.left = `${Math.round(relX * panelRect.width - el.offsetWidth / 2)}px`;
          el.style.top = `${Math.round(relY * panelRect.height - el.offsetHeight / 2)}px`;
        }
      } catch (e) {}
    } catch (e) {}
    attachCanvasEvents();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM is already loaded
    init();
  }
}());
