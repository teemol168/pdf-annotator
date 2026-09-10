/**
 * i18n - 中英文语言包与切换
 * 支持 data-i18n / data-i18n-title / data-i18n-placeholder / data-i18n-html / data-i18n-attr
 * 默认按 navigator.language 自动选，用户切换后记 localStorage
 */
(function () {
  const STORAGE_KEY = 'miyu_lang';

  const dict = {
    zh: {
      // ===== 品牌/通用 =====
      "brand": "谜语猜猜",
      "brand_sub": "作品集",
      "back_to_home": "返回 谜语猜猜 个人作品集",

      // ===== 工具栏 =====
      "open_pdf": "打开 PDF",
      "no_file": "未加载文件",
      "prev_page": "上一页",
      "next_page": "下一页",
      "page_prefix": "第 ",
      "page_suffix": " 页",
      "zoom_out": "缩小",
      "zoom_in": "放大",
      "fit_width": "适应宽度",
      "undo": "撤销",
      "redo": "重做",
      "clear": "清除",
      "clear_page_tip": "清除当前页标注",
      "export_pdf": "导出 PDF",
      "export_tip": "导出标注后的PDF",

      // ===== 侧边栏：绘图工具 =====
      "draw_tools": "绘图工具",
      "tool_select": "选择",
      "tool_select_tip": "选择/移动/编辑",
      "tool_pen": "画笔",
      "tool_pen_tip": "自由画线",
      "tool_line": "直线",
      "tool_line_tip": "直线",
      "tool_arrow": "箭头",
      "tool_arrow_tip": "箭头",
      "tool_rect": "矩形",
      "tool_rect_tip": "矩形框",
      "tool_text": "文字",
      "tool_text_tip": "文字标注",
      "tool_highlight": "高亮",
      "tool_highlight_tip": "高亮",
      "tool_wavy": "波浪线",
      "tool_wavy_tip": "波浪线",
      "tool_textrhighlight": "文字高亮",
      "tool_textrhighlight_tip": "文字高亮",
      "tool_eraser": "橡皮",
      "tool_eraser_tip": "橡皮擦",

      // ===== 侧边栏：颜色/粗细/文字 =====
      "color": "颜色",
      "custom_color": "自定义颜色",
      "line_width": "线条粗细",
      "text_settings": "文字设置",
      "font": "字体",
      "font_size": "字号",
      "bold": "粗体",
      "italic": "斜体",
      "underline": "下划线",
      "rotation": "旋转角度",
      "opacity": "不透明度",
      "tips": "操作提示",

      // 操作提示（含简单 HTML）
      "tips_html": "🖱 <b>选择</b>：点击标注选中<br>" +
        "&nbsp;&nbsp;&nbsp;拖拽移动，双击文字编辑<br>" +
        "&nbsp;&nbsp;&nbsp;Delete 键删除选中<br>" +
        "✏️ <b>画笔/直线/箭头</b>：拖拽绘制<br>" +
        "🔤 <b>文字</b>：点击位置输入<br>" +
        "&nbsp;&nbsp;&nbsp;Enter 换行，Ctrl+Enter 确认<br>" +
        "🧽 <b>橡皮</b>：点击标注擦除",

      // ===== 空状态 =====
      "empty_h1": "PDF标注工具 - 在线PDF编辑、画线、文字标注",
      "empty_p": "点击「打开 PDF」上传文件<br>支持画线、文字标注、颜色和字体设置",
      "feat_pen": "✏️ 自由画笔 & 直线",
      "feat_text": "🔤 文字标注",
      "feat_color": "🎨 颜色 & 字体",
      "feat_arrow": "➤ 箭头 & 矩形框",
      "feat_highlight": "🖌 高亮标记",
      "feat_select": "🖱 选择/移动/编辑",
      "feat_undo": "↶ 撤销/重做",
      "feat_export": "⬇ 导出标注PDF",

      // ===== SEO 详情区 =====
      "seo_h1": "PDF在线标注与编辑功能",
      "seo_p1": "本工具提供全面的PDF标注功能，包括：在PDF文件上自由画线、绘制直线和箭头、添加文字标注并设置字体大小和颜色、使用矩形框选区域、高亮标记重点内容。所有标注均可选中后移动、编辑文字内容、修改颜色字体大小等样式，支持撤销和重做操作，完成标注后可导出为新的PDF文件。完全免费，无需安装软件，在浏览器中即可使用。",
      "seo_h2": "支持的标注类型",
      "seo_li1": "画笔标注：在PDF上自由手绘线条",
      "seo_li2": "直线标注：绘制精确直线",
      "seo_li3": "箭头标注：绘制带箭头的指引线",
      "seo_li4": "矩形标注：框选PDF区域",
      "seo_li5": "文字标注：在PDF任意位置添加文字，可选字体、字号、颜色、粗体、斜体、下划线",
      "seo_li6": "高亮标注：半透明高亮笔标记",
      "seo_li7": "橡皮擦：删除不需要的标注",
      "seo_h3": "PDF标注使用场景",
      "seo_p2": "适用于合同审阅、论文批注、图纸标记、法律文书标注、教学课件批注、设计稿审阅等多种场景。支持中文和英文字体，包括微软雅黑、宋体、楷体、黑体、Arial、Times New Roman等。标注后可一键导出PDF，方便分享和存档。",

      // ===== noscript =====
      "noscript": "本工具需要 JavaScript 支持。请启用浏览器 JavaScript 后使用 PDF 标注功能。",

      // ===== 文字输入弹窗 =====
      "text_modal_title": "输入标注文字",
      "text_modal_placeholder": "在此输入文字...\n（按 Enter 换行）",
      "text_modal_hint": "按 <b>Enter</b> 换行，<b>Esc</b> 取消",
      "cancel": "取消",
      "confirm": "确认",

      // ===== 加载 =====
      "loading_pdf": "正在加载PDF...",

      // ===== 动态 toast 提示 =====
      "t_pdfjs_missing": "PDF.js未加载，请检查网络连接后刷新页面",
      "t_select_pdf": "请选择PDF文件",
      "t_loaded": "已加载：{name}（{pages}页）",
      "t_load_failed": "PDF加载失败",
      "t_worker_failed": "PDF worker加载失败，请检查网络",
      "t_encrypted": "PDF已加密，无法打开",
      "t_invalid": "无效的PDF文件",
      "t_render_failed": "页面渲染失败",
      "t_undone": "已撤销",
      "t_redone": "已重做",
      "t_cleared": "已清除当前页标注",
      "t_no_annotations": "当前页无标注",
      "t_deleted": "已删除标注",
      "t_load_first": "请先加载PDF",
      "t_exporting": "正在导出，请稍候...",
      "t_export_ok": "导出成功！",
      "t_export_fail": "导出失败",
      "t_drop_pdf": "请拖入PDF文件",

      // ===== 页面管理：菜单 + 删除/提取弹窗 =====
      "page_menu": "页面 ▾",
      "page_menu_tip": "页面操作",
      "delete_page": "删除页面",
      "extract_page": "提取页面",
      "restore_pages": "恢复全部页面",
      "delete_page_title": "删除页面",
      "extract_page_title": "提取页面",
      "page_range_label": "页码范围",
      "range_placeholder": "例如 1-3, 5",
      "total_pages_hint": "共 {n} 页",
      "delete_preview": "将删除 {del} 页，剩余 {remain} 页",
      "delete_hint_html": "原文件不变 · 可用「恢复全部页面」还原",
      "extract_preview": "将提取 {n} 页生成新 PDF 下载",
      "extract_hint_html": "提取选中页面为新的 PDF 文件下载",
      "extract_btn": "提取并下载",
      "delete": "删除",
      "range_out_of_range": "页码超出范围，共 {max} 页",
      "range_invalid": "格式无效，请用 1-3, 5 这种写法",
      "range_empty": "请输入要操作的页码",
      "deleted_pages": "已删除 {n} 页",
      "restored_ok": "已恢复全部页面",
      "extracted_ok": "已提取 {n} 页并下载",
      "extract_fail": "提取失败",

      // ===== 合并 PDF =====
      "merge_pdf": "合并 PDF",
      "merge_title": "合并 PDF",
      "merge_drop_hint": "点击选择 或 拖拽多个 PDF 到此处",
      "merge_hint_html": "按顺序合并 · 原文件无损复制",
      "merge_btn": "合并并载入",
      "merge_total": "共 {n} 个文件 · 合并后 {pages} 页",
      "merge_empty": "请添加至少一个 PDF 文件",
      "merge_load_fail": "无法读取：{name}",
      "merge_ok": "已合并 {n} 个文件（{pages} 页）",
      "merge_fail": "合并失败",
      "pages_unit": "页",

      // ===== 语言切换器 =====
      "lang_zh": "中",
      "lang_en": "EN",

      // ===== home.html =====
      "home_title": "谜语猜猜 · 个人作品集 | PDF在线标注工具与谜语小站",
      "home_nav_works": "作品",
      "home_nav_features": "能力",
      "home_nav_about": "关于",
      "home_nav_open_pdf": "打开 PDF 工具",
      "home_kicker": "个人作品集 · 非商业 · 免费使用",
      "home_h1_pre": "用代码做点 ",
      "home_h1_grad": "小而美",
      "home_h1_post": " 的东西",
      "home_lead": "这里收录我业余时间写的一些纯前端小作品：一个好用的 PDF 在线标注工具，以及一个谜语小站。文档不上传服务器，本地处理更安全。",
      "home_cta_primary": "立即体验 PDF 标注",
      "home_cta_ghost": "查看作品",
      "home_works_label": "Works",
      "home_works_h2": "两款小作品",
      "home_works_p": "都是为了解决自己的实际需求顺手做的，做完发现也能给别人用。",
      "home_card1_tag": "已上线",
      "home_card1_h3": "PDF 在线标注工具",
      "home_card1_p": "在浏览器里直接给 PDF 画线、加文字、高亮重点，标注可移动可编辑，完成后一键导出带批注的 PDF。",
      "home_chip_line": "画线 / 箭头",
      "home_chip_text": "文字标注",
      "home_chip_highlight": "高亮",
      "home_chip_export": "导出 PDF",
      "home_card1_go": "打开工具",
      "home_card2_tag": "持续完善",
      "home_card2_h3": "谜语猜猜",
      "home_card2_p": "收集中国各地趣味谜语的小站，看谜面、猜谜底。计划逐步收录更多地方谜语，做成可查阅的谜语库。",
      "home_chip_riddle1": "谜面",
      "home_chip_riddle2": "谜底",
      "home_chip_riddle3": "地方谜语",
      "home_card2_go": "了解更多",
      "home_feat_label": "Capabilities",
      "home_feat_h2": "PDF 标注工具能做什么",
      "home_feat_p": "面向日常办公与学习的轻量标注需求，开箱即用。",
      "home_feat1_b": "自由画线 / 箭头",
      "home_feat1_s": "在 PDF 上画重点、做指引，可调颜色与粗细。",
      "home_feat2_b": "文字标注",
      "home_feat2_s": "添加可移动、可编辑的文字，支持颜色、字体、旋转。",
      "home_feat3_b": "高亮标记",
      "home_feat3_s": "选中文本区域高亮，方便复习与批注。",
      "home_feat4_b": "矩形框选",
      "home_feat4_s": "框出关键区域，突出重点内容。",
      "home_feat5_b": "选中即改",
      "home_feat5_s": "点选标注可移动、改样式、删除，灵活调整。",
      "home_feat6_b": "导出 PDF",
      "home_feat6_s": "标注合并进原文件，导出带批注的 PDF。",
      "home_about_label": "About",
      "home_about_h2": "关于本站",
      "home_about_p": "定位与个人备案信息一致，纯作品展示用途。",
      "home_about_p1": "本站是<strong>个人技术作品集</strong>，用于展示我在前端开发上的练习与作品，便于记录和复盘，也为日后找工作增加一点说服力。",
      "home_about_p2": "所有工具均<strong>免费、无广告、不收集用户数据</strong>，文档处理均在你的浏览器本地完成，不会上传到服务器。",
      "home_footer": "© 2024 谜语猜猜 · 个人作品集",

      // ===== SEO meta（用于 <meta> 切换） =====
      "meta_title": "PDF标注工具 - 在线PDF编辑、画线、文字标注 | 免费PDF批注工具",
      "meta_desc": "免费在线PDF标注工具，支持在PDF上画线、添加文字标注、设置颜色和字体、高亮标记、箭头指引、矩形框选等。可选中标注进行移动、编辑、修改样式，支持撤销重做，标注完成后可导出PDF文件。无需安装，浏览器直接使用。",
      "meta_home_title": "谜语猜猜 · 个人作品集 | PDF在线标注工具与谜语小站",
      "meta_home_desc": "谜语猜猜个人作品集，收录作者开发的两款小作品：PDF在线标注工具（支持画线、文字标注、高亮、导出PDF）与谜语猜猜。纯前端、免费、无需注册，浏览器直接使用。",
      "i18n_og_locale": "zh_CN"
    },

    en: {
      // ===== brand/general =====
      "brand": "Riddle Guess",
      "brand_sub": "Portfolio",
      "back_to_home": "Back to Riddle Guess portfolio",

      // ===== toolbar =====
      "open_pdf": "Open PDF",
      "no_file": "No file loaded",
      "prev_page": "Previous page",
      "next_page": "Next page",
      "page_prefix": "Page ",
      "page_suffix": "",
      "zoom_out": "Zoom out",
      "zoom_in": "Zoom in",
      "fit_width": "Fit width",
      "undo": "Undo",
      "redo": "Redo",
      "clear": "Clear",
      "clear_page_tip": "Clear annotations on current page",
      "export_pdf": "Export PDF",
      "export_tip": "Export annotated PDF",

      // ===== side panel: drawing tools =====
      "draw_tools": "Drawing Tools",
      "tool_select": "Select",
      "tool_select_tip": "Select / Move / Edit",
      "tool_pen": "Pen",
      "tool_pen_tip": "Freehand line",
      "tool_line": "Line",
      "tool_line_tip": "Straight line",
      "tool_arrow": "Arrow",
      "tool_arrow_tip": "Arrow",
      "tool_rect": "Rect",
      "tool_rect_tip": "Rectangle",
      "tool_text": "Text",
      "tool_text_tip": "Text annotation",
      "tool_highlight": "Highlight",
      "tool_highlight_tip": "Highlight",
      "tool_wavy": "Wavy",
      "tool_wavy_tip": "Wavy line",
      "tool_textrhighlight": "Text HL",
      "tool_textrhighlight_tip": "Text highlight",
      "tool_eraser": "Eraser",
      "tool_eraser_tip": "Eraser",

      // ===== side panel: color/width/text =====
      "color": "Color",
      "custom_color": "Custom color",
      "line_width": "Line Width",
      "text_settings": "Text Settings",
      "font": "Font",
      "font_size": "Size",
      "bold": "Bold",
      "italic": "Italic",
      "underline": "Underline",
      "rotation": "Rotation",
      "opacity": "Opacity",
      "tips": "Tips",

      "tips_html": "🖱 <b>Select</b>: click an annotation to select<br>" +
        "&nbsp;&nbsp;&nbsp;drag to move, double-click text to edit<br>" +
        "&nbsp;&nbsp;&nbsp;Delete key to remove<br>" +
        "✏️ <b>Pen / Line / Arrow</b>: drag to draw<br>" +
        "🔤 <b>Text</b>: click position to input<br>" +
        "&nbsp;&nbsp;&nbsp;Enter for newline, Ctrl+Enter to confirm<br>" +
        "🧽 <b>Eraser</b>: click annotation to erase",

      // ===== empty state =====
      "empty_h1": "PDF Annotator - Online PDF Editor, Draw & Text Markup",
      "empty_p": "Click \"Open PDF\" to upload a file<br>Supports drawing, text, color and font settings",
      "feat_pen": "✏️ Free pen & line",
      "feat_text": "🔤 Text annotation",
      "feat_color": "🎨 Color & font",
      "feat_arrow": "➤ Arrow & rectangle",
      "feat_highlight": "🖌 Highlight",
      "feat_select": "🖱 Select / Move / Edit",
      "feat_undo": "↶ Undo / Redo",
      "feat_export": "⬇ Export annotated PDF",

      // ===== SEO details =====
      "seo_h1": "Online PDF Annotation & Editing",
      "seo_p1": "This tool provides comprehensive PDF annotation features: freehand drawing, straight lines and arrows, text annotations with font size and color, rectangle selection, and highlight markers. All annotations can be selected, moved, edited, and restyled. Undo/redo is supported, and the result can be exported as a new PDF. Completely free, no installation, runs in your browser.",
      "seo_h2": "Supported Annotation Types",
      "seo_li1": "Pen: freehand drawing on PDF",
      "seo_li2": "Line: precise straight lines",
      "seo_li3": "Arrow: arrow guide lines",
      "seo_li4": "Rectangle: box-select PDF areas",
      "seo_li5": "Text: add text anywhere, with font, size, color, bold, italic, underline",
      "seo_li6": "Highlight: semi-transparent highlighter",
      "seo_li7": "Eraser: remove unwanted annotations",
      "seo_h3": "Use Cases",
      "seo_p2": "Suitable for contract review, paper annotation, drawing markup, legal document annotation, teaching slides, design review and more. Supports Chinese and English fonts including Microsoft YaHei, SimSun, KaiTi, SimHei, Arial, Times New Roman. One-click export to PDF for sharing and archiving.",

      // ===== noscript =====
      "noscript": "This tool requires JavaScript. Please enable JavaScript in your browser to use the PDF annotation features.",

      // ===== text modal =====
      "text_modal_title": "Enter annotation text",
      "text_modal_placeholder": "Type here...\n(Enter for newline)",
      "text_modal_hint": "Press <b>Enter</b> for newline, <b>Esc</b> to cancel",
      "cancel": "Cancel",
      "confirm": "Confirm",

      // ===== loading =====
      "loading_pdf": "Loading PDF...",

      // ===== dynamic toasts =====
      "t_pdfjs_missing": "PDF.js failed to load. Check your connection and refresh.",
      "t_select_pdf": "Please select a PDF file",
      "t_loaded": "Loaded: {name} ({pages} pages)",
      "t_load_failed": "Failed to load PDF",
      "t_worker_failed": "PDF worker failed to load. Check your network.",
      "t_encrypted": "PDF is encrypted and cannot be opened",
      "t_invalid": "Invalid PDF file",
      "t_render_failed": "Page render failed",
      "t_undone": "Undone",
      "t_redone": "Redone",
      "t_cleared": "Cleared annotations on this page",
      "t_no_annotations": "No annotations on this page",
      "t_deleted": "Annotation deleted",
      "t_load_first": "Please load a PDF first",
      "t_exporting": "Exporting, please wait...",
      "t_export_ok": "Export succeeded!",
      "t_export_fail": "Export failed",
      "t_drop_pdf": "Please drop a PDF file",

      // ===== page management: menu + delete/extract modals =====
      "page_menu": "Pages ▾",
      "page_menu_tip": "Page operations",
      "delete_page": "Delete pages",
      "extract_page": "Extract pages",
      "restore_pages": "Restore all pages",
      "delete_page_title": "Delete Pages",
      "extract_page_title": "Extract Pages",
      "page_range_label": "Page range",
      "range_placeholder": "e.g. 1-3, 5",
      "total_pages_hint": "{n} pages total",
      "delete_preview": "Will delete {del} pages, {remain} remaining",
      "delete_hint_html": "Original file unchanged · Use Restore to undo",
      "extract_preview": "Will extract {n} pages into a new PDF",
      "extract_hint_html": "Extract selected pages into a new PDF for download",
      "extract_btn": "Extract & Download",
      "delete": "Delete",
      "range_out_of_range": "Page out of range, {max} total",
      "range_invalid": "Invalid format, use e.g. 1-3, 5",
      "range_empty": "Please enter page numbers",
      "deleted_pages": "Deleted {n} pages",
      "restored_ok": "All pages restored",
      "extracted_ok": "Extracted {n} pages and downloaded",
      "extract_fail": "Extract failed",

      // ===== merge PDF =====
      "merge_pdf": "Merge PDFs",
      "merge_title": "Merge PDFs",
      "merge_drop_hint": "Click or drag multiple PDFs here",
      "merge_hint_html": "Merged in order · original files unchanged",
      "merge_btn": "Merge & Load",
      "merge_total": "{n} files · {pages} pages merged",
      "merge_empty": "Add at least one PDF",
      "merge_load_fail": "Could not read: {name}",
      "merge_ok": "Merged {n} files ({pages} pages)",
      "merge_fail": "Merge failed",
      "pages_unit": "pages",

      // ===== lang switch =====
      "lang_zh": "中",
      "lang_en": "EN",

      // ===== home.html =====
      "home_title": "Riddle Guess · Portfolio | Online PDF Annotator & Riddle Site",
      "home_nav_works": "Works",
      "home_nav_features": "Features",
      "home_nav_about": "About",
      "home_nav_open_pdf": "Open PDF Tool",
      "home_kicker": "Personal Portfolio · Non-commercial · Free",
      "home_h1_pre": "Building ",
      "home_h1_grad": "small & beautiful",
      "home_h1_post": " things with code",
      "home_lead": "A collection of my front-end side projects: a handy online PDF annotator, and a riddle site. Files are processed locally in your browser, never uploaded.",
      "home_cta_primary": "Try PDF Annotator",
      "home_cta_ghost": "View works",
      "home_works_label": "Works",
      "home_works_h2": "Two small projects",
      "home_works_p": "Built to scratch my own itch, and turned out useful for others too.",
      "home_card1_tag": "Live",
      "home_card1_h3": "Online PDF Annotator",
      "home_card1_p": "Draw, add text, and highlight on PDFs right in your browser. Annotations are movable and editable. Export an annotated PDF in one click.",
      "home_chip_line": "Line / Arrow",
      "home_chip_text": "Text",
      "home_chip_highlight": "Highlight",
      "home_chip_export": "Export PDF",
      "home_card1_go": "Open tool",
      "home_card2_tag": "In progress",
      "home_card2_h3": "Riddle Guess",
      "home_card2_p": "A small site collecting riddles from across China. Browse riddles and answers. Plans to grow into a searchable local riddle library.",
      "home_chip_riddle1": "Riddle",
      "home_chip_riddle2": "Answer",
      "home_chip_riddle3": "Local riddles",
      "home_card2_go": "Learn more",
      "home_feat_label": "Capabilities",
      "home_feat_h2": "What the PDF Annotator can do",
      "home_feat_p": "Lightweight annotation for daily office and study needs. Out of the box.",
      "home_feat1_b": "Freehand / Arrow",
      "home_feat1_s": "Mark and guide on PDF, adjustable color and width.",
      "home_feat2_b": "Text annotation",
      "home_feat2_s": "Movable, editable text with color, font, and rotation.",
      "home_feat3_b": "Highlight",
      "home_feat3_s": "Highlight selected text for review and notes.",
      "home_feat4_b": "Rectangle",
      "home_feat4_s": "Box key areas to emphasize content.",
      "home_feat5_b": "Select to edit",
      "home_feat5_s": "Click annotations to move, restyle, or delete.",
      "home_feat6_b": "Export PDF",
      "home_feat6_s": "Merge annotations into the file and export.",
      "home_about_label": "About",
      "home_about_h2": "About this site",
      "home_about_p": "Aligns with the personal ICP filing. For portfolio display only.",
      "home_about_p1": "This is a <strong>personal tech portfolio</strong> showcasing my front-end practice and projects, for recording and review, and to support future job hunting.",
      "home_about_p2": "All tools are <strong>free, ad-free, and collect no user data</strong>. File processing happens locally in your browser, nothing is uploaded.",
      "home_footer": "© 2024 Riddle Guess · Personal Portfolio",

      // ===== SEO meta =====
      "meta_title": "PDF Annotator - Online PDF Editor, Draw & Text Markup | Free PDF Annotation Tool",
      "meta_desc": "Free online PDF annotator. Draw, add text, set color and font, highlight, arrow, and rectangle on PDFs. Select annotations to move, edit, and restyle. Undo/redo supported. Export annotated PDF. No install, runs in browser.",
      "meta_home_title": "Riddle Guess · Portfolio | Online PDF Annotator & Riddle Site",
      "meta_home_desc": "Personal portfolio with two front-end side projects: an online PDF annotator (draw, text, highlight, export) and Riddle Guess. Free, no signup, runs in browser.",
      "i18n_og_locale": "en_US"
    }
  };

  function detect() {
    const l = (navigator.language || navigator.userLanguage || 'zh').toLowerCase();
    return l.indexOf('zh') === 0 ? 'zh' : 'en';
  }

  let current = localStorage.getItem(STORAGE_KEY) || detect();

  function t(key, args) {
    const table = dict[current] || dict.zh;
    let s = table[key] != null ? table[key] : (dict.zh[key] != null ? dict.zh[key] : key);
    if (args) {
      Object.keys(args).forEach(k => {
        s = s.split('{' + k + '}').join(args[k]);
      });
    }
    return s;
  }

  // 根据访问域名动态设置 canonical / hreflang / og:url
  // 同一份代码同时部署在 国内 与 海外(pdfmark)，
  // 必须让海外版的 canonical 指向自己，否则 Google 会把它当作国内站的镜像而不收录
  function applySeo() {
    const host = location.hostname || '';
    const path = location.pathname || '';
    const isOversea = host.indexOf('pdfmark') === 0; // pdfmark.miyucaicai.cn
    const isHome = /home\.html$/.test(path) || /(^|\/)home\/?$/.test(path);

    // 作品集首页：www(国内) ↔ pdfmark/home.html(海外)
    // PDF 工具页：pdf(国内) ↔ pdfmark(海外)
    const cn = isHome ? 'https://www.miyucaicai.cn/' : 'https://pdf.miyucaicai.cn/';
    const en = isHome ? 'https://pdfmark.miyucaicai.cn/home.html'
                      : 'https://pdfmark.miyucaicai.cn/';
    const self = isOversea ? en : cn;

    const c = document.getElementById('canonical');
    const hzh = document.getElementById('hl_zh');
    const hen = document.getElementById('hl_en');
    const hx = document.getElementById('hl_x');
    const og = document.getElementById('og_url');

    if (c) c.setAttribute('href', self);
    if (hzh) hzh.setAttribute('href', cn);  // 中文版 → 国内站
    if (hen) hen.setAttribute('href', en);   // 英文版 → 海外站
    if (hx) hx.setAttribute('href', en);     // x-default → 海外英文版
    if (og) og.setAttribute('content', self);
  }

  function apply(root) {
    root = root || document;
    applySeo();
    // textContent
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    // title attribute
    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });
    // aria-label
    root.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    // placeholder
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    // innerHTML (for tips with <b> etc.)
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
    // meta tags: id -> dict key
    const metaMap = {
      'i18n_meta_desc': 'meta_desc',
      'i18n_og_title': 'meta_title',
      'i18n_og_desc': 'meta_desc',
      'i18n_og_locale': 'i18n_og_locale',
      'i18n_twitter_title': 'meta_title',
      'i18n_twitter_desc': 'meta_desc',
      // home page
      'i18n_home_meta_desc': 'meta_home_desc',
      'i18n_home_og_title': 'meta_home_title',
      'i18n_home_og_desc': 'meta_home_desc',
      'i18n_home_og_locale': 'i18n_og_locale',
      'i18n_home_twitter_title': 'meta_home_title',
      'i18n_home_twitter_desc': 'meta_home_desc'
    };
    Object.keys(metaMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('content', t(metaMap[id]));
    });
    // <title> tag by id (index vs home)
    const homeTitleEl = document.getElementById('i18n_home_doc_title');
    const indexTitleEl = document.getElementById('i18n_doc_title');
    if (homeTitleEl) document.title = t('meta_home_title');
    else if (indexTitleEl) document.title = t('meta_title');

    document.documentElement.lang = current === 'zh' ? 'zh-CN' : 'en';

    // highlight active switch button
    root.querySelectorAll('[data-lang-btn]').forEach(btn => {
      const target = btn.getAttribute('data-lang-btn');
      btn.classList.toggle('active', target === current);
    });
  }

  function setLang(lang) {
    if (!dict[lang]) return;
    current = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply();
  }

  function getLang() { return current; }

  // bind switch buttons (delegated, so works after dynamic content)
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-lang-btn]');
    if (btn) {
      setLang(btn.getAttribute('data-lang-btn'));
    }
  });

  // expose
  window.i18n = { t: t, setLang: setLang, getLang: getLang, apply: apply };

  // apply on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { apply(); });
  } else {
    apply();
  }
})();
