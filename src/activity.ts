// ─── Live Activity Tracking ──────────────────────────────────────────────────
// Bounded in-memory data structures for real-time dashboard.

export interface RequestLogEntry {
    id: number;
    url: string;
    hostname: string;
    method: string;
    status: number;
    latency: number;         // ms
    timestamp: number;       // wall clock
}

export interface ActiveConnection {
    id: number;
    url: string;
    hostname: string;
    method: string;
    startTime: number;       // DOMHighResTimeStamp (performance.now())
}

// ─── Circular Buffer ─────

const LOG_CAPACITY = 50;
const logBuffer: (RequestLogEntry | null)[] = new Array(LOG_CAPACITY).fill(null);
let logHead = 0;
let logCount = 0;

// Wrapping ID counter  stays within safe integer range for indefinite runs
let nextId = 1; // 1‑based
function generateId(): number {
    const id = nextId;
    // Wrap around to 1 after Number.MAX_SAFE_INTEGER (nearly 2^53)
    nextId = (nextId % Number.MAX_SAFE_INTEGER) + 1;
    return id;
}

function pushLog(entry: RequestLogEntry) {
    logBuffer[logHead] = entry;
    logHead = (logHead + 1) % LOG_CAPACITY;
    if (logCount < LOG_CAPACITY) logCount++;
}

export function getRecentRequests(): RequestLogEntry[] {
    const result: RequestLogEntry[] = [];
    for (let i = 0; i < logCount; i++) {
        const idx = (logHead - 1 - i + LOG_CAPACITY) % LOG_CAPACITY;
        const entry = logBuffer[idx];
        if (entry) result.push(entry);
    }
    return result;
}

// ─── Active Connections ────

const activeConnections = new Map<number, ActiveConnection>();
const STALE_TIMEOUT_MS = 30_000;

// hostname extraction using the native URL parser
function extractHostname(url: string): string {
    try {
        return new URL(url).hostname || "unknown";
    } catch {
        return "unknown";
    }
}

export function trackRequestStart(url: string, method: string): number {
    const id = generateId();
    const hostname = extractHostname(url);

    activeConnections.set(id, {
        id,
        url: url.length > 100 ? url.slice(0, 97) + "..." : url,
        hostname,
        method,
        startTime: performance.now(), // monotonic, high-resolution (peak)
    });
    return id;
}

// Latency is now calculated
export function trackRequestEnd(connId: number, status: number) {
    const conn = activeConnections.get(connId);
    activeConnections.delete(connId);

    if (conn) {
        const latency = performance.now() - conn.startTime; // monotonic (cuz yes)
        pushLog({
            id: conn.id,
            url: conn.url,
            hostname: conn.hostname,
            method: conn.method,
            status,
            latency: Math.round(latency * 100) / 100,
            timestamp: Date.now(),
        });
        incrementDomain(conn.hostname);
    }
}

export function getActiveConnections(): (ActiveConnection & { elapsed: number })[] {
    const now = performance.now();

    // Clean up connections that were never closed (prevents memory leak)
    for (const [id, conn] of activeConnections) {
        if (now - conn.startTime > STALE_TIMEOUT_MS) {
            activeConnections.delete(id);
        }
    }

    return Array.from(activeConnections.values()).map((c) => ({
        ...c,
        elapsed: now - c.startTime,
    }));
}

// ─── Domain Breakdown ────

const DOMAIN_CAP = 200;
const domainCounts = new Map<string, number>();
let totalDomainHits = 0;

function incrementDomain(hostname: string) {
    totalDomainHits++;
    const current = domainCounts.get(hostname);
    domainCounts.set(hostname, (current ?? 0) + 1);

    // Simple LFU eviction adequate for dashboard telemetry (200‑entry cap)
    if (!current && domainCounts.size > DOMAIN_CAP) {
        let minKey = "";
        let minVal = Infinity;
        for (const [k, v] of domainCounts) {
            if (v < minVal) {
                minVal = v;
                minKey = k;
            }
        }
        if (minKey) domainCounts.delete(minKey);
    }
}

// Sorting O(n log n) – negligible at 200 domains if cap grows swap to a heap
export function getDomainBreakdown(limit = 10): { hostname: string; count: number; percent: number }[] {
    const entries = Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    const total = totalDomainHits || 1;
    return entries.map(([hostname, count]) => ({
        hostname,
        count,
        percent: Math.round((count / total) * 100),
    }));
            }
