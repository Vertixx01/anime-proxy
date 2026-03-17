import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { generateHeadersForUrl } from "./templates";

const app = new Hono();

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

// Headers we forward from the upstream response
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve a possibly-relative URL against a base URL. */
function resolveUrl(line: string, base: URL): URL {
    try {
        return new URL(line);
    } catch {
        return new URL(line, base);
    }
}

/**
 * Rewrite a single M3U8 line so that all referenced URLs go through the proxy.
 * This is a faithful port of the Rust `process_m3u8_line` function.
 */
function processM3u8Line(
    line: string,
    scrapeUrl: URL,
    originParam?: string
): string {
    if (line.length === 0) return "";

    // ── Comment / tag lines ──────────────────────────────────────────────
    if (line[0] === "#") {
        // #EXT-X-KEY — rewrite the URI="" value
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

        // #EXT-X-MAP:URI="..."
        if (line.startsWith('#EXT-X-MAP:URI="')) {
            const innerUrl = line.slice(16, line.length - 1);
            const resolved = resolveUrl(innerUrl, scrapeUrl);
            let q = `url=${encodeURIComponent(resolved.href)}`;
            if (originParam) q += `&origin=${originParam}`;
            return `#EXT-X-MAP:URI="/?${q}"`;
        }

        // Generic tags with URI= or URL= attributes
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

    // ── URL lines (segments, variant playlists) ──────────────────────────
    const resolved = resolveUrl(line, scrapeUrl);
    let q = `url=${encodeURIComponent(resolved.href)}`;
    if (originParam) q += `&origin=${encodeURIComponent(originParam)}`;
    return `/?${q}`;
}

// ─── Watch Order Helpers ───────────────────────────────────────────────────────

async function getMalIdFromAnilistId(anilistId: number): Promise<number | null> {
    const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        idMal
      }
    }
    `;
    try {
        const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                query,
                variables: { id: anilistId },
            }),
        });
        const data = await response.json();
        return data?.data?.Media?.idMal || null;
    } catch (err) {
        console.error("AniList API error:", err);
        return null;
    }
}

async function scrapeWatchOrder(malId: number) {
    const url = `https://chiaki.site/?/tools/watch_order/id/${malId}`;
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) return null;
        const html = await response.text();

        const entries: any[] = [];
        const trRegex = /<tr[^>]+data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
        let match;

        while ((match = trRegex.exec(html)) !== null) {
            const trTag = match[0];
            const content = match[2];

            const idAttr = trTag.match(/data-id="(\d+)"/);
            const typeAttr = trTag.match(/data-type="(\d+)"/);
            const epsAttr = trTag.match(/data-eps="(\d+)"/);
            const anilistIdAttr = trTag.match(/data-anilist-id="(\d*)"/);

            if (!idAttr || !typeAttr) continue;

            const type = parseInt(typeAttr[1]);
            if (type !== 1 && type !== 3) continue;

            const titleMatch = content.match(/<span class="wo_title">([\s\S]*?)<\/span>/);
            const secondaryTitleMatch = content.match(/<span class="uk-text-small">([\s\S]*?)<\/span>/);
            const imageMatch = content.match(/style="background-image:url\('([^']+)'\)"/);
            const metaMatch = content.match(/<span class="wo_meta">([\s\S]*?)<\/span>/);
            const ratingMatch = content.match(/<span class="wo_rating">([\s\S]*?)<\/span>/);

            const metaRaw = metaMatch ? metaMatch[1].replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() : "";
            const parts = metaRaw.split('|').map(p => p.trim()).filter(p => p && !p.includes('★'));

            let episodesCount = null;
            let duration = null;
            const epInfo = parts[2] || "";
            if (epInfo.includes('×')) {
                const [e, d] = epInfo.split('×').map(s => s.trim());
                episodesCount = e;
                duration = d;
            } else if (epInfo) {
                duration = epInfo;
            }

            entries.push({
                malId: parseInt(idAttr[1]),
                anilistId: anilistIdAttr && anilistIdAttr[1] ? parseInt(anilistIdAttr[1]) : null,
                title: titleMatch ? titleMatch[1].trim() : "Unknown",
                secondaryTitle: secondaryTitleMatch ? secondaryTitleMatch[1].trim() : null,
                type: type === 1 ? "TV" : "Movie",
                episodes: epsAttr ? parseInt(epsAttr[1]) : 0,
                image: imageMatch ? `https://chiaki.site/${imageMatch[1]}` : null,
                metadata: {
                    date: parts[0] || null,
                    type: parts[1] || null,
                    episodes: episodesCount,
                    duration: duration
                },
                rating: ratingMatch ? ratingMatch[1].trim() : null
            });
        }

        return entries;
    } catch (err) {
        console.error("Scraping error:", err);
        return null;
    }
}

