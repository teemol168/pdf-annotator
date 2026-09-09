/**
 * App - 主应用逻辑
 * 整合PDF.js渲染、标注引擎、工具栏交互、导出功能
 */

// i18n 兜底（防止 i18n.js 未加载时报错）
const i18n = window.i18n || { t: k => k };

// ===== 全局状态 =====
let pdfDoc = null;        // PDF.js文档对象
let currentPage = 1;      // 当前页码（1-based）
let totalPages = 0;
let scale = 1.5;          // 渲染缩放
let renderTask = null;    // 当前渲染任务（可取消）
let annotator = null;     // 标注引擎实例
let pdfFile = null;       // 原始PDF文件

// ===== DOM元素 =====
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');
const pdfCanvas = document.getElementById('pdfCanvas');
const annotationCanvas = document.getElementById('annotationCanvas');
const pdfViewer = document.getElementById('pdfViewer');
const emptyState = document.getElementById('emptyState');
const viewerContainer = document.getElementById('viewerContainer');
const pageInput = document.getElementById('pageInput');
const totalPagesEl = document.getElementById('totalPages');
const zoomLevelEl = document.getElementById('zoomLevel');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast = document.getElementById('toast');
const textInputModal = document.getElementById('textInputModal');
const textInputArea = document.getElementById('textInputArea');

// 设置PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    console.log('[PDF.js] worker configured:', pdfjsLib.GlobalWorkerOptions.workerSrc);
} else {
    console.error('[PDF.js] pdfjsLib not found! Script may have failed to load from CDN.');
}

// ===== 初始化标注引擎 =====
annotator = new Annotator(annotationCanvas);
annotator.onTextRequest = (x, y) => {
    // 新建文字标注
    textInputArea.value = '';
    delete textInputArea.dataset.editIndex;
    textInputArea.dataset.posX = x;
    textInputArea.dataset.posY = y;
    textInputModal.style.display = 'flex';
    textInputArea.focus();
};

annotator.onTextEdit = (annotation, index) => {
    // 编辑已有文字标注（双击触发）
    textInputArea.value = annotation.text;
    textInputArea.dataset.editIndex = index;
    textInputModal.style.display = 'flex';
    textInputArea.focus();
};

// 选中标注时，侧边栏控件同步显示该标注的当前样式
annotator.onSelectionChange = (ann) => {
    if (!ann) {
        // 取消选中时不重置控件，保持当前默认设置
        return;
    }

    // 同步颜色
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color === ann.color);
    });
    document.getElementById('customColor').value = ann.color;

    // 同步粗细（非文字标注）
    if ('lineWidth' in ann) {
        lineWidthSlider.value = ann.lineWidth;
        lineWidthValue.textContent = ann.lineWidth + 'px';
    }

    // 同步字体相关（文字标注）
    if (ann.type === 'text') {
        document.getElementById('fontFamily').value = ann.fontFamily;
        fontSizeSlider.value = ann.fontSize;
        fontSizeValue.textContent = ann.fontSize + 'px';
        document.getElementById('boldBtn').classList.toggle('active', !!ann.bold);
        document.getElementById('italicBtn').classList.toggle('active', !!ann.italic);
        document.getElementById('underlineBtn').classList.toggle('active', !!ann.underline);
        // 同步旋转（只更新控件显示，不触发修改）
        const deg = ann.rotation || 0;
        rotationSlider.value = deg;
        rotationValue.textContent = Math.round(deg) + '°';
        rotPresets.forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.rot) === Math.round(deg));
        });
    }

    // 同步不透明度
    if ('opacity' in ann) {
        const pct = Math.round((ann.opacity ?? 1.0) * 100);
        opacitySlider.value = pct;
        opacityValue.textContent = pct + '%';
    }
};

// ===== 工具选择 =====
document.querySelectorAll('.tool-select').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        annotator.tool = btn.dataset.tool;
        annotator.deselect();

        // 鼠标样式
        const cursors = {
            select: 'default',
            pen: 'crosshair',
            line: 'crosshair',
            arrow: 'crosshair',
            rect: 'crosshair',
            text: 'text',
            highlight: 'crosshair',
            wavyline: 'crosshair',
            texthighlight: 'text',
            eraser: 'cell'
        };
        annotationCanvas.style.cursor = cursors[annotator.tool] || 'default';

        // 文字选择高亮工具：启用/禁用TextLayer
        if (annotator.tool === 'texthighlight') {
            annotator.setTextSelectionMode(true);
        } else {
            annotator.setTextSelectionMode(false);
        }
    });
});

// 默认选中选择工具
document.querySelector('[data-tool="select"]').classList.add('active');
annotator.tool = 'select';

