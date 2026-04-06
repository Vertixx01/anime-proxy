import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
    CORS_HEADERS,
    ALLOWED_ORIGINS,
    BLACKLIST_HEADERS,
    MEDIA_CACHE_CONTROL,
} from "./constants";
import { generateHeadersOriginal } from "./headers";
import { buildProxyQuery, extractManifestDebug, processM3u8Line, resolveUrl } from "./processor";
import { handleDashboard, handleStatsFragment, handleStatusBadge, handleRequestsFragment, handleActiveFragment, handleDomainsFragment, formatUptime } from "./dashboard";
import { trackRequestStart, trackRequestEnd, getRecentRequests, getActiveConnections, getDomainBreakdown } from "./activity";

// ─── URL Decryption (XOR + base64url) ────────────────────────────────────────

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

// ─── Dynamic CORS Origin ─────────────────────────────────────────────────────
// Only origins listed in ALLOWED_ORIGINS env var get Access-Control-Allow-Origin.
// If ALLOWED_ORIGINS is empty, allow all origins (open mode).
app.use("*", async (c, next) => {
    await next();
    const origin = c.req.header("origin");
    if (ALLOWED_ORIGINS.size === 0) {
        c.header("Access-Control-Allow-Origin", "*");
    } else if (origin && ALLOWED_ORIGINS.has(origin)) {
        c.header("Access-Control-Allow-Origin", origin);
    }
});

// Global performance tracker
let requestCount = 0;
let totalResponseTime = 0;
const start_time = Date.now();
// Lightweight metrics — only track proxy requests (skip dashboard/static endpoints)
app.use("*", async (c, next) => {
    const rawUrl = c.req.query("url");
    const encUrl = c.req.query("u");
    if (!rawUrl && !encUrl) {
        await next();
        return;
    }
    const displayUrl = rawUrl ?? (encUrl ? (decryptUrl(encUrl) ?? encUrl) : "");
    const connId = trackRequestStart(displayUrl, c.req.method);
    const start = performance.now();
    await next();
    const latency = performance.now() - start;
    requestCount++;
    totalResponseTime += latency;
    trackRequestEnd(connId, c.res.status, latency);
});

// ─── Help & Info Endpoints (HTMX Enhanced) ────────────────────────────────────

// Dashboard and help handled within the main route to avoid shadowing proxy requests
app.get("/help", handleDashboard);

app.get("/api/stats", (c) => {
    const uptimeSeconds = Math.floor((Date.now() - start_time) / 1000);
    const avgLatency = requestCount > 0 ? (totalResponseTime / requestCount).toFixed(2) : "0";

    return c.html(handleStatsFragment({
        uptime: uptimeSeconds,
        requests: requestCount,
        latency: `${avgLatency}ms`
    }));
});

app.get("/api/status", (c) => {
    const isJson = c.req.header("Accept")?.includes("application/json");
    if (isJson) {
        return c.json({
            status: "Online",
            uptime: formatUptime(Math.floor((Date.now() - start_time) / 1000)),
            latency: requestCount > 0 ? (totalResponseTime / requestCount).toFixed(2) + "ms" : "N/A",
            message: "FAST ASF"
        }, 200, CORS_HEADERS);
    }
    return c.html(handleStatusBadge("FAST ASF"));
});

// ─── Live Activity Endpoints ─────────────────────────────────────────────────

app.get("/api/activity/requests", (c) => {
    return c.html(handleRequestsFragment(getRecentRequests()));
});

app.get("/api/activity/active", (c) => {
    return c.html(handleActiveFragment(getActiveConnections()));
});

app.get("/api/activity/domains", (c) => {
    return c.html(handleDomainsFragment(getDomainBreakdown()));
});

