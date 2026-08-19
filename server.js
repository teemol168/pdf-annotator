const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split("?")[0];
    let filePath = path.join(__dirname, urlPath === "/" ? "index.html" : urlPath);
    const ext = path.extname(filePath);
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
        res.end(data);
    });
});

server.listen(8080, () => {
    console.log("Server running at http://localhost:8080");
});