// ===== 颜色选择 =====
document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        annotator.color = swatch.dataset.color;
        document.getElementById('customColor').value = swatch.dataset.color;
        // 如果有选中标注，同步更新颜色
        if (annotator.selectedAnnotation) {
            annotator.updateSelectedStyle({ color: swatch.dataset.color });
        }
    });
});

document.getElementById('customColor').addEventListener('input', (e) => {
    annotator.color = e.target.value;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    // 如果有选中标注，同步更新颜色
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ color: e.target.value });
    }
});

// ===== 线条粗细 =====
const lineWidthSlider = document.getElementById('lineWidth');
const lineWidthValue = document.getElementById('lineWidthValue');
lineWidthSlider.addEventListener('input', (e) => {
    annotator.lineWidth = parseInt(e.target.value);
    lineWidthValue.textContent = e.target.value + 'px';
    // 如果有选中标注，同步更新粗细
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ lineWidth: parseInt(e.target.value) });
    }
});

// ===== 字体设置 =====
document.getElementById('fontFamily').addEventListener('change', (e) => {
    annotator.fontFamily = e.target.value;
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ fontFamily: e.target.value });
    }
});

const fontSizeSlider = document.getElementById('fontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
fontSizeSlider.addEventListener('input', (e) => {
    annotator.fontSize = parseInt(e.target.value);
    fontSizeValue.textContent = e.target.value + 'px';
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ fontSize: parseInt(e.target.value) });
    }
});

// 文字样式
document.getElementById('boldBtn').addEventListener('click', function() {
    this.classList.toggle('active');
    annotator.bold = this.classList.contains('active');
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ bold: annotator.bold });
    }
});

document.getElementById('italicBtn').addEventListener('click', function() {
    this.classList.toggle('active');
    annotator.italic = this.classList.contains('active');
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ italic: annotator.italic });
    }
});

document.getElementById('underlineBtn').addEventListener('click', function() {
    this.classList.toggle('active');
    annotator.underline = this.classList.contains('active');
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ underline: annotator.underline });
    }
});

// ===== 文字旋转 =====
const rotationSlider = document.getElementById('rotation');
const rotationValue = document.getElementById('rotationValue');
const rotPresets = document.querySelectorAll('.rot-preset');

function setRotation(deg, fromPreset = false) {
    deg = ((deg % 360) + 360) % 360; // 规范到 0-360
    annotator.rotation = deg;
    rotationSlider.value = deg;
    rotationValue.textContent = Math.round(deg) + '°';
    // 同步预设按钮高亮
    rotPresets.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.rot) === Math.round(deg));
    });
    // 修改选中标注
    if (annotator.selectedAnnotation && annotator.selectedAnnotation.type === 'text') {
        annotator.updateSelectedStyle({ rotation: deg });
    }
}

rotationSlider.addEventListener('input', (e) => {
    setRotation(parseInt(e.target.value));
});

rotPresets.forEach(btn => {
    btn.addEventListener('click', () => {
        setRotation(parseInt(btn.dataset.rot), true);
    });
});

// ===== 不透明度 =====
const opacitySlider = document.getElementById('opacity');
const opacityValue = document.getElementById('opacityValue');
opacitySlider.addEventListener('input', (e) => {
    annotator.opacity = parseInt(e.target.value) / 100;
    opacityValue.textContent = e.target.value + '%';
    if (annotator.selectedAnnotation) {
        annotator.updateSelectedStyle({ opacity: parseInt(e.target.value) / 100 });
    }
});

// ===== 文字输入弹窗 =====
document.getElementById('textCancel').addEventListener('click', () => {
    textInputModal.style.display = 'none';
    textInputArea.value = '';
});

document.getElementById('textConfirm').addEventListener('click', () => {
    const text = textInputArea.value.trim();
    if (text) {
        const editIndex = textInputArea.dataset.editIndex;
        if (editIndex !== undefined) {
            // 编辑已有文字标注
            const idx = parseInt(editIndex);
            const anns = annotator.annotationsByPage[annotator.currentPage] || [];
            if (anns[idx]) {
                annotator._pushUndo({
                    action: 'move',
                    original: JSON.parse(JSON.stringify(anns[idx])),
                    index: idx,
                    page: annotator.currentPage
                });
                anns[idx].text = text;
                annotator.redoStack = [];
                annotator.redraw();
            }
        } else {
            // 新建文字标注
            const x = parseFloat(textInputArea.dataset.posX);
            const y = parseFloat(textInputArea.dataset.posY);
            annotator.drawText(x, y, text);
        }
    }
    textInputModal.style.display = 'none';
    textInputArea.value = '';
    delete textInputArea.dataset.editIndex;
});

textInputArea.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter 提交确认（Enter 键默认换行，不拦截）
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('textConfirm').click();
    } else if (e.key === 'Escape') {
        document.getElementById('textCancel').click();
    }
});

