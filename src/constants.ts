/**
 * Global constants for CORS and Header management.
 * Safe, immutable, and backward‑compatible.
 */

// ── Default outgoing request headers ──────────── (smart era)
export const DEFAULT_HEADERS: Readonly<Record<string, string>> = Object.freeze({
    "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
    accept: "*/*",
    "accept-language": "en-US,en;q=0.5",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
});

// ── Allowed origins  ──────────────────────────────────────────────
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
    (process.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
);

// ── CORS response headers ───────────────────────────────────────────────────
export const CORS_HEADERS: Readonly<Record<string, string>> = Object.freeze({
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Range, X-Requested-With, Origin, Referer, Accept, Accept-Encoding, Accept-Language, Cache-Control, Pragma, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, Sec-Ch-Ua, Sec-Ch-Ua-Mobile, Sec-Ch-Ua-Platform, Connection",
    "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges, Content-Type, Cache-Control, Expires, Vary, ETag, Last-Modified",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    Vary: "Origin",
});

// ── Cache control for static media assets ───────────────────────────────────
export const MEDIA_CACHE_CONTROL =
    "public, max-age=31536000, s-maxage=31536000, immutable";

// ── Header forwarding policy ────────────────────────────────────────────────
// The original two sets are preserved exactly  they still work perfectly
// together: *forward* a header only if it is in PASSTHROUGH_HEADERS **and not**
// in BLACKLIST_HEADERS.

export const PASSTHROUGH_HEADERS: ReadonlySet<string> = new Set([
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "expires",
    "last-modified",
    "etag",
    "vary",
]);

export const BLACKLIST_HEADERS: ReadonlySet<string> = new Set([
    "alt-svc",
    "cf-cache-status",
    "cf-ray",
    "connection",
    "content-encoding",
    "content-length",
    "content-security-policy",
    "content-security-policy-report-only",
    "cross-origin-embedder-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "report-to",
    "server",
    "strict-transport-security",
    "transfer-encoding",
    "vary",
    "x-content-type-options",
    "x-frame-options",
    "x-runtime",
    "x-powered-by",
    "x-request-id",
    "x-xss-protection",
    "access-control-allow-origin",
    "access-control-allow-methods",
    "access-control-allow-headers",
    "access-control-expose-headers",
    "access-control-max-age",
    "access-control-allow-credentials",
]);

// ── Convenience single set ──────────────────────────────────────────────────
// This is `passthrough` minus `blacklist`, the actual headers that will be
// forwarded. No more double‑check needed
export const FORWARD_HEADERS: ReadonlySet<string> = (() => {
    const fwd = new Set(PASSTHROUGH_HEADERS);
    for (const h of BLACKLIST_HEADERS) fwd.delete(h);
    return fwd;
})();

/**
 * Apply the forwarding policy to a raw set of origin headers.
 * Returns a new object with only the headers that should be forwarded
 */
export function filterForwardHeaders(
    originHeaders: Record<string, string>
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(originHeaders)) {
        const lower = key.toLowerCase();
        if (FORWARD_HEADERS.has(lower)) {
            result[lower] = value;
        }
    }
    return result;
}
