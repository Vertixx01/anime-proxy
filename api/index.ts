import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { handle } from "hono/vercel";
import { generateHeadersForUrl } from "../src/templates";

export const config = {
    runtime: "edge",
};

const app = new Hono().basePath("/api");

// ─── CORS constants ───────────────────────────────────────────────────────────
const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Range, X-Requested-With, Origin, Accept, Accept-Encoding, Accept-Language, Cache-Control, Pragma, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, Sec-Ch-Ua, Sec-Ch-Ua-Mobile, Sec-Ch-Ua-Platform, Connection",
    "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control, Expires, Vary, ETag, Last-Modified",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    Vary: "Origin",
};

const PASSTHROUGH_HEADERS = new Set([
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "expires",
    "last-modified",
    "etag",
    "content-encoding",
    "vary",
]);

function resolveUrl(line: string, base: URL): URL {
    try {
        return new URL(line);
    } catch {
        return new URL(line, base);
    }
}

function processM3u8Line(
    line: string,
    scrapeUrl: URL,
    originParam?: string
): string {
    if (line.length === 0) return "";

    if (line[0] === "#") {
        if (line.startsWith("#EXT-X-KEY")) {
            const uriStart = line.indexOf('URI="');
            if (uriStart !== -1) {
                const keyUriStart = uriStart + 5;
                const quotePos = line.indexOf('"', keyUriStart);
                if (quotePos !== -1) {
                    const keyUri = line.slice(keyUriStart, quotePos);
                    const resolved = resolveUrl(keyUri, scrapeUrl);
                    let q = `url=${encodeURIComponent(resolved.href)}`;
                    if (originParam) q += `&origin=${originParam}`;
                    return `${line.slice(0, keyUriStart)}/?${q}${line.slice(quotePos)}`;
                }
            }
            return line;
        }

        if (line.startsWith('#EXT-X-MAP:URI="')) {
            const innerUrl = line.slice(16, line.length - 1);
            const resolved = resolveUrl(innerUrl, scrapeUrl);
            let q = `url=${encodeURIComponent(resolved.href)}`;
            if (originParam) q += `&origin=${originParam}`;
            return `#EXT-X-MAP:URI="/?${q}"`;
        }

        if (line.length > 20 && (line.includes("URI=") || line.includes("URL="))) {
            const colonPos = line.indexOf(":");
            if (colonPos !== -1) {
                const prefix = line.slice(0, colonPos + 1);
                const attrs = line.slice(colonPos + 1);
                const rewrittenAttrs = attrs.split(",").map((attr) => {
                    const eqPos = attr.indexOf("=");
                    if (eqPos === -1) return attr;
                    const key = attr.slice(0, eqPos).trim();
                    const value = attr
                        .slice(eqPos + 1)
                        .trim()
                        .replace(/^"|"$/g, "");
                    if (key === "URI" || key === "URL") {
                        const resolved = resolveUrl(value, scrapeUrl);
                        let q = `url=${encodeURIComponent(resolved.href)}`;
                        if (originParam) q += `&origin=${originParam}`;
                        return `${key}="/?${q}"`;
                    }
                    return attr;
                });
                return prefix + rewrittenAttrs.join(",");
            }
        }

        return line;
    }

    const resolved = resolveUrl(line, scrapeUrl);
    let q = `url=${encodeURIComponent(resolved.href)}`;
    if (originParam) q += `&origin=${encodeURIComponent(originParam)}`;
    return `/?${q}`;
}

// ─── OPTIONS ──────────────────────────────────────────────────────────────────
app.options("*", (c) => c.body(null, 204, CORS_HEADERS));

// ─── Main proxy ───────────────────────────────────────────────────────────────
app.get("/", async (c) => {
    const targetUrlRaw = c.req.query("url");
    if (!targetUrlRaw) return c.text("Missing URL", 400, CORS_HEADERS);

    let targetUrl: URL;
    try {
        targetUrl = new URL(targetUrlRaw);
    } catch {
        return c.text(`Invalid URL: ${targetUrlRaw}`, 400, CORS_HEADERS);
    }

    const originParam = c.req.query("origin");
    const headersParam = c.req.query("headers");

    const upstreamHeaders = generateHeadersForUrl(targetUrl, originParam);

    if (headersParam) {
        try {
            const parsed = JSON.parse(headersParam) as Record<string, string>;
            for (const [k, v] of Object.entries(parsed)) {
                upstreamHeaders[k.toLowerCase()] = v;
            }
        } catch { /* ignore */ }
    }

    const clientHeaders = c.req.raw.headers;
    for (const h of ["range", "if-range", "if-none-match", "if-modified-since"]) {
        const val = clientHeaders.get(h);
        if (val) upstreamHeaders[h] = val;
    }

    let upstream: Response;
    try {
        upstream = await fetch(targetUrl.href, {
            headers: upstreamHeaders,
            redirect: "follow",
        });
    } catch (err) {
        console.error(`Failed to fetch ${targetUrl.href}:`, err);
        return c.text("Failed to fetch target URL", 502, CORS_HEADERS);
    }

    const contentType = (upstream.headers.get("content-type") ?? "").toLowerCase();
    const isM3u8ByContentType =
        contentType.includes("mpegurl") ||
        contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegurl");
    const isM3u8ByUrl = targetUrl.pathname.toLowerCase().endsWith(".m3u8");

    if (isM3u8ByContentType || isM3u8ByUrl) {
        const body = await upstream.text();
        const looksLikeM3u8 = body.trimStart().startsWith("#EXTM3U");

        if (isM3u8ByContentType || looksLikeM3u8) {
            const rewritten = body
                .split("\n")
                .map((line) => processM3u8Line(line.replace(/\r$/, ""), targetUrl, originParam))
                .join("\n");

            return c.body(rewritten, upstream.status as ContentfulStatusCode, {
                ...CORS_HEADERS,
                "Content-Type": "application/vnd.apple.mpegurl",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            });
        }

        const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
        for (const [name, value] of upstream.headers.entries()) {
            if (PASSTHROUGH_HEADERS.has(name.toLowerCase())) {
                responseHeaders[name] = value;
            }
        }
        return c.body(body, upstream.status as ContentfulStatusCode, responseHeaders);
    }

    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    for (const [name, value] of upstream.headers.entries()) {
        if (PASSTHROUGH_HEADERS.has(name.toLowerCase())) {
            responseHeaders[name] = value;
        }
    }

    return c.body(upstream.body as ReadableStream, upstream.status as ContentfulStatusCode, responseHeaders);
});

export default handle(app);