// textarea 自适应高度（输入多行时自动变高）
textInputArea.addEventListener('input', () => {
    textInputArea.style.height = 'auto';
    textInputArea.style.height = Math.min(textInputArea.scrollHeight, 300) + 'px';
});

// ===== 文件加载 =====
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('[File] Selected file:', file.name, file.type, file.size, 'bytes');

    // 检查PDF.js是否已加载
    if (typeof pdfjsLib === 'undefined') {
        showToast(i18n.t('t_pdfjs_missing'));
        console.error('[PDF.js] pdfjsLib is undefined - CDN script may have failed');
        return;
    }

    // 某些浏览器file.type可能为空，用扩展名兜底
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
        showToast(i18n.t('t_select_pdf'));
        return;
    }

    pdfFile = file;
    fileNameEl.textContent = file.name;
    loadingOverlay.style.display = 'flex';

    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log('[PDF.js] Got arrayBuffer, size:', arrayBuffer.byteLength);

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            // 禁用worker时的fallback参数
            disableAutoFetch: false,
            disableStream: false
        });

        // 监听加载进度
        loadingTask.onProgress = (progress) => {
            console.log('[PDF.js] Loading progress:', progress.loaded, '/', progress.total);
        };

        pdfDoc = await loadingTask.promise;
        totalPages = pdfDoc.numPages;
        totalPagesEl.textContent = totalPages;
        pageInput.max = totalPages;
        currentPage = 1;
        pageInput.value = 1;

        emptyState.style.display = 'none';
        pdfViewer.style.display = 'block';

        // 清空标注（新文件）
        annotator.annotationsByPage = {};
        annotator.undoStack = [];
        annotator.redoStack = [];

        console.log('[PDF.js] Document loaded, total pages:', totalPages);
        await renderPage(currentPage);
        showToast(i18n.t('t_loaded', { name: file.name, pages: totalPages }));
    } catch (err) {
        console.error('[PDF.js] 加载失败:', err);
        let msg = i18n.t('t_load_failed');
        if (err.message && err.message.includes('worker')) {
            msg = i18n.t('t_worker_failed');
        } else if (err.name === 'PasswordException') {
            msg = i18n.t('t_encrypted');
        } else if (err.name === 'InvalidPDFException') {
            msg = i18n.t('t_invalid');
        }
        showToast(msg);
        loadingOverlay.style.display = 'none';
    }
});

// ===== 渲染页面 =====
async function renderPage(pageNum) {
    if (!pdfDoc) return;
    loadingOverlay.style.display = 'flex';

    try {
        if (renderTask) {
            renderTask.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scale });

        // 设置canvas尺寸 = viewport尺寸（简洁直接，避免DPR transform问题）
        pdfCanvas.width = Math.floor(viewport.width);
        pdfCanvas.height = Math.floor(viewport.height);
        pdfCanvas.style.width = Math.floor(viewport.width) + 'px';
        pdfCanvas.style.height = Math.floor(viewport.height) + 'px';

        annotationCanvas.width = Math.floor(viewport.width);
        annotationCanvas.height = Math.floor(viewport.height);
        annotationCanvas.style.width = Math.floor(viewport.width) + 'px';
        annotationCanvas.style.height = Math.floor(viewport.height) + 'px';

        console.log('[Render] canvas size:', pdfCanvas.width, 'x', pdfCanvas.height);

        const renderContext = {
            canvasContext: pdfCanvas.getContext('2d'),
            viewport: viewport
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
        renderTask = null;
        console.log('[Render] Page rendered successfully');

        // 设置标注引擎
        annotator.canvas = annotationCanvas;
        annotator.ctx = annotationCanvas.getContext('2d');
        annotator.setCurrentPage(pageNum - 1); // 0-based

        // 传递PDF页面对象给标注引擎（用于TextLayer渲染）
        annotator.setPdfPage(page, scale);

        pageInput.value = pageNum;
        updateZoomDisplay();
    } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
            console.error('[Render] 渲染失败:', err);
            showToast(i18n.t('t_render_failed') + ': ' + (err.message || err));
        }
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// ===== 翻页 =====
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderPage(currentPage);
    }
});

pageInput.addEventListener('change', (e) => {
    const page = parseInt(e.target.value);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderPage(currentPage);
    } else {
        pageInput.value = currentPage;
    }
});

// ===== 缩放 =====
document.getElementById('zoomIn').addEventListener('click', () => {
    scale = Math.min(scale * 1.2, 5);
    renderPage(currentPage);
});

document.getElementById('zoomOut').addEventListener('click', () => {
    scale = Math.max(scale / 1.2, 0.3);
    renderPage(currentPage);
});

document.getElementById('fitWidth').addEventListener('click', async () => {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPage);
    const baseViewport = page.getViewport({ scale: 1 });
    const containerWidth = viewerContainer.clientWidth - 48;
    scale = containerWidth / baseViewport.width;
    renderPage(currentPage);
});

