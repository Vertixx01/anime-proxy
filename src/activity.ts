// ─── Live Activity Tracking ──────────────────────────────────────────────────
// Bounded in-memory data structures for real-time dashboard.

export interface RequestLogEntry {
    id: number;
    url: string;
    hostname: string;
    method: string;
    status: number;
    latency: number;
    timestamp: number;
}

export interface ActiveConnection {
    id: number;
    url: string;
    hostname: string;
    method: string;
    startTime: number;
}

// ─── Circular Buffer ─────────────────────────────────────────────────────────

const LOG_CAPACITY = 50;
const logBuffer: (RequestLogEntry | null)[] = new Array(LOG_CAPACITY).fill(null);
let logHead = 0;  // next write position
let logCount = 0;
let nextId = 1;

function pushLog(entry: RequestLogEntry) {
    logBuffer[logHead] = entry;
    logHead = (logHead + 1) % LOG_CAPACITY;
    if (logCount < LOG_CAPACITY) logCount++;
}

export function getRecentRequests(): RequestLogEntry[] {
    const result: RequestLogEntry[] = [];
    // Read from newest to oldest
    for (let i = 0; i < logCount; i++) {
        const idx = (logHead - 1 - i + LOG_CAPACITY) % LOG_CAPACITY;
        const entry = logBuffer[idx];
        if (entry) result.push(entry);
    }
    return result;
}

// ─── Active Connections ──────────────────────────────────────────────────────

const activeConnections = new Map<number, ActiveConnection>();

export function trackRequestStart(url: string, method: string): number {
    const id = nextId++;
    // Extract hostname cheaply without full URL parse
    let hostname = "unknown";
    const protoEnd = url.indexOf("://");
    if (protoEnd !== -1) {
        const hostStart = protoEnd + 3;
        let hostEnd = url.indexOf("/", hostStart);
        if (hostEnd === -1) hostEnd = url.length;
        const portIdx = url.indexOf(":", hostStart);
        hostname = url.slice(hostStart, portIdx !== -1 && portIdx < hostEnd ? portIdx : hostEnd);
    }

    activeConnections.set(id, {
        id,
        url: url.length > 100 ? url.slice(0, 97) + "..." : url,
        hostname,
        method,
        startTime: Date.now(),
    });
    return id;
}

export function trackRequestEnd(connId: number, status: number, latencyMs: number) {
    const conn = activeConnections.get(connId);
    activeConnections.delete(connId);

    if (conn) {
        pushLog({
            id: conn.id,
            url: conn.url,
            hostname: conn.hostname,
            method: conn.method,
            status,
            latency: Math.round(latencyMs * 100) / 100,
            timestamp: Date.now(),
        });
        incrementDomain(conn.hostname);
    }
}

export function getActiveConnections(): (ActiveConnection & { elapsed: number })[] {
    const now = Date.now();
    return Array.from(activeConnections.values()).map((c) => ({
        ...c,
        elapsed: now - c.startTime,
    }));
}

// ─── Domain Breakdown ────────────────────────────────────────────────────────

const DOMAIN_CAP = 200;
const domainCounts = new Map<string, number>();
let totalDomainHits = 0;

function incrementDomain(hostname: string) {
    totalDomainHits++;
    const current = domainCounts.get(hostname);
    domainCounts.set(hostname, (current ?? 0) + 1);

    // LFU eviction — only triggers when over cap (rare, 200+ unique domains)
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

export function getDomainBreakdown(limit = 10): { hostname: string; count: number; percent: number }[] {
    const entries = Array.from(domainCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    const max = entries[0]?.[1] ?? 1;
    return entries.map(([hostname, count]) => ({
        hostname,
        count,
        percent: Math.round((count / max) * 100),
    }));
}
