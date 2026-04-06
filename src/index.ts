import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
    CORS_HEADERS,
    ALLOWED_ORIGINS,
    BLACKLIST_HEADERS,
    MEDIA_CACHE_CONTROL,
} from "./constants";
import { generateHeadersOriginal } from "./headers";
import { processM3u8Line, resolveUrl, buildProxyPath } from "./processor";

// ─── URL Encryption (XOR + base64url) ────────────────────────────────────────

const XOR_KEY = process.env.XOR_KEY ?? "";

function decryptUrl(encrypted: string): string | null {
    try {
        const b64 = encrypted.replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const key = new TextEncoder().encode(XOR_KEY);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i) ^ key[i % key.length];
        }
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

export function encryptUrl(url: string): string {
    const data = new TextEncoder().encode(url);
    const key = new TextEncoder().encode(XOR_KEY);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return btoa(String.fromCharCode(...result))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

const app = new Hono();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
    await next();
    const origin = c.req.header("origin");
    if (ALLOWED_ORIGINS.size === 0) {
        c.header("Access-Control-Allow-Origin", "*");
    } else if (origin && ALLOWED_ORIGINS.has(origin)) {
        c.header("Access-Control-Allow-Origin", origin);
    }
});

app.options("*", (c) => c.body(null, 204, CORS_HEADERS));

// ─── Root ────────────────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ status: "Online" }, 200, CORS_HEADERS));

// ─── Proxy ───────────────────────────────────────────────────────────────────
app.all("/proxy/:encrypted", async (c) => {
    const method = c.req.method;
    if (method !== "GET" && method !== "POST" && method !== "HEAD") return c.text("Method not allowed", 405, CORS_HEADERS);

    const targetUrlRaw = decryptUrl(c.req.param("encrypted"));
    if (!targetUrlRaw) return c.text("Invalid encrypted URL", 400, CORS_HEADERS);

    let targetUrl: URL;
    try { targetUrl = new URL(targetUrlRaw); } catch { return c.text(`Invalid URL: ${targetUrlRaw}`, 400, CORS_HEADERS); }

    const upstreamHeaders = generateHeadersOriginal(targetUrl);

    // Forward standard headers
    const clientHeaders = c.req.raw.headers;
    const rangeVal = clientHeaders.get("range");
    if (rangeVal) upstreamHeaders["range"] = rangeVal;
    const ifRangeVal = clientHeaders.get("if-range");
    if (ifRangeVal) upstreamHeaders["if-range"] = ifRangeVal;
    const ifNoneMatchVal = clientHeaders.get("if-none-match");
    if (ifNoneMatchVal) upstreamHeaders["if-none-match"] = ifNoneMatchVal;
    const ifModifiedVal = clientHeaders.get("if-modified-since");
    if (ifModifiedVal) upstreamHeaders["if-modified-since"] = ifModifiedVal;

    const headersParam = c.req.query("headers");
    if (headersParam) {
        try {
            const parsed = JSON.parse(headersParam);
            for (const [k, v] of Object.entries(parsed)) {
                const key = k.toLowerCase();
                if (key === "origin" || key === "referer") continue;
                upstreamHeaders[key] = String(v);
            }
        } catch { /* ignore */ }
    }

    let body: any = null;
    if (method === "POST") {
        const ctVal = clientHeaders.get("content-type");
        if (ctVal) upstreamHeaders["content-type"] = ctVal;
        body = await c.req.arrayBuffer();
    }

    let upstream: Response;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        upstream = await fetch(targetUrl.href, {
            method,
            headers: upstreamHeaders,
            body,
            redirect: "manual",
            // @ts-ignore
            tls: { rejectUnauthorized: false },
            signal: controller.signal,
        });
        clearTimeout(timeout);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return c.text(`Target Fetch Failed: ${errorMsg}`, 502, CORS_HEADERS);
    }

    // Handle 3xx Redirects
    if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("location");
        if (location) {
            const resolvedLocation = resolveUrl(location, targetUrl);
            return c.redirect(buildProxyPath(resolvedLocation, encryptUrl), upstream.status as any);
        }
    }

    const pathname = targetUrl.pathname;
    const dotIdx = pathname.lastIndexOf(".");
    const ext = dotIdx !== -1 ? pathname.slice(dotIdx + 1).toLowerCase() : "";
    const isMediaSegment = ext === "ts" || ext === "mp4" || ext === "m4s" || ext === "aac" || ext === "vtt" || ext === "webm";

    const responseHeaders: Record<string, string> = Object.assign({}, CORS_HEADERS);
    for (const [name, value] of upstream.headers.entries()) {
        if (!BLACKLIST_HEADERS.has(name)) { responseHeaders[name] = value; }
    }

    if (isMediaSegment) {
        responseHeaders["Cache-Control"] = MEDIA_CACHE_CONTROL;
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const isM3u8 = contentType.includes("mpegurl") || pathname.endsWith(".m3u8") || pathname.endsWith(".M3U8");

    if (isM3u8) {
        try {
            const textBody = await upstream.text();
            if (!textBody) {
                return c.body(null, upstream.status as ContentfulStatusCode, responseHeaders);
            }

            if (textBody.trimStart().startsWith("#EXTM3U")) {
                let rewritten = "";
                let start = 0;
                const len = textBody.length;
                while (start < len) {
                    let end = textBody.indexOf("\n", start);
                    if (end === -1) end = len;
                    const lineEnd = end > start && textBody[end - 1] === "\r" ? end - 1 : end;
                    if (rewritten.length > 0) rewritten += "\n";
                    rewritten += processM3u8Line(textBody.slice(start, lineEnd), targetUrl, encryptUrl);
                    start = end + 1;
                }

                return c.body(rewritten, upstream.status as ContentfulStatusCode, { ...responseHeaders, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache, no-store, must-revalidate" });
            }
            return c.body(textBody, upstream.status as ContentfulStatusCode, responseHeaders);
        } catch {
            return c.text("Manifest processing error", 500, CORS_HEADERS);
        }
    }

    return c.body(upstream.body as ReadableStream, upstream.status as ContentfulStatusCode, responseHeaders);
});

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`Proxy alive on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