// ─── OPTIONS handler ──────────────────────────────────────────────────────────
app.options("*", (c) => {
    return c.body(null, 204, CORS_HEADERS);
});

// ─── Main proxy handler ───────────────────────────────────────────────────────
app.get("/", async (c) => {
    // ── Parse query params ──────────────────────────────────────────────
    const targetUrlRaw = c.req.query("url");
    if (!targetUrlRaw) {
        return c.text("Missing URL", 400, CORS_HEADERS);
    }

    let targetUrl: URL;
    try {
        targetUrl = new URL(targetUrlRaw);
    } catch {
        return c.text(`Invalid URL: ${targetUrlRaw}`, 400, CORS_HEADERS);
    }

    const originParam = c.req.query("origin");
    const headersParam = c.req.query("headers");

    // ── Build upstream request headers ──────────────────────────────────
    const upstreamHeaders = generateHeadersForUrl(targetUrl, originParam);

    // Custom headers from query
    if (headersParam) {
        try {
            const parsed = JSON.parse(headersParam) as Record<string, string>;
            for (const [k, v] of Object.entries(parsed)) {
                upstreamHeaders[k.toLowerCase()] = v;
            }
        } catch {
            /* ignore invalid JSON */
        }
    }

    // Forward important client headers
    const clientHeaders = c.req.raw.headers;
    for (const h of ["range", "if-range", "if-none-match", "if-modified-since"]) {
        const val = clientHeaders.get(h);
        if (val) upstreamHeaders[h] = val;
    }

    // ── Fetch upstream ──────────────────────────────────────────────────
    let upstream: Response;
    try {
        upstream = await fetch(targetUrl.href, {
            headers: upstreamHeaders,
            redirect: "follow",
            // @ts-ignore — Bun supports this
            tls: { rejectUnauthorized: false },
        });
    } catch (err) {
        console.error(`Failed to fetch ${targetUrl.href}:`, err);
        return c.text("Failed to fetch target URL", 502, CORS_HEADERS);
    }

    const contentType = (
        upstream.headers.get("content-type") ?? ""
    ).toLowerCase();
    const isM3u8ByContentType =
        contentType.includes("mpegurl") ||
        contentType.includes("application/vnd.apple.mpegurl") ||
        contentType.includes("application/x-mpegurl");
    const isM3u8ByUrl = targetUrl.pathname.toLowerCase().endsWith(".m3u8");

    // ── M3U8 rewriting path ─────────────────────────────────────────────
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

        // Not actually M3U8 despite the URL — fall through to passthrough
        const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
        for (const [name, value] of upstream.headers.entries()) {
            if (PASSTHROUGH_HEADERS.has(name.toLowerCase())) {
                responseHeaders[name] = value;
            }
        }
        return c.body(body, upstream.status as ContentfulStatusCode, responseHeaders);
    }

    // ── Passthrough (binary segments, keys, etc.) ───────────────────────
    const responseHeaders: Record<string, string> = { ...CORS_HEADERS };
    for (const [name, value] of upstream.headers.entries()) {
        if (PASSTHROUGH_HEADERS.has(name.toLowerCase())) {
            responseHeaders[name] = value;
        }
    }

    // Force cache media segments on Vercel Edge to heavily reduce Fast Origin Transfer
    // Since these are video segments, they are immutable and can be cached long-term.
    responseHeaders["Cache-Control"] = "public, max-age=31536000, s-maxage=31536000, immutable";

    // Stream the body through directly for maximum performance
    return c.body(upstream.body as ReadableStream, upstream.status as ContentfulStatusCode, responseHeaders);
});

app.get("/api/watch-order", async (c) => {
    const anilistIdRaw = c.req.query("id");
    if (!anilistIdRaw) {
        return c.json({ error: "Missing anilistId parameter" }, 400, CORS_HEADERS);
    }

    const anilistId = parseInt(anilistIdRaw);
    if (isNaN(anilistId)) {
        return c.json({ error: "Invalid anilistId" }, 400, CORS_HEADERS);
    }

    const malId = await getMalIdFromAnilistId(anilistId);
    if (!malId) {
        return c.json({ error: "Could not find MAL ID for this AniList ID" }, 404, CORS_HEADERS);
    }

    const watchOrder = await scrapeWatchOrder(malId);
    if (!watchOrder) {
        return c.json({ error: "Failed to fetch watch order data" }, 502, CORS_HEADERS);
    }

    return c.json(watchOrder, 200, {
        ...CORS_HEADERS,
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    });
});

// ── Local dev server (Bun) ────────────────────────────────────────────────────
const port = parseInt(process.env.PORT || "8080", 10);
console.log(`🚀 Proxy alive on http://0.0.0.0:${port}`);

export default {
    port,
    hostname: "0.0.0.0",
    fetch: app.fetch,
};