function updateZoomDisplay() {
    zoomLevelEl.textContent = Math.round(scale * 100 / 1.5) + '%';
}

// ===== 撤销/重做/清除 =====
document.getElementById('undoBtn').addEventListener('click', () => {
    if (annotator.undo()) {
        showToast(i18n.t('t_undone'));
    }
});

document.getElementById('redoBtn').addEventListener('click', () => {
    if (annotator.redo()) {
        showToast(i18n.t('t_redone'));
    }
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (annotator.clearPage()) {
        showToast(i18n.t('t_cleared'));
    } else {
        showToast(i18n.t('t_no_annotations'));
    }
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('undoBtn').click();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        document.getElementById('redoBtn').click();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (annotator.tool === 'select' && annotator.selectedAnnotation) {
            e.preventDefault();
            if (annotator.deleteSelected()) {
                showToast(i18n.t('t_deleted'));
            }
        }
    }
});

// ===== 导出标注后的PDF =====
document.getElementById('exportBtn').addEventListener('click', exportAnnotatedPDF);

async function exportAnnotatedPDF() {
    if (!pdfDoc) {
        showToast(i18n.t('t_load_first'));
        return;
    }

    loadingOverlay.style.display = 'flex';
    showToast(i18n.t('t_exporting'));

    try {
        const { PDFDocument } = await loadPdfLib();

        const pdfBytes = await pdfFile.arrayBuffer();
        const pdfDocLib = await PDFDocument.load(pdfBytes);
        const pages = pdfDocLib.getPages();

        // 保存标注引擎原始状态
        const origCanvas = annotator.canvas;
        const origCtx = annotator.ctx;
        const origPage = annotator.currentPage;

        for (let i = 0; i < pages.length; i++) {
            const anns = annotator.getPageAnnotations(i);
            if (anns.length === 0) continue;

            const page = pages[i];
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // 获取该页的渲染viewport（与屏幕显示一致）
            const pdfPage = await pdfDoc.getPage(i + 1);
            const viewport = pdfPage.getViewport({ scale: scale });

            // 创建临时canvas，尺寸与屏幕渲染的canvas一致
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.floor(viewport.width);
            tempCanvas.height = Math.floor(viewport.height);
            const tempCtx = tempCanvas.getContext('2d');

            // 切换标注引擎到临时canvas，绘制该页所有标注
            annotator.canvas = tempCanvas;
            annotator.ctx = tempCtx;
            annotator.currentPage = i;
            annotator.redraw();  // 在临时canvas上重绘该页所有标注

            // 转为PNG（保留透明度）
            const pngDataUrl = tempCanvas.toDataURL('image/png');
            const pngBase64 = pngDataUrl.split(',')[1];
            const pngBytes = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
            const pngImage = await pdfDocLib.embedPng(pngBytes);

            // 将标注图层叠加到PDF页面上
            // Canvas: 左上角原点，Y向下
            // PDF: 左下角原点，Y向上
            // 图片覆盖整个页面
            page.drawImage(pngImage, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight
            });
        }

        // 恢复标注引擎原始状态
        annotator.canvas = origCanvas;
        annotator.ctx = origCtx;
        annotator.currentPage = origPage;
        annotator.redraw();

        const pdfBytesOut = await pdfDocLib.save();
        const blob = new Blob([pdfBytesOut], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'annotated_' + (pdfFile.name || 'document.pdf');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(i18n.t('t_export_ok'));
    } catch (err) {
        console.error('导出失败:', err);
        showToast(i18n.t('t_export_fail') + ': ' + err.message);
        // 确保恢复标注引擎状态
        if (annotator.canvas !== annotationCanvas) {
            annotator.canvas = annotationCanvas;
            annotator.ctx = annotationCanvas.getContext('2d');
            annotator.redraw();
        }
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// pdf-lib加载缓存
let _pdfLib = null;
async function loadPdfLib() {
    if (_pdfLib) return _pdfLib;
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
    _pdfLib = { PDFDocument: PDFLib.PDFDocument, rgb: PDFLib.rgb };
    return _pdfLib;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ===== 工具函数 =====
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function showToast(msg) {
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.display = 'none';
    }, 2000);
}

// ===== 拖拽加载 =====
viewerContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    viewerContainer.style.background = 'rgba(52,152,219,0.1)';
});

viewerContainer.addEventListener('dragleave', () => {
    viewerContainer.style.background = '';
});

viewerContainer.addEventListener('drop', async (e) => {
    e.preventDefault();
    viewerContainer.style.background = '';

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
    } else {
        showToast(i18n.t('t_drop_pdf'));
    }
});

console.log('PDF Annotator initialized.');