app.get("/api/info", (c) => {
    const uptimeSeconds = Math.floor((Date.now() - start_time) / 1000);
    const avgLatency = requestCount > 0 ? (totalResponseTime / requestCount).toFixed(2) : "0";

    return c.json({
        name: "Anime Proxy",
        version: "1.2.0",
        description: "Industrial-grade unified proxy for Railway/Bun.",
        uptime: formatUptime(uptimeSeconds),
        requests: requestCount,
        avg_latency: `${avgLatency}ms`,
        runtime: "Bun",
        status: "Online",
        performance: "Extreme",
        endpoints: {
            proxy: {
                path: "/*",
                method: "ALL",
                description: "Main proxy route. Expects 'url' parameter.",
                status: "Operational"
            },
            help: {
                path: "/help",
                method: "GET",
                description: "Interactive dashboard and statistics dashboard.",
                status: "Operational"
            },
            debug_manifest: {
                path: "/api/debug-manifest",
                method: "GET",
                description: "Analyse M3U8 manifest structure and debug segments.",
                status: "Operational"
            },
            stats: {
                path: "/api/stats",
                method: "GET",
                description: "Real-time performance metrics (HTMX fragment).",
                status: "Operational"
            },
            status: {
                path: "/api/status",
                method: "GET",
                description: "Live status badge generation.",
                status: "Operational"
            }
        }
    }, 200, CORS_HEADERS);
});

// ─── Options Preflight ────────────────────────────────────────────────────────

app.options("*", (c) => c.body(null, 204, CORS_HEADERS));

app.get("/api/debug-manifest", async (c) => {
    const targetUrlRaw = c.req.query("url");
    if (!targetUrlRaw) {
        return c.json({ error: "Missing url parameter" }, 400, CORS_HEADERS);
    }

    let targetUrl: URL;
    try {
        targetUrl = new URL(targetUrlRaw);
    } catch {
        return c.json({ error: "Invalid url parameter" }, 400, CORS_HEADERS);
    }

    const upstreamHeaders = generateHeadersOriginal(targetUrl);

    try {
        const upstream = await fetch(targetUrl.href, {
            headers: upstreamHeaders,
            redirect: "manual",
            // @ts-ignore
            tls: { rejectUnauthorized: false },
        });
        const contentType = upstream.headers.get("content-type") ?? "";
        const textBody = await upstream.text();

        return c.json({
            upstreamUrl: targetUrl.href,
            contentType,
            status: upstream.status,
            ...extractManifestDebug(textBody),
        }, 200, CORS_HEADERS);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return c.json({ error: errorMsg }, 502, CORS_HEADERS);
    }
});

// ─── Unified Proxy Routine ────────────────────────────────────────────────────

