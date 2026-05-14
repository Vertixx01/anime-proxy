import {
    MANIFEST_CACHE_CONTROL,
    MEDIA_CACHE_CONTROL,
} from "./constants.js";

type CacheKind = "manifest" | "segment";

export interface ByteCacheEntry {
    body: ArrayBuffer;
    byteLength: number;
    createdAt: number;
    expiresAt: number;
    headers: Record<string, string>;
    status: number;
}

interface CacheOptions {
    ttlMs: number;
    maxBytes: number;
    maxEntryBytes: number;
}

const DEFAULT_SEGMENT_TTL_MS = readDurationEnv("SEGMENT_CACHE_TTL_SECONDS", 24 * 60 * 60) * 1000;
const DEFAULT_MANIFEST_TTL_MS = readDurationEnv("MANIFEST_CACHE_TTL_SECONDS", 15) * 1000;
const DEFAULT_MAX_BYTES = readBytesEnv("PROXY_CACHE_MAX_BYTES", 512 * 1024 * 1024);
const DEFAULT_MAX_ENTRY_BYTES = readBytesEnv("PROXY_CACHE_MAX_ENTRY_BYTES", 128 * 1024 * 1024);

const cache = new Map<string, ByteCacheEntry>();
let currentBytes = 0;

function readDurationEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBytesEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function stableHeadersForKey(headers: Record<string, string>): string {
    return Object.keys(headers)
        .sort()
        .map((key) => `${key}:${headers[key]}`)
        .join("\n");
}

function hashString(value: string): string {
    let hash = 5381;
    for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    return (hash >>> 0).toString(36);
}

function setHeader(headers: Record<string, string>, name: string, value: string) {
    delete headers[name.toLowerCase()];
    delete headers[name];
    headers[name] = value;
}

export function buildCacheKey(
    kind: CacheKind,
    targetUrl: URL,
    upstreamHeaders: Record<string, string>,
    extra = "",
): string {
    return `${kind}:${hashString(targetUrl.href)}:${hashString(stableHeadersForKey(upstreamHeaders))}:${hashString(extra)}`;
}

function touch(key: string, entry: ByteCacheEntry) {
    cache.delete(key);
    cache.set(key, entry);
}

function deleteEntry(key: string, entry: ByteCacheEntry) {
    cache.delete(key);
    currentBytes -= entry.byteLength;
    if (currentBytes < 0) currentBytes = 0;
}

function trimCache(maxBytes: number) {
    while (currentBytes > maxBytes) {
        const first = cache.entries().next().value as [string, ByteCacheEntry] | undefined;
        if (!first) break;
        deleteEntry(first[0], first[1]);
    }
}

export function getByteCache(key: string): ByteCacheEntry | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        deleteEntry(key, entry);
        return null;
    }
    touch(key, entry);
    return entry;
}

export function putByteCache(key: string, entry: ByteCacheEntry, maxBytes = DEFAULT_MAX_BYTES) {
    const previous = cache.get(key);
    if (previous) deleteEntry(key, previous);
    cache.set(key, entry);
    currentBytes += entry.byteLength;
    trimCache(maxBytes);
}

export function cacheOptions(kind: CacheKind, manifestText?: string): CacheOptions {
    if (kind === "manifest") {
        const hasEndList = manifestText?.includes("#EXT-X-ENDLIST") ?? false;
        const ttlMs = hasEndList
            ? Math.max(DEFAULT_MANIFEST_TTL_MS, 60 * 60 * 1000)
            : DEFAULT_MANIFEST_TTL_MS;
        return { ttlMs, maxBytes: DEFAULT_MAX_BYTES, maxEntryBytes: Math.min(DEFAULT_MAX_ENTRY_BYTES, 8 * 1024 * 1024) };
    }
    return { ttlMs: DEFAULT_SEGMENT_TTL_MS, maxBytes: DEFAULT_MAX_BYTES, maxEntryBytes: DEFAULT_MAX_ENTRY_BYTES };
}

function parseRange(rangeHeader: string, byteLength: number): { start: number; end: number } | null {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) return null;

    let start: number;
    let end: number;
    if (match[1] === "" && match[2] === "") return null;
    if (match[1] === "") {
        const suffixLength = Number(match[2]);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(byteLength - suffixLength, 0);
        end = byteLength - 1;
    } else {
        start = Number(match[1]);
        end = match[2] === "" ? byteLength - 1 : Number(match[2]);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= byteLength || end < start) {
        return null;
    }
    return { start, end: Math.min(end, byteLength - 1) };
}

export function responseFromByteCache(
    entry: ByteCacheEntry,
    method: string,
    rangeHeader?: string | null,
    cacheStatus = "HIT",
): { body: ArrayBuffer | null; status: number; headers: Record<string, string> } {
    const headers = { ...entry.headers };
    headers["X-Proxy-Cache"] = cacheStatus;
    headers["Age"] = String(Math.max(0, Math.floor((Date.now() - entry.createdAt) / 1000)));

    if (rangeHeader) {
        const range = parseRange(rangeHeader, entry.byteLength);
        if (range) {
            const body = method === "HEAD" ? null : entry.body.slice(range.start, range.end + 1);
            setHeader(headers, "Content-Range", `bytes ${range.start}-${range.end}/${entry.byteLength}`);
            setHeader(headers, "Content-Length", String(range.end - range.start + 1));
            setHeader(headers, "Accept-Ranges", "bytes");
            return { body, status: 206, headers };
        }
        setHeader(headers, "Content-Range", `bytes */${entry.byteLength}`);
        setHeader(headers, "Content-Length", "0");
        return { body: null, status: 416, headers };
    }

    setHeader(headers, "Content-Length", String(entry.byteLength));
    const body = method === "HEAD" ? null : entry.body;
    return { body, status: entry.status, headers };
}

export async function cacheResponseBody(
    key: string,
    response: Response,
    responseHeaders: Record<string, string>,
    kind: CacheKind,
    manifestText?: string,
): Promise<ByteCacheEntry | null> {
    if (response.status !== 200) return null;

    const options = cacheOptions(kind, manifestText);
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > options.maxEntryBytes) return null;

    const body = manifestText === undefined
        ? await response.arrayBuffer()
        : new TextEncoder().encode(manifestText).buffer as ArrayBuffer;

    const headers = { ...responseHeaders };
    setHeader(headers, "Cache-Control", kind === "segment" ? MEDIA_CACHE_CONTROL : MANIFEST_CACHE_CONTROL);
    setHeader(headers, "Accept-Ranges", "bytes");
    setHeader(headers, "X-Proxy-Cache", body.byteLength > options.maxEntryBytes ? "BYPASS" : "MISS");

    const entry: ByteCacheEntry = {
        body,
        byteLength: body.byteLength,
        createdAt: Date.now(),
        expiresAt: Date.now() + options.ttlMs,
        headers,
        status: response.status,
    };
    if (body.byteLength <= options.maxEntryBytes) putByteCache(key, entry, options.maxBytes);
    return entry;
}
