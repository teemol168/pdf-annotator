/**
 * Annotator - PDF标注引擎
 * 负责在Canvas上绘制各种标注：画笔、直线、箭头、矩形、文字、高亮
 * 支持撤销/重做、清除、数据序列化
 */
class Annotator {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 当前工具设置
        this.tool = 'select';
        this.color = '#e74c3c';
        this.lineWidth = 2;
        this.fontFamily = 'Arial, sans-serif';
        this.fontSize = 16;
        this.opacity = 1.0;
        this.bold = false;
        this.italic = false;
        this.underline = false;

        // 绘制状态
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentPath = [];
        this.snapshotImageData = null; // 用于实时预览（直线/箭头/矩形）

        // 每页标注数据 { pageIndex: [annotations] }
        this.annotationsByPage = {};
        this.currentPage = 0;

        // 撤销/重做栈（全局）
        this.undoStack = [];
        this.redoStack = [];

        // 选择/移动状态
        this.selectedAnnotation = null;
        this.selectedIndex = -1;
        this.isDragging = false;
        this.dragLastX = 0;
        this.dragLastY = 0;
        this.dragOriginalAnn = null;
        this.hoverCursor = 'default';

        // 绑定事件
        this._bindEvents();
    }

    /**
     * 设置canvas尺寸
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.redraw();
    }

    /**
     * 设置当前页码
     */
    setCurrentPage(pageIndex) {
        this.currentPage = pageIndex;
        this.selectedAnnotation = null;
        this.selectedIndex = -1;

        // 翻页时清除旧 textLayer（避免文本位置错乱）
        if (this.textSelectionMode) {
            const pageContainer = this.canvas.parentElement;
            const oldTextLayer = pageContainer.querySelector('.textLayer');
            if (oldTextLayer) {
                oldTextLayer.remove();
            }
        }

        this.redraw();
    }

    // ===== 事件绑定 =====
    _bindEvents() {
        const c = this.canvas;

        // 鼠标事件
        c.addEventListener('mousedown', (e) => this._onPointerDown(e));
        c.addEventListener('mousemove', (e) => this._onPointerMove(e));
        c.addEventListener('mouseup', (e) => this._onPointerUp(e));
        c.addEventListener('mouseleave', (e) => this._onPointerUp(e));
        c.addEventListener('dblclick', (e) => this._onDoubleClick(e));

        // 触摸事件
        c.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this._onPointerDown(this._touchToEvent(e));
        });
        c.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._onPointerMove(this._touchToEvent(e));
        });
        c.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._onPointerUp(this._touchToEvent(e));
        });
    }

    _touchToEvent(e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: e.target
        };
    }

    _getPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // ===== 绘制事件处理 =====
    _onPointerDown(e) {
        const pos = this._getPos(e);
        this.startX = pos.x;
        this.startY = pos.y;

        // ===== 选择工具：点选标注、拖拽移动 =====
        if (this.tool === 'select') {
            const hit = this._findAnnotationAt(pos.x, pos.y);
            if (hit) {
                this.selectedAnnotation = hit.annotation;
                this.selectedIndex = hit.index;
                this.isDragging = true;
                this.dragLastX = pos.x;
                this.dragLastY = pos.y;
                this.dragOriginalAnn = JSON.parse(JSON.stringify(hit.annotation));
                this.canvas.style.cursor = 'move';
                this._styleUndoSaved = false;
                // 通知外部：选中了标注（同步控件样式）
                if (this.onSelectionChange) this.onSelectionChange(hit.annotation);
            } else {
                this.deselect();
            }
            this.redraw();
            return;
        }

        this.isDrawing = true;

        if (this.tool === 'text') {
            this.isDrawing = false;
            // 通知外部弹出文字输入框
            this._onTextRequest(pos.x, pos.y);
            return;
        }

        if (this.tool === 'eraser') {
            this._eraseAt(pos.x, pos.y);
            return;
        }

        // 保存当前canvas快照（用于直线/箭头/矩形/波浪线实时预览）
        if (['line', 'arrow', 'rect', 'wavyline'].includes(this.tool)) {
            this.snapshotImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }

        // 画笔/高亮开始新路径
        if (['pen', 'highlight'].includes(this.tool)) {
            this.currentPath = [{ x: pos.x, y: pos.y }];
            this.ctx.save();
            this._applyStyle();
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        }

        // 波浪线开始新路径（只记录起点）
        if (this.tool === 'wavyline') {
            this.currentPath = [{ x: pos.x, y: pos.y }];
        }
    }

    _onPointerMove(e) {
        // ===== 选择工具：拖拽移动 / 悬停检测 =====
        if (this.tool === 'select') {
            if (this.isDragging && this.selectedAnnotation) {
                const pos = this._getPos(e);
                const dx = pos.x - this.dragLastX;
                const dy = pos.y - this.dragLastY;
                this._moveAnnotation(this.selectedAnnotation, dx, dy);
                this.dragLastX = pos.x;
                this.dragLastY = pos.y;
                this.redraw();
            } else {
                // 悬停：检测是否在标注上方，改变鼠标样式
                const pos = this._getPos(e);
                const hit = this._findAnnotationAt(pos.x, pos.y);
                this.canvas.style.cursor = hit ? 'move' : 'default';
            }
            return;
        }

        if (!this.isDrawing) return;
        const pos = this._getPos(e);

        switch (this.tool) {
            case 'pen':
                this._drawPenMove(pos.x, pos.y);
                break;
            case 'highlight':
                this._drawHighlightMove(pos.x, pos.y);
                break;
            case 'wavyline':
                this._drawWavyLineMove(pos.x, pos.y);
                break;
            case 'line':
                this._drawShapePreview(pos.x, pos.y, 'line');
                break;
            case 'arrow':
                this._drawShapePreview(pos.x, pos.y, 'arrow');
                break;
            case 'rect':
                this._drawShapePreview(pos.x, pos.y, 'rect');
                break;
            case 'eraser':
                this._eraseAt(pos.x, pos.y);
                break;
        }
    }

    _onPointerUp(e) {
        // ===== 选择工具：结束拖拽 =====
        if (this.tool === 'select') {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'default';
                if (this.dragOriginalAnn && this.selectedAnnotation) {
                    this._pushUndo({
                        action: 'move',
                        original: this.dragOriginalAnn,
                        index: this.selectedIndex,
                        page: this.currentPage
                    });
                    this.redoStack = [];
                }
            }
            return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;
        const pos = e.clientX ? this._getPos(e) : { x: this.startX, y: this.startY };

        let annotation = null;

        switch (this.tool) {
            case 'pen':
                this.ctx.restore();
                annotation = {
                    type: 'pen',
                    points: [...this.currentPath],
                    color: this.color,
                    lineWidth: this.lineWidth,
                    opacity: this.opacity
                };
                break;
            case 'highlight':
                this.ctx.restore();
                annotation = {
                    type: 'highlight',
                    points: [...this.currentPath],
                    color: this.color,
                    lineWidth: this.lineWidth * 5,
                    opacity: this.opacity * 0.35
                };
                break;
            case 'wavyline':
                this.ctx.restore();
                annotation = {
                    type: 'wavyline',
                    points: [...this.currentPath],
                    color: this.color,
                    lineWidth: this.lineWidth,
                    amplitude: 2, // 波浪振幅（减小）
                    frequency: 0.4, // 波浪频率
                    opacity: this.opacity
                };
                break;
            case 'line':
                annotation = {
                    type: 'line',
                    x1: this.startX, y1: this.startY,
                    x2: pos.x, y2: pos.y,
                    color: this.color,
                    lineWidth: this.lineWidth,
                    opacity: this.opacity
                };
                break;
            case 'arrow':
                annotation = {
                    type: 'arrow',
                    x1: this.startX, y1: this.startY,
                    x2: pos.x, y2: pos.y,
                    color: this.color,
                    lineWidth: this.lineWidth,
                    opacity: this.opacity
                };
                break;
            case 'rect':
                annotation = {
                    type: 'rect',
                    x: Math.min(this.startX, pos.x),
                    y: Math.min(this.startY, pos.y),
                    w: Math.abs(pos.x - this.startX),
                    h: Math.abs(pos.y - this.startY),
                    color: this.color,
                    lineWidth: this.lineWidth,
                    opacity: this.opacity
                };
                break;
        }

        if (annotation) {
            this._addAnnotation(annotation);
        }

        this.currentPath = [];
        this.snapshotImageData = null;
    }

    // ===== 绘制方法 =====
    _applyStyle() {
        this.ctx.strokeStyle = this.color;
        this.ctx.fillStyle = this.color;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = this.opacity;
    }

    _drawPenMove(x, y) {
        this.currentPath.push({ x, y });
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    _drawHighlightMove(x, y) {
        this.currentPath.push({ x, y });
        this.ctx.lineWidth = this.lineWidth * 5;
        this.ctx.globalAlpha = this.opacity * 0.35;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    /**
     * 波浪线绘制（实时预览）- 使用快照避免重叠
     */
    _drawWavyLineMove(x, y) {
        // 恢复快照（清除之前的预览，避免叠加变厚）
        if (this.snapshotImageData) {
            this.ctx.putImageData(this.snapshotImageData, 0, 0);
        }

        // 更新终点
        this.currentPath = [this.currentPath[0], { x, y }];

        // 在快照上绘制波浪线预览
        this._drawWavyLine(this.currentPath);
    }

    /**
     * 绘制波浪线路径（实时预览，使用当前样式）
     * 直线模式：只连接起点和终点
     * @param {Array} points - 路径点数组 [起点, 终点]
     */
    _drawWavyLine(points) {
        if (points.length < 2) return;

        const amplitude = 2; // 波浪振幅（减小）
        const frequency = 0.4; // 波浪频率（稍微加密）

        this.ctx.save();
        this._applyStyle();

        const startX = points[0].x;
        const startY = points[0].y;
        const endX = points[points.length - 1].x;
        const endY = points[points.length - 1].y;

        // 计算直线的长度和角度
        const length = Math.hypot(endX - startX, endY - startY);
        if (length === 0) return;

        const angle = Math.atan2(endY - startY, endX - startX);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);

        // 沿直线方向绘制正弦波
        const steps = Math.max(10, Math.ceil(length / 2));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const dist = length * t;

            // 基础位置（沿直线）
            const baseX = startX + Math.cos(angle) * dist;
            const baseY = startY + Math.sin(angle) * dist;

            // 波浪偏移（垂直于直线方向）
            const waveOffset = Math.sin(dist * frequency) * amplitude;
            const perpX = -Math.sin(angle) * waveOffset;
            const perpY = Math.cos(angle) * waveOffset;

            this.ctx.lineTo(baseX + perpX, baseY + perpY);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * 从标注数据绘制波浪线（重绘时使用）
     */
    _drawWavyLineFromAnn(ann) {
        if (!ann.points || ann.points.length < 2) return;

        const amplitude = ann.amplitude || 2;
        const frequency = ann.frequency || 0.4;

        this.ctx.strokeStyle = ann.color;
        this.ctx.lineWidth = ann.lineWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        const startX = ann.points[0].x;
        const startY = ann.points[0].y;
        const endX = ann.points[ann.points.length - 1].x;
        const endY = ann.points[ann.points.length - 1].y;

        const length = Math.hypot(endX - startX, endY - startY);
        if (length === 0) return;

        const angle = Math.atan2(endY - startY, endX - startX);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);

        const steps = Math.max(10, Math.ceil(length / 2));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const dist = length * t;

            const baseX = startX + Math.cos(angle) * dist;
            const baseY = startY + Math.sin(angle) * dist;

            const waveOffset = Math.sin(dist * frequency) * amplitude;
            const perpX = -Math.sin(angle) * waveOffset;
            const perpY = Math.cos(angle) * waveOffset;

            this.ctx.lineTo(baseX + perpX, baseY + perpY);
        }

        this.ctx.stroke();
    }

    _drawShapePreview(x, y, shape) {
        // 恢复快照后绘制预览
        this.ctx.putImageData(this.snapshotImageData, 0, 0);
        this.ctx.save();
        this._applyStyle();

        if (shape === 'line') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.startX, this.startY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        } else if (shape === 'arrow') {
            this._drawArrow(this.startX, this.startY, x, y);
        } else if (shape === 'rect') {
            this.ctx.beginPath();
            this.ctx.rect(Math.min(this.startX, x), Math.min(this.startY, y),
                         Math.abs(x - this.startX), Math.abs(y - this.startY));
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    _drawArrow(x1, y1, x2, y2) {
        const headLength = Math.max(10, this.lineWidth * 4);
        const angle = Math.atan2(y2 - y1, x2 - x1);

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();

        // 箭头头部
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.stroke();
    }

    /**
     * 绘制文字标注
     */
    drawText(x, y, text) {
        const annotation = {
            type: 'text',
            x, y, text,
            color: this.color,
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            bold: this.bold,
            italic: this.italic,
            underline: this.underline,
            opacity: this.opacity
        };
        this._addAnnotation(annotation);
        this._drawAnnotation(annotation);
    }

    /**
     * 绘制单个标注到canvas
     */
    _drawAnnotation(ann) {
        this.ctx.save();
        this.ctx.globalAlpha = ann.opacity ?? 1.0;

        switch (ann.type) {
            case 'pen':
                this.ctx.strokeStyle = ann.color;
                this.ctx.lineWidth = ann.lineWidth;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.beginPath();
                if (ann.points.length > 0) {
                    this.ctx.moveTo(ann.points[0].x, ann.points[0].y);
                    for (let i = 1; i < ann.points.length; i++) {
                        this.ctx.lineTo(ann.points[i].x, ann.points[i].y);
                    }
                }
                this.ctx.stroke();
                break;

            case 'highlight':
                this.ctx.strokeStyle = ann.color;
                this.ctx.lineWidth = ann.lineWidth;
                this.ctx.lineCap = 'butt';
                this.ctx.lineJoin = 'round';
                this.ctx.beginPath();
                if (ann.points.length > 0) {
                    this.ctx.moveTo(ann.points[0].x, ann.points[0].y);
                    for (let i = 1; i < ann.points.length; i++) {
                        this.ctx.lineTo(ann.points[i].x, ann.points[i].y);
                    }
                }
                this.ctx.stroke();
                break;

            case 'wavyline':
                if (ann.points && ann.points.length > 1) {
                    this._drawWavyLineFromAnn(ann);
                }
                break;

            case 'line':
                this.ctx.strokeStyle = ann.color;
                this.ctx.lineWidth = ann.lineWidth;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(ann.x1, ann.y1);
                this.ctx.lineTo(ann.x2, ann.y2);
                this.ctx.stroke();
                break;

            case 'arrow':
                this.ctx.strokeStyle = ann.color;
                this.ctx.fillStyle = ann.color;
                this.ctx.lineWidth = ann.lineWidth;
                this.ctx.lineCap = 'round';
                this._drawArrow(ann.x1, ann.y1, ann.x2, ann.y2);
                break;

            case 'rect':
                this.ctx.strokeStyle = ann.color;
                this.ctx.lineWidth = ann.lineWidth;
                this.ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
                break;

            case 'text':
                let fontStr = '';
                if (ann.italic) fontStr += 'italic ';
                if (ann.bold) fontStr += 'bold ';
                fontStr += ann.fontSize + 'px ' + ann.fontFamily;
                this.ctx.font = fontStr;
                this.ctx.fillStyle = ann.color;
                this.ctx.textBaseline = 'top';

                const lines = ann.text.split('\n');
                lines.forEach((line, i) => {
                    this.ctx.fillText(line, ann.x, ann.y + i * ann.fontSize * 1.3);
                    if (ann.underline) {
                        const metrics = this.ctx.measureText(line);
                        this.ctx.fillRect(ann.x, ann.y + i * ann.fontSize * 1.3 + ann.fontSize,
                                         metrics.width, Math.max(1, ann.fontSize / 12));
                    }
                });
                break;

            case 'texthighlight':
                // 文字选择高亮：绘制背景色矩形（统一透明度）
                if (ann.rects && ann.rects.length > 0) {
                    this.ctx.fillStyle = ann.color;
                    this.ctx.globalAlpha = ann.opacity || 0.45;
                    // 先保存当前状态
                    const currentAlpha = this.ctx.globalAlpha;

                    ann.rects.forEach(rect => {
                        this.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
                    });
                }
                break;
        }

        this.ctx.restore();
    }

    // ===== 橡皮擦 =====
    _eraseAt(x, y) {
        const anns = this.annotationsByPage[this.currentPage];
        if (!anns) return;

        const eraseRadius = this.lineWidth * 5;
        let removed = false;

        for (let i = anns.length - 1; i >= 0; i--) {
            if (this._isAnnotationNear(anns[i], x, y, eraseRadius)) {
                this._pushUndo({ action: 'erase', annotation: anns[i], index: i, page: this.currentPage });
                anns.splice(i, 1);
                removed = true;
                break;
            }
        }

        if (removed) {
            this.redraw();
        }
    }

    _isAnnotationNear(ann, x, y, radius) {
        switch (ann.type) {
            case 'pen':
            case 'highlight':
                return ann.points.some(p => Math.hypot(p.x - x, p.y - y) < radius);
            case 'wavyline':
                // 波浪线是直线模式，使用线段距离检测
                if (ann.points && ann.points.length >= 2) {
                    const start = ann.points[0];
                    const end = ann.points[ann.points.length - 1];
                    return this._distToSegment(x, y, start.x, start.y, end.x, end.y) < radius;
                }
                return false;
            case 'line':
            case 'arrow':
                return this._distToSegment(x, y, ann.x1, ann.y1, ann.x2, ann.y2) < radius;
            case 'rect':
                return (Math.abs(x - ann.x) < radius || Math.abs(x - (ann.x + ann.w)) < radius) &&
                       (ann.y <= y + radius && y <= ann.y + ann.h + radius) ||
                       (Math.abs(y - ann.y) < radius || Math.abs(y - (ann.y + ann.h)) < radius) &&
                       (ann.x <= x + radius && x <= ann.x + ann.w + radius);
            case 'text':
                return Math.abs(x - ann.x) < 100 && Math.abs(y - ann.y) < 50;
            case 'texthighlight':
                // 检查是否在任意高亮矩形内
                if (ann.rects) {
                    return ann.rects.some(rect =>
                        x >= rect.x && x <= rect.x + rect.w &&
                        y >= rect.y && y <= rect.y + rect.h
                    );
                }
                return false;
            default:
                return false;
        }
    }

    _distToSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = dx * dx + dy * dy;
        if (len === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * dx + (py - y1) * dy) / len;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // ===== 标注管理 =====
    _addAnnotation(ann) {
        if (!this.annotationsByPage[this.currentPage]) {
            this.annotationsByPage[this.currentPage] = [];
        }
        this.annotationsByPage[this.currentPage].push(ann);
        this._pushUndo({ action: 'add', annotation: ann, page: this.currentPage });
        this.redoStack = [];
    }

    _pushUndo(entry) {
        this.undoStack.push(entry);
        if (this.undoStack.length > 100) this.undoStack.shift();
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        const entry = this.undoStack.pop();
        const page = entry.page;
        const anns = this.annotationsByPage[page] || [];

        if (entry.action === 'move') {
            if (entry.index < anns.length) {
                const current = JSON.parse(JSON.stringify(anns[entry.index]));
                anns[entry.index] = entry.original;
                entry.original = current;
            }
            this.redoStack.push(entry);
            this.redraw();
            return true;
        }

        if (entry.action === 'style') {
            const anns2 = this.annotationsByPage[page] || [];
            if (entry.index < anns2.length) {
                const current = JSON.parse(JSON.stringify(anns2[entry.index]));
                anns2[entry.index] = entry.original;
                entry.original = current;
            }
            this.redoStack.push(entry);
            this.redraw();
            return true;
        }

        if (entry.action === 'add') {
            // 撤销添加：移除最后添加的标注
            const idx = anns.lastIndexOf(entry.annotation);
            if (idx >= 0) anns.splice(idx, 1);
            this.redoStack.push(entry);
        } else if (entry.action === 'erase') {
            // 撤销擦除：恢复标注
            anns.splice(Math.min(entry.index, anns.length), 0, entry.annotation);
            this.redoStack.push(entry);
        } else if (entry.action === 'clear') {
            // 撤销清除：恢复整页标注
            this.annotationsByPage[page] = entry.annotations;
            this.redoStack.push(entry);
        }

        this.redraw();
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        const entry = this.redoStack.pop();
        const page = entry.page;

        if (entry.action === 'move') {
            const anns = this.annotationsByPage[page] || [];
            if (entry.index < anns.length) {
                const current = JSON.parse(JSON.stringify(anns[entry.index]));
                anns[entry.index] = entry.original;
                entry.original = current;
            }
            this.undoStack.push(entry);
            this.redraw();
            return true;
        }

        if (entry.action === 'style') {
            const anns = this.annotationsByPage[page] || [];
            if (entry.index < anns.length) {
                const current = JSON.parse(JSON.stringify(anns[entry.index]));
                anns[entry.index] = entry.original;
                entry.original = current;
            }
            this.undoStack.push(entry);
            this.redraw();
            return true;
        }

        if (entry.action === 'add') {
            if (!this.annotationsByPage[page]) this.annotationsByPage[page] = [];
            this.annotationsByPage[page].push(entry.annotation);
            this.undoStack.push(entry);
        } else if (entry.action === 'erase') {
            const anns = this.annotationsByPage[page] || [];
            if (entry.index < anns.length) anns.splice(entry.index, 1);
            this.undoStack.push(entry);
        } else if (entry.action === 'clear') {
            this.annotationsByPage[page] = [];
            this.undoStack.push(entry);
        }

        this.redraw();
        return true;
    }

    clearPage() {
        const anns = this.annotationsByPage[this.currentPage];
        if (!anns || anns.length === 0) return false;
        this._pushUndo({ action: 'clear', annotations: [...anns], page: this.currentPage });
        this.annotationsByPage[this.currentPage] = [];
        this.redoStack = [];
        this.redraw();
        return true;
    }

    // ===== 重绘 =====
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const anns = this.annotationsByPage[this.currentPage] || [];
        anns.forEach(ann => this._drawAnnotation(ann));
        // 绘制选中指示器
        if (this.selectedAnnotation && this.tool === 'select') {
            this._drawSelectionBox(this.selectedAnnotation);
        }
    }

    /**
     * 获取当前页所有标注
     */
    getPageAnnotations(pageIndex) {
        return this.annotationsByPage[pageIndex] || [];
    }

    /**
     * 获取所有标注数据（用于导出）
     */
    getAllAnnotations() {
        return JSON.parse(JSON.stringify(this.annotationsByPage));
    }

    /**
     * 取消选择
     */
    deselect() {
        this.selectedAnnotation = null;
        this.selectedIndex = -1;
        this._styleUndoSaved = false;
        if (this.onSelectionChange) this.onSelectionChange(null);
        this.redraw();
    }

    /**
     * 双击事件：编辑文字标注
     */
    _onDoubleClick(e) {
        if (this.tool !== 'select') return;
        const pos = this._getPos(e);
        const hit = this._findAnnotationAt(pos.x, pos.y);
        if (hit && hit.annotation.type === 'text') {
            if (this.onTextEdit) {
                this.onTextEdit(hit.annotation, hit.index);
            }
        }
    }

    /**
     * 查找坐标处的标注（从上层往下检测）
     */
    _findAnnotationAt(x, y) {
        const anns = this.annotationsByPage[this.currentPage];
        if (!anns) return null;
        for (let i = anns.length - 1; i >= 0; i--) {
            if (this._isAnnotationNear(anns[i], x, y, 15)) {
                return { annotation: anns[i], index: i };
            }
        }
        return null;
    }

    /**
     * 移动标注（偏移所有坐标）
     */
    _moveAnnotation(ann, dx, dy) {
        switch (ann.type) {
            case 'pen':
            case 'highlight':
            case 'wavyline':
                ann.points.forEach(p => { p.x += dx; p.y += dy; });
                break;
            case 'line':
            case 'arrow':
                ann.x1 += dx; ann.y1 += dy;
                ann.x2 += dx; ann.y2 += dy;
                break;
            case 'rect':
            case 'text':
                ann.x += dx; ann.y += dy;
                break;
            case 'texthighlight':
                // 移动所有高亮矩形
                if (ann.rects) {
                    ann.rects.forEach(rect => {
                        rect.x += dx;
                        rect.y += dy;
                    });
                }
                break;
        }
    }

    /**
     * 获取标注的边界框
     */
    _getAnnotationBounds(ann) {
        switch (ann.type) {
            case 'pen':
            case 'highlight':
            case 'wavyline': {
                if (!ann.points || ann.points.length === 0) return null;
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                ann.points.forEach(p => {
                    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
                });
                const pad = (ann.lineWidth || 2) + 4;
                return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
            }
            case 'line':
            case 'arrow': {
                const pad = (ann.lineWidth || 2) + 4;
                return {
                    x: Math.min(ann.x1, ann.x2) - pad,
                    y: Math.min(ann.y1, ann.y2) - pad,
                    w: Math.abs(ann.x2 - ann.x1) + pad * 2,
                    h: Math.abs(ann.y2 - ann.y1) + pad * 2
                };
            }
            case 'rect':
                return { x: ann.x - 4, y: ann.y - 4, w: ann.w + 8, h: ann.h + 8 };
            case 'text': {
                let fontStr = '';
                if (ann.italic) fontStr += 'italic ';
                if (ann.bold) fontStr += 'bold ';
                fontStr += ann.fontSize + 'px ' + ann.fontFamily;
                this.ctx.font = fontStr;
                const lines = ann.text.split('\n');
                let maxW = 0;
                lines.forEach(line => {
                    const m = this.ctx.measureText(line);
                    if (m.width > maxW) maxW = m.width;
                });
                const h = lines.length * ann.fontSize * 1.3;
                return { x: ann.x - 4, y: ann.y - 4, w: maxW + 12, h: h + 8 };
            }
            case 'texthighlight':
                // 返回所有高亮矩形的联合边界
                if (ann.rects && ann.rects.length > 0) {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    ann.rects.forEach(rect => {
                        minX = Math.min(minX, rect.x);
                        minY = Math.min(minY, rect.y);
                        maxX = Math.max(maxX, rect.x + rect.w);
                        maxY = Math.max(maxY, rect.y + rect.h);
                    });
                    return { x: minX - 4, y: minY - 4, w: maxX - minX + 8, h: maxY - minY + 8 };
                }
                return null;
            default:
                return null;
        }
    }

    /**
     * 绘制选中框（虚线边框 + 角落手柄）
     */
    _drawSelectionBox(ann) {
        const bounds = this._getAnnotationBounds(ann);
        if (!bounds) return;

        this.ctx.save();
        // 虚线边框
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 1.5;
        this.ctx.setLineDash([6, 4]);
        this.ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

        // 角落手柄
        this.ctx.setLineDash([]);
        this.ctx.fillStyle = '#3498db';
        const hs = 8;
        const corners = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.w, y: bounds.y },
            { x: bounds.x, y: bounds.y + bounds.h },
            { x: bounds.x + bounds.w, y: bounds.y + bounds.h }
        ];
        corners.forEach(c => {
            this.ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        });
        this.ctx.restore();
    }

    /**
     * 删除选中的标注
     */
    deleteSelected() {
        if (this.selectedIndex < 0 || !this.selectedAnnotation) return false;
        const anns = this.annotationsByPage[this.currentPage];
        if (!anns || this.selectedIndex >= anns.length) return false;
        this._pushUndo({
            action: 'erase',
            annotation: JSON.parse(JSON.stringify(anns[this.selectedIndex])),
            index: this.selectedIndex,
            page: this.currentPage
        });
        anns.splice(this.selectedIndex, 1);
        this.selectedAnnotation = null;
        this.selectedIndex = -1;
        this.redoStack = [];
        this.redraw();
        return true;
    }

    /**
     * 更新选中标注的样式属性
     * @param {Object} props - 要更新的属性 { color, lineWidth, fontSize, fontFamily, bold, italic, underline, opacity }
     */
    updateSelectedStyle(props) {
        if (!this.selectedAnnotation || this.selectedIndex < 0) return false;
        const anns = this.annotationsByPage[this.currentPage];
        if (!anns || this.selectedIndex >= anns.length) return false;
        const ann = anns[this.selectedIndex];

        // 保存修改前的状态用于撤销
        if (!this._styleUndoSaved) {
            this._pushUndo({
                action: 'style',
                original: JSON.parse(JSON.stringify(ann)),
                index: this.selectedIndex,
                page: this.currentPage
            });
            this.redoStack = [];
            this._styleUndoSaved = true;
        }

        // 根据标注类型应用对应属性
        if ('color' in props) ann.color = props.color;
        if ('opacity' in props) ann.opacity = props.opacity;

        if (ann.type === 'pen' || ann.type === 'highlight' || ann.type === 'line' || ann.type === 'arrow' || ann.type === 'rect') {
            if ('lineWidth' in props) ann.lineWidth = props.lineWidth;
        }

        if (ann.type === 'text') {
            if ('fontSize' in props) ann.fontSize = props.fontSize;
            if ('fontFamily' in props) ann.fontFamily = props.fontFamily;
            if ('bold' in props) ann.bold = props.bold;
            if ('italic' in props) ann.italic = props.italic;
            if ('underline' in props) ann.underline = props.underline;
        }

        this.redraw();
        return true;
    }

    /**
     * 结束样式编辑会话（重置undo标记，让下次修改可以单独撤销）
     */
    endStyleUpdate() {
        this._styleUndoSaved = false;
    }

    /**
     * 文字输入回调（由外部app.js设置）
     */
    _onTextRequest(x, y) {
        if (this.onTextRequest) {
            this.onTextRequest(x, y);
        }
    }

    // ===== 文字选择高亮功能 =====

    /**
     * 设置PDF页面引用（用于TextLayer渲染）
     * @param {PDFPageProxy} pdfPage - PDF.js的页面对象
     * @param {number} scale - 缩放比例
     */
    setPdfPage(pdfPage, scale) {
        this.pdfPage = pdfPage;
        this.scale = scale;
    }

    /**
     * 启用/禁用文字选择模式
     * @param {boolean} enabled - 是否启用
     */
    async setTextSelectionMode(enabled) {
        this.textSelectionMode = enabled;
    
        const pageContainer = this.canvas.parentElement;
        let textLayer = pageContainer.querySelector('.textLayer');
    
        if (enabled) {
            if (!textLayer) {
                textLayer = document.createElement('div');
                textLayer.className = 'textLayer';
    
                // 关键修复：textLayer 必须与 canvas 完全重叠
                // 使用 canvas 的实际显示尺寸（CSS尺寸）
                const displayWidth = parseFloat(this.canvas.style.width) || this.canvas.width;
                const displayHeight = parseFloat(this.canvas.style.height) || this.canvas.height;
    
                Object.assign(textLayer.style, {
                    position: 'absolute',
                    left: '0px',
                    top: '0px',
                    width: displayWidth + 'px',
                    height: displayHeight + 'px',
                    overflow: 'hidden',  // 改为 hidden 防止溢出
                    lineHeight: '1.0',
                    pointerEvents: 'auto',
                    cursor: 'text',
                    zIndex: '10',
                    userSelect: 'text',
                    webkitUserSelect: 'text',
                    mozUserSelect: 'text',
                    msUserSelect: 'text'
                });
    
                // 插入到 canvas 之后（确保在 canvas 上方接收鼠标事件）
                this.canvas.parentNode.insertBefore(textLayer, this.canvas.nextSibling);
            } else {
                // 重新同步尺寸（翻页后尺寸可能变化）
                const displayWidth = parseFloat(this.canvas.style.width) || this.canvas.width;
                const displayHeight = parseFloat(this.canvas.style.height) || this.canvas.height;
                textLayer.style.width = displayWidth + 'px';
                textLayer.style.height = displayHeight + 'px';
                
                textLayer.style.pointerEvents = 'auto';
                textLayer.style.display = 'block';
            }
    
            // 渲染 TextLayer
            await this._renderTextLayer(textLayer);
            this._bindDocumentSelectionEvent();
        } else {
            if (textLayer) {
                textLayer.style.pointerEvents = 'none';
                textLayer.style.display = 'none';
            }
            this._unbindDocumentSelectionEvent();
        }
    }

    /**
     * 渲染PDF TextLayer
     * @param {HTMLElement} textLayer - 文本层容器
     */
    async _renderTextLayer(textLayer) {
        if (!this.pdfPage || !window.pdfjsLib) {
            console.warn('无法渲染TextLayer: pdfPage或pdfjsLib不存在');
            return;
        }
    
        try {
            const viewport = this.pdfPage.getViewport({ scale: this.scale });
            const textContent = await this.pdfPage.getTextContent();
    
            // 清空旧内容
            textLayer.innerHTML = '';
    
            // 关键修复：textLayer 尺寸必须与 canvas 的 CSS 尺寸完全一致
            // canvas.style.width/height 是显示尺寸（= viewport.width/height，因为 DPR=1）
            const displayWidth = parseFloat(this.canvas.style.width) || this.canvas.width;
            const displayHeight = parseFloat(this.canvas.style.height) || this.canvas.height;
    
            Object.assign(textLayer.style, {
                width: displayWidth + 'px',
                height: displayHeight + 'px'
            });
    
            // 设置PDF.js需要的CSS变量
            textLayer.style.setProperty('--scale-factor', this.scale);
    
            // 使用PDF.js渲染TextLayer
            await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayer,
                viewport: viewport,
                textDivs: [],
                textContentItemsStr: []
            }).promise;
    
            // 设置文本span的样式：透明但可选择
            const spans = textLayer.querySelectorAll('span[role="presentation"]');
            spans.forEach(span => {
                // 关键：不改变 span 的 transform/position，只改颜色使其透明
                // PDF.js 用 transform: translate(Xpx, Ypx) 定位每个span
                // 这些坐标已经基于 viewport scale 计算，与 canvas 坐标一一对应
                Object.assign(span.style, {
                    color: 'transparent',
                    backgroundColor: 'transparent',
                    cursor: 'text',
                    userSelect: 'text',
                    webkitUserSelect: 'text',
                    mozUserSelect: 'text',
                    msUserSelect: 'text',
                    // 确保span不会影响布局
                    position: 'absolute',
                    whiteSpace: 'pre',
                    lineHeight: '1.0',
                    margin: '0',
                    padding: '0',
                    border: 'none',
                    outline: 'none'
                });
            });

            console.log('[TextLayer] 渲染完成, spans数量:', spans.length,
                        'textLayer尺寸:', displayWidth, 'x', displayHeight);
        } catch (error) {
            console.error('TextLayer渲染失败:', error);
        }
    }

    /**
     * 绑定document级别的文本选择事件
     */
    _bindDocumentSelectionEvent() {
        if (this._boundSelectionHandler) return;

        this._boundSelectionHandler = () => {
            if (!this.textSelectionMode || this.tool !== 'texthighlight') return;

            setTimeout(() => {
                const selection = window.getSelection();
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);

                    const textLayer = this.canvas.parentElement.querySelector('.textLayer');
                    if (!textLayer) return;

                    const layerRect = textLayer.getBoundingClientRect();

                    // 直接用 range.getClientRects() 获取选区矩形
                    // 浏览器已按行计算，每行返回一个连续矩形（天然包含空格）
                    const rangeRects = range.getClientRects();
                    const highlightRects = [];

                    for (let i = 0; i < rangeRects.length; i++) {
                        const r = rangeRects[i];
                        // 过滤掉零尺寸的矩形
                        if (r.width < 1 || r.height < 1) continue;

                        highlightRects.push({
                            x: Math.round(r.left - layerRect.left),
                            y: Math.round(r.top - layerRect.top),
                            w: Math.round(r.width),
                            h: Math.round(r.height)
                        });
                    }

                    if (highlightRects.length > 0) {
                        this._addTextHighlightAnnotation(highlightRects, selection.toString().trim());
                    }

                    selection.removeAllRanges();
                }
            }, 30);
        };

        document.addEventListener('mouseup', this._boundSelectionHandler);
    }

    /**
     * 解绑document级别的文本选择事件
     */
    _unbindDocumentSelectionEvent() {
        if (this._boundSelectionHandler) {
            document.removeEventListener('mouseup', this._boundSelectionHandler);
            this._boundSelectionHandler = null;
            console.log('已解绑document mouseup事件');
        }
    }

    /**
     * 添加文字高亮标注
     * @param {Array} rects - 高亮矩形数组
     * @param {string} text - 选中的文本内容
     */
    _addTextHighlightAnnotation(rects, text) {
        console.log('添加文字高亮:', text, '矩形数:', rects.length);

        const annotation = {
            type: 'texthighlight',
            rects: rects,
            color: this.color,
            opacity: 0.45,  // 半透明，既能看到高亮又能看清文字
            text: text,
            pageNumber: this.currentPage
        };

        // 使用annotationsByPage存储
        if (!this.annotationsByPage[this.currentPage]) {
            this.annotationsByPage[this.currentPage] = [];
        }
        this.annotationsByPage[this.currentPage].push(annotation);

        this._pushUndo({
            action: 'add',
            annotation: annotation,
            page: this.currentPage
        });
        this.redoStack = [];

        this.redraw();
        if (this.onChange) {
            this.onChange(this.getAllAnnotations());
        }
    }
}

// 导出
if (typeof module !== 'undefined') {
    module.exports = Annotator;
}