app.all("*", async (c) => {
    const method = c.req.method;
    if (method !== "GET" && method !== "POST" && method !== "HEAD") return c.text("Method not allowed", 405, CORS_HEADERS);

    const targetUrlRaw = c.req.query("url") ?? (c.req.query("u") ? decryptUrl(c.req.query("u")!) : null);
    const dashboardParam = c.req.query("dashboard");

    // Explicit dashboard request
    if (dashboardParam === "true" || dashboardParam === "1") {
        return handleDashboard(c);
    }

    // Handle dashboard / info at root
    if (!targetUrlRaw) {
        const path = c.req.path;

        // Relative redirection recovery
        const lastHost = getCookie(c, "_last_requested");
        if (lastHost && path !== "/" && path !== "/api" && path !== "/api/") {
            const remainingPath = path.startsWith("/api") ? path.slice(4) : path;
            const redirectTarget = new URL(lastHost + (remainingPath.startsWith("/") ? "" : "/") + remainingPath);
            const redirectUrl = `/?${buildProxyQuery(redirectTarget, c.req.query("debug") === "1")}`;
            return c.redirect(redirectUrl);
        }

        // Root — return comprehensive API info (requires ?pwd= if DASHBOARD_PWD is set)
        if (path === "/" || path === "/api" || path === "/api/") {
            const dashPwd = process.env.DASHBOARD_PWD;
            if (dashPwd && c.req.query("pwd") !== dashPwd) {
                return c.json({ status: "Online" }, 200, CORS_HEADERS);
            }

            const uptimeSeconds = Math.floor((Date.now() - start_time) / 1000);
            const avgLatency = requestCount > 0 ? (totalResponseTime / requestCount).toFixed(2) + "ms" : "0ms";

            return c.json({
                name: "Anime Proxy",
                version: "1.2.0",
                status: "Online",
                runtime: "Bun",
                performance: {
                    uptime: formatUptime(uptimeSeconds),
                    requests_served: requestCount,
                    avg_latency: avgLatency,
                },
                endpoints: {
                    proxy: {
                        path: "/?url=<ENCODED_URL>",
                        method: "GET | POST | HEAD",
                        description: "Main proxy route. Fetches the target URL and streams the response through the proxy with correct headers.",
                        status: "Operational",
                        parameters: {
                            url: { required: true, description: "The full target URL to proxy (URL-encoded)." },
                            u: { required: false, description: "Encrypted target URL (XOR + base64url). Alternative to 'url'." },
                            headers: { required: false, description: "JSON object of custom headers to send upstream. Origin/Referer cannot be overridden." },
                            json: { required: false, description: "JSON body for POST requests. Sets Content-Type to application/json." },
                            debug: { required: false, description: "Set to '1' to attach debug headers (X-Proxy-Debug-*) on M3U8 responses." },
                            dashboard: { required: false, description: "Set to 'true' or '1' to force the interactive dashboard UI." },
                        },
                    },
                    help: {
                        path: "/help",
                        method: "GET",
                        description: "Interactive dashboard with live stats, proxy search, and API explorer.",
                        status: "Operational",
                    },
                    debug_manifest: {
                        path: "/api/debug-manifest?url=<ENCODED_M3U8_URL>",
                        method: "GET",
                        description: "Fetches an M3U8 manifest and returns parsed metadata: variant count, codecs, line count, and preview.",
                        status: "Operational",
                        parameters: {
                            url: { required: true, description: "The M3U8 manifest URL to analyse." },
                        },
                    },
                    info: {
                        path: "/api/info",
                        method: "GET",
                        description: "Lightweight service metadata and live performance metrics.",
                        status: "Operational",
                    },
                    stats: {
                        path: "/api/stats",
                        method: "GET",
                        description: "Real-time performance metrics returned as an HTMX HTML fragment.",
                        status: "Operational",
                    },
                    status_badge: {
                        path: "/api/status",
                        method: "GET",
                        description: "Live status badge. Returns HTML by default, or JSON when Accept: application/json is set.",
                        status: "Operational",
                    },
                },
                usage: {
                    basic_proxy: "GET /?url=https://example.com/video.m3u8",
                    encrypted_proxy: "GET /?u=<XOR_ENCRYPTED_BASE64URL>",
                    post_with_json: "POST /?url=https://api.example.com/endpoint&json={\"key\":\"value\"}",
                    custom_headers: "GET /?url=https://example.com/video.m3u8&headers={\"x-custom\":\"value\"}",
                    debug_mode: "GET /?url=https://example.com/master.m3u8&debug=1",
                    manifest_debug: "GET /api/debug-manifest?url=https://example.com/master.m3u8",
                },
                features: [
                    "M3U8 manifest rewriting with full URI/URL attribute support",
                    "Automatic domain-based Origin/Referer header steering (40+ domain groups)",
                    "XOR + base64url encrypted URL support via ?u= parameter",
                    "3xx redirect following with proxy URL rewriting",
                    "Relative path recovery via _last_requested cookie",
                    "Range request passthrough for partial content",
                    "15s upstream timeout with AbortController",
                    "Media segment caching (immutable Cache-Control)",
                    "CORS headers on all responses",
                    "POST body forwarding with JSON shorthand",
                ],
                notes: {
                    cors: "All responses include permissive CORS headers (Access-Control-Allow-Origin: *).",
                    headers: "Origin and Referer are automatically set based on the target domain. Custom header overrides for these two are blocked.",
                    m3u8: "M3U8 manifests are rewritten so all segment and variant URLs route back through the proxy.",
                    encryption: "When XOR_KEY is configured, M3U8 segment URLs are encrypted with ?u= instead of ?url=.",
                    caching: "Media segments (.ts, .mp4, .m4s, .aac, .vtt, .webm) get immutable cache headers. Manifests are no-cache.",
                },
            }, 200, CORS_HEADERS);
        }

        return c.text("Missing URL parameter. Usage: /?url=<ENCODED_URL>", 400, CORS_HEADERS);
    }

    let targetUrl: URL;
    try { targetUrl = new URL(targetUrlRaw); } catch { return c.text(`Invalid URL: ${targetUrlRaw}`, 400, CORS_HEADERS); }

    const debugEnabled = c.req.query("debug") === "1";

    const upstreamHeaders = generateHeadersOriginal(targetUrl);

    // Forward Range and standard headers
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
                // Never let the client override origin/referer — domain group logic owns those
                if (key === "origin" || key === "referer") continue;
                upstreamHeaders[key] = String(v);
            }
        } catch { /* ignore */ }
    }

    let body: any = null;
    if (method === "POST") {
        const jsonParam = c.req.query("json");
        if (jsonParam) {
            body = jsonParam;
            upstreamHeaders["content-type"] = "application/json";
        } else {
            const ctVal = clientHeaders.get("content-type");
            if (ctVal) upstreamHeaders["content-type"] = ctVal;
            body = await c.req.arrayBuffer();
        }
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
        console.error(`[Proxy Error] Failed to fetch ${targetUrl.href}:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        return c.text(`Target Fetch Failed: ${errorMsg}`, 502, CORS_HEADERS);
    }

    // Handle 3xx Redirects before any other work
    if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get("location");
        if (location) {
            const resolvedLocation = resolveUrl(location, targetUrl);
            const q = buildProxyQuery(resolvedLocation, debugEnabled, XOR_KEY ? encryptUrl : undefined);
            return c.redirect(`/?${q}`, upstream.status as any);
        }
    }

    // Set cookie for relative redirection recovery (only needed for manifest/html responses, skip segments)
    const pathname = targetUrl.pathname;
    const dotIdx = pathname.lastIndexOf(".");
    const ext = dotIdx !== -1 ? pathname.slice(dotIdx + 1).toLowerCase() : "";
    const isMediaSegment = ext === "ts" || ext === "mp4" || ext === "m4s" || ext === "aac" || ext === "vtt" || ext === "webm";

    if (!isMediaSegment) {
        const urlBase = `${targetUrl.protocol}//${targetUrl.host}${pathname.substring(0, pathname.lastIndexOf("/"))}`;
        setCookie(c, "_last_requested", urlBase, { maxAge: 3600, httpOnly: true, path: "/", sameSite: "Lax" });
    }

    const responseHeaders: Record<string, string> = Object.assign({}, CORS_HEADERS);
    for (const [name, value] of upstream.headers.entries()) {
        // Header names from fetch are already lowercase in Bun — skip redundant .toLowerCase()
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
                const debugInfo = debugEnabled ? extractManifestDebug(textBody) : null;

                // Build rewritten manifest in one pass without intermediate array
                let rewritten = "";
                let start = 0;
                const len = textBody.length;
                while (start < len) {
                    let end = textBody.indexOf("\n", start);
                    if (end === -1) end = len;
                    const lineEnd = end > start && textBody[end - 1] === "\r" ? end - 1 : end;
                    if (rewritten.length > 0) rewritten += "\n";
                    rewritten += processM3u8Line(textBody.slice(start, lineEnd), targetUrl, undefined, debugEnabled, XOR_KEY ? encryptUrl : undefined);
                    start = end + 1;
                }

                if (debugEnabled && debugInfo) {
                    responseHeaders["X-Proxy-Debug-Upstream"] = targetUrl.href.slice(0, 200);
                    responseHeaders["X-Proxy-Debug-Variants"] = String(debugInfo.variantCount);
                    responseHeaders["X-Proxy-Debug-Codecs"] = debugInfo.codecs.join(" | ").slice(0, 200);
                }
                return c.body(rewritten, upstream.status as ContentfulStatusCode, { ...responseHeaders, "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "no-cache, no-store, must-revalidate" });
            }
            // If it claimed to be m3u8 but isn't, return as is
            return c.body(textBody, upstream.status as ContentfulStatusCode, responseHeaders);
        } catch (err) {
            console.error(`[Proxy Error] M3U8 split/process failed:`, err);
            return c.text("Manifest processing error", 500, CORS_HEADERS);
        }
    }

    return c.body(upstream.body as ReadableStream, upstream.status as ContentfulStatusCode, responseHeaders);
});

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`🚀 Proxy alive on http://localhost:${port}`);

export default {
    port,
    fetch: app.fetch,
};
