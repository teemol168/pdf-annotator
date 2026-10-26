// 本地/任何静态环境均可直接运行；也可用 `python -m http.server 8080`，效果相同。
// 站点结构：/ = index.html（首页），/pdf.html = 工具页 —— 纯静态，无需任何重写规则。
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8080;
const ROOT = __dirname;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".xml": "application/xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split("?")[0]);
    } catch (e) {
        res.writeHead(400); res.end("Bad Request"); return;
    }
    if (urlPath === "/") urlPath = "/index.html";

    const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(ROOT, safe);
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }

    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404 Not Found"); return; }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Static server: http://localhost:${PORT}  (/ = 首页 index.html，/pdf.html = 工具页)`);
});
