/**
 * PageManager - 删除/提取页面（纯前端，基于 pdf-lib）
 *
 * 设计要点（不重建 PDF，标注不丢）：
 * - originalBytes  : 用户上传 PDF 的原始字节副本，始终保留
 * - pageOrder      : 显示页号(1-based) -> 原始页号(0-based) 的映射数组
 * - 删除只改 pageOrder（虚删），PDF.js 仍用原始文档按映射取页渲染
 * - 标注按「原始页号」存储（annotator.annotationsByPage[origIdx]），
 *   删除/恢复不会让标注错位
 * - 提取：pdf-lib copyPages 选中的原始页 → 另存新 PDF 下载（当前文档不变）
 *
 * 依赖 app.js 的全局：pdfDoc / pdfFile / originalBytes / pageOrder /
 *   totalPages / totalPagesEl / pageInput / currentPage / renderPage /
 *   showToast / loadPdfLib / loadingOverlay / i18n
 */
(function () {
  // ===== 页码范围解析：支持 "1-3, 5, 8-10" =====
  // 返回 { indices: [1-based...], error: string|null }
  function parsePageRange(input, total) {
    if (!input || !input.trim()) return { indices: [], error: null };
    const result = [];
    const parts = input.split(/[,，\s]+/).filter(Boolean);
    for (const part of parts) {
      const m = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (m) {
        let a = parseInt(m[1]), b = parseInt(m[2]);
        if (a > b) { const t = a; a = b; b = t; } // 容错反向范围
        if (a < 1 || b > total) {
          return { indices: [], error: i18n.t('range_out_of_range', { max: total }) };
        }
        for (let i = a; i <= b; i++) result.push(i);
      } else if (/^\d+$/.test(part)) {
        const n = parseInt(part);
        if (n < 1 || n > total) {
          return { indices: [], error: i18n.t('range_out_of_range', { max: total }) };
        }
        result.push(n);
      } else {
        return { indices: [], error: i18n.t('range_invalid') };
      }
    }
    // 去重
    return { indices: [...new Set(result)], error: null };
  }

  // ===== 删除页面：只改 pageOrder，不重建 PDF =====
  // displayNums: 1-based 显示页号数组
  function deletePages(displayNums) {
    const toRemove = new Set(displayNums);
    pageOrder = pageOrder.filter((_, i) => !toRemove.has(i + 1));
    totalPages = pageOrder.length;
    totalPagesEl.textContent = totalPages;
    pageInput.max = totalPages;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    if (totalPages === 0) {
      pageInput.value = 0;
    } else {
      renderPage(currentPage);
    }
  }

  // ===== 提取页面：pdf-lib copyPages 另存下载 =====
  // displayNums: 1-based 显示页号数组
  async function extractPages(displayNums) {
    const origIndices = displayNums.map(d => pageOrder[d - 1]);
    const { PDFDocument } = await loadPdfLib();
    const src = await PDFDocument.load(originalBytes);
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, origIndices);
    copied.forEach(p => out.addPage(p));
    const bytes = await out.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_' + (pdfFile ? pdfFile.name : 'document.pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ===== 恢复全部页面 =====
  function restoreAll() {
    if (!pdfDoc) return false;
    pageOrder = Array.from({ length: pdfDoc.numPages }, (_, i) => i);
    totalPages = pageOrder.length;
    totalPagesEl.textContent = totalPages;
    pageInput.max = totalPages;
    currentPage = 1;
    pageInput.value = 1;
    renderPage(1);
    return true;
  }

  // ===== 菜单交互 =====
  const pageMenuBtn = document.getElementById('pageMenuBtn');
  const pageMenuDropdown = document.getElementById('pageMenuDropdown');

  if (pageMenuBtn) {
    pageMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pageMenuDropdown.style.display =
        pageMenuDropdown.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => {
      pageMenuDropdown.style.display = 'none';
    });
    pageMenuDropdown.addEventListener('click', (e) => e.stopPropagation());
  }

  document.querySelectorAll('.page-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      pageMenuDropdown.style.display = 'none';
      if (!pdfDoc) { showToast(i18n.t('t_load_first')); return; }
      const action = item.dataset.pageAction;
      if (action === 'delete') openDeleteModal();
      else if (action === 'extract') openExtractModal();
      else if (action === 'restore') {
        if (restoreAll()) showToast(i18n.t('restored_ok'));
      }
    });
  });

  // ===== 删除弹窗 =====
  const deleteModal = document.getElementById('deleteModal');
  const deleteRangeInput = document.getElementById('deleteRangeInput');
  const deletePreview = document.getElementById('deletePreview');
  const deleteTotalHint = document.getElementById('deleteTotalHint');

  function openDeleteModal() {
    deleteRangeInput.value = '';
    updateDeletePreview();
    deleteModal.style.display = 'flex';
    setTimeout(() => deleteRangeInput.focus(), 0);
  }

  function updateDeletePreview() {
    const total = pageOrder.length;
    deleteTotalHint.textContent = i18n.t('total_pages_hint', { n: total });
    const { indices, error } = parsePageRange(deleteRangeInput.value, total);
    if (error) {
      deletePreview.textContent = error;
      deletePreview.className = 'page-preview error';
      return;
    }
    if (indices.length === 0) {
      deletePreview.textContent = '';
      deletePreview.className = 'page-preview';
      return;
    }
    const remain = total - indices.length;
    deletePreview.textContent = i18n.t('delete_preview', { del: indices.length, remain });
    deletePreview.className = 'page-preview warn';
  }

  if (deleteRangeInput) {
    deleteRangeInput.addEventListener('input', updateDeletePreview);
    document.getElementById('deleteCancel').addEventListener('click', () => {
      deleteModal.style.display = 'none';
    });
    document.getElementById('deleteConfirm').addEventListener('click', () => {
      const total = pageOrder.length;
      const { indices, error } = parsePageRange(deleteRangeInput.value, total);
      if (error) { showToast(error); return; }
      if (indices.length === 0) { showToast(i18n.t('range_empty')); return; }
      deletePages(indices);
      deleteModal.style.display = 'none';
      showToast(i18n.t('deleted_pages', { n: indices.length }));
    });
    deleteRangeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('deleteConfirm').click(); }
      else if (e.key === 'Escape') { document.getElementById('deleteCancel').click(); }
    });
  }

  // ===== 提取弹窗 =====
  const extractModal = document.getElementById('extractModal');
  const extractRangeInput = document.getElementById('extractRangeInput');
  const extractPreview = document.getElementById('extractPreview');
  const extractTotalHint = document.getElementById('extractTotalHint');

  function openExtractModal() {
    extractRangeInput.value = '';
    updateExtractPreview();
    extractModal.style.display = 'flex';
    setTimeout(() => extractRangeInput.focus(), 0);
  }

  function updateExtractPreview() {
    const total = pageOrder.length;
    extractTotalHint.textContent = i18n.t('total_pages_hint', { n: total });
    const { indices, error } = parsePageRange(extractRangeInput.value, total);
    if (error) {
      extractPreview.textContent = error;
      extractPreview.className = 'page-preview error';
      return;
    }
    if (indices.length === 0) {
      extractPreview.textContent = '';
      extractPreview.className = 'page-preview';
      return;
    }
    extractPreview.textContent = i18n.t('extract_preview', { n: indices.length });
    extractPreview.className = 'page-preview';
  }

  if (extractRangeInput) {
    extractRangeInput.addEventListener('input', updateExtractPreview);
    document.getElementById('extractCancel').addEventListener('click', () => {
      extractModal.style.display = 'none';
    });
    document.getElementById('extractConfirm').addEventListener('click', async () => {
      const total = pageOrder.length;
      const { indices, error } = parsePageRange(extractRangeInput.value, total);
      if (error) { showToast(error); return; }
      if (indices.length === 0) { showToast(i18n.t('range_empty')); return; }
      loadingOverlay.style.display = 'flex';
      try {
        await extractPages(indices);
        extractModal.style.display = 'none';
        showToast(i18n.t('extracted_ok', { n: indices.length }));
      } catch (err) {
        console.error('[PageManager] 提取失败:', err);
        showToast(i18n.t('extract_fail') + ': ' + (err.message || err));
      } finally {
        loadingOverlay.style.display = 'none';
      }
    });
    extractRangeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('extractConfirm').click(); }
      else if (e.key === 'Escape') { document.getElementById('extractCancel').click(); }
    });
  }

  // 导出供外部调用
  window.pageManager = {
    parsePageRange,
    deletePages,
    extractPages,
    restoreAll
  };

  console.log('[PageManager] initialized.');
})();
