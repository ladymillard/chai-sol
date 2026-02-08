// ChAI Agent Labor Market — Combined Server
// Serves frontend + proxies to backend API

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const API_PORT = process.env.API_PORT || 3001;
const FRONTEND_DIR = path.join(__dirname, "frontend");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Proxy API requests to backend
  if (req.url.startsWith("/api/")) {
    const options = {
      hostname: "localhost",
      port: API_PORT,
      path: req.url.replace("/api", ""),
      method: req.method,
      headers: req.headers
    };

    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxy.on("error", () => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: "Backend unavailable" }));
    });

    req.pipe(proxy);
    return;
  }

  // Serve frontend files
  let filePath = path.join(FRONTEND_DIR, req.url === "/" ? "index.html" : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html for SPA routes
      fs.readFile(path.join(FRONTEND_DIR, "index.html"), (err2, data2) => {
        if (err2) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("ChAI Agent Labor Market running on http://localhost:" + PORT);
  console.log("Frontend: http://localhost:" + PORT);
  console.log("API proxy: http://localhost:" + PORT + "/api/*");
  console.log("Backend direct: http://localhost:" + API_PORT);
});
