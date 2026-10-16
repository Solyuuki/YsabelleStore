import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");
const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};
const port = Number(process.env.PORT || 8080);
const apiProxyTarget = process.env.API_PROXY_TARGET ? new URL(process.env.API_PROXY_TARGET) : null;

if (
  apiProxyTarget &&
  (!["http:", "https:"].includes(apiProxyTarget.protocol) ||
    apiProxyTarget.username ||
    apiProxyTarget.password ||
    apiProxyTarget.search ||
    apiProxyTarget.hash ||
    !["/", ""].includes(apiProxyTarget.pathname))
) {
  throw new Error("API_PROXY_TARGET must be an HTTP(S) origin without credentials or a path.");
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function proxyApi(request, response) {
  if (!apiProxyTarget) {
    response.writeHead(503, { "Cache-Control": "no-store" });
    response.end("API proxy is not configured.");
    return;
  }

  let requested;
  try {
    requested = new URL(request.url || "/", "http://localhost");
    if (
      requested.origin !== "http://localhost" ||
      !(requested.pathname === "/api" || requested.pathname.startsWith("/api/"))
    ) {
      throw new Error("Invalid API request target.");
    }
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }

  const target = new URL(apiProxyTarget.origin);
  target.pathname = requested.pathname;
  target.search = requested.search;

  const headers = { ...request.headers };
  for (const name of Object.keys(headers)) {
    if (
      hopByHopHeaders.has(name) ||
      name === "host" ||
      name.startsWith("x-forwarded-") ||
      name === "x-ysabelle-first-party-proxy"
    ) {
      delete headers[name];
    }
  }
  headers.host = apiProxyTarget.host;
  headers["x-ysabelle-first-party-proxy"] = "1";

  const send = target.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = send(target, { method: request.method, headers }, (upstreamResponse) => {
    if (response.headersSent) return;
    const responseHeaders = { ...upstreamResponse.headers };
    for (const name of hopByHopHeaders) delete responseHeaders[name];
    responseHeaders["cache-control"] = "no-store";
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });

  upstream.setTimeout(30_000, () => upstream.destroy(new Error("API proxy timed out")));
  upstream.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "Cache-Control": "no-store" });
    response.end("The backend service is temporarily unavailable.");
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT for Railway static server.");
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  if (decoded.includes("\0") || decoded.includes("\\") || decoded.split("/").includes("..")) {
    return null;
  }
  const absolute = path.resolve(publicDirectory, "." + decoded);
  if (absolute !== publicDirectory && !absolute.startsWith(publicDirectory + path.sep)) {
    return null;
  }
  return absolute;
}

async function serve(request, response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (
    request.url?.startsWith("/api/") ||
    request.url?.startsWith("/api?") ||
    request.url === "/api"
  ) {
    proxyApi(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  let target;
  let pathname;
  try {
    pathname = new URL(request.url || "/", "http://localhost").pathname;
    target = safePath(pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (!target) {
    response.writeHead(400);
    response.end();
    return;
  }
  if (target === publicDirectory) target = path.join(publicDirectory, "index.html");

  let details;
  try {
    details = await stat(target);
  } catch {
    const acceptsHtml = (request.headers.accept || "").includes("text/html");
    if (
      !acceptsHtml ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/assets/") ||
      path.extname(pathname)
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    target = path.join(publicDirectory, "index.html");
    details = await stat(target);
  }
  if (!details.isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }

  const type = mimeTypes[path.extname(target).toLowerCase()] || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": details.size,
    "Cache-Control": target.includes(path.sep + "assets" + path.sep)
      ? "public, max-age=31536000, immutable"
      : "no-cache"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  const stream = createReadStream(target);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}

createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error("[railway-web] Request failed:", error);
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
}).listen(port, "0.0.0.0", () => {
  console.info("YsabelleStore Railway web listening on port " + port);
});
