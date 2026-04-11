/**
 * All API endpoint registrations — existing + new.
 * Called by index.ts BEFORE the proxy catch-all.
 */

import type { Hono } from "hono";
import { CORS_HEADERS } from "./constants.js";
import { generateHeadersOriginal, DOMAIN_GROUPS } from "./headers.js";
import { extractManifestDebug } from "./processor.js";
import { encryptUrl, XOR_KEY } from "./crypto.js";
import {
    handleDashboard,
    handleStatsFragment,
    handleStatusBadge,
    handleRequestsFragment,
    handleActiveFragment,
    handleDomainsFragment,
    formatUptime,
} from "./dashboard.js";
import { getRecentRequests, getActiveConnections, getDomainBreakdown } from "./activity.js";
import { START_TIME, getRequestCount, getAvgLatency } from "./metrics.js";

export function registerEndpoints(app: Hono) {
    // ─── Dashboard ───────────────────────────────────────────────────────────────

    app.get("/help", handleDashboard);

    // ─── Real-Time Fragments (HTMX) ─────────────────────────────────────────────

    app.get("/api/stats", (c) => {
        const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
        const avgLatency = getAvgLatency().toFixed(2);

        return c.html(handleStatsFragment({
            uptime: uptimeSeconds,
            requests: getRequestCount(),
            latency: `${avgLatency}ms`,
        }));
    });

    app.get("/api/status", (c) => {
        const isJson = c.req.header("Accept")?.includes("application/json");
        if (isJson) {
            return c.json({
                status: "Online",
                uptime: formatUptime(Math.floor((Date.now() - START_TIME) / 1000)),
                latency: getRequestCount() > 0 ? getAvgLatency().toFixed(2) + "ms" : "N/A",
                message: "FAST ASF",
            }, 200, CORS_HEADERS);
        }
        return c.html(handleStatusBadge("FAST ASF"));
    });

    // ─── Live Activity Fragments ─────────────────────────────────────────────────

    app.get("/api/activity/requests", (c) => c.html(handleRequestsFragment(getRecentRequests())));
    app.get("/api/activity/active", (c) => c.html(handleActiveFragment(getActiveConnections())));
    app.get("/api/activity/domains", (c) => c.html(handleDomainsFragment(getDomainBreakdown())));

    // ─── Service Info ────────────────────────────────────────────────────────────

    app.get("/api/info", (c) => {
        const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
        const avgLatency = getAvgLatency().toFixed(2);

        return c.json({
            name: "Anime Proxy",
            version: "1.3.0",
            description: "Industrial-grade unified proxy for Railway/Bun.",
            uptime: formatUptime(uptimeSeconds),
            requests: getRequestCount(),
            avg_latency: `${avgLatency}ms`,
            runtime: "Bun",
            status: "Online",
            performance: "Extreme",
            endpoints: {
                proxy: { path: "/*", method: "ALL", description: "Main proxy route. Expects 'url' parameter.", status: "Operational" },
                help: { path: "/help", method: "GET", description: "Interactive dashboard and statistics.", status: "Operational" },
                debug_manifest: { path: "/api/debug-manifest", method: "GET", description: "Analyse M3U8 manifest structure and debug segments.", status: "Operational" },
                stats: { path: "/api/stats", method: "GET", description: "Real-time performance metrics (HTMX fragment).", status: "Operational" },
                status: { path: "/api/status", method: "GET", description: "Live status badge generation.", status: "Operational" },
                health: { path: "/api/health", method: "GET", description: "Zero-auth health check for uptime monitors.", status: "Operational" },
                encrypt: { path: "/api/encrypt", method: "POST", description: "Encrypt a URL for use with ?u= parameter.", status: "Operational" },
                headers_preview: { path: "/api/headers-preview", method: "GET", description: "Preview computed upstream headers for a target URL.", status: "Operational" },
                domains: { path: "/api/domains", method: "GET", description: "List all supported domain groups and their patterns.", status: "Operational" },
                test_upstream: { path: "/api/test-upstream", method: "GET", description: "Test upstream URL reachability from the proxy.", status: "Operational" },
                activity_export: { path: "/api/activity/export", method: "GET", description: "Export request history and domain breakdown as JSON.", status: "Operational" },
                metrics: { path: "/api/metrics", method: "GET", description: "Prometheus-compatible text metrics exposition.", status: "Operational" },
                resolve: { path: "/api/resolve", method: "GET", description: "Follow and report the full redirect chain of a URL.", status: "Operational" },
            },
        }, 200, CORS_HEADERS);
    });

    // ─── Preflight ───────────────────────────────────────────────────────────────

    app.options("*", (c) => c.body(null, 204, CORS_HEADERS));

    // ─── Manifest Debugger ───────────────────────────────────────────────────────

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

    // ═════════════════════════════════════════════════════════════════════════════
    //  NEW ENDPOINTS
    // ═════════════════════════════════════════════════════════════════════════════

    // ─── 1. Health Check ─────────────────────────────────────────────────────────

    app.get("/api/health", (c) => {
        return c.json({
            status: "healthy",
            timestamp: Date.now(),
            uptime: Math.floor((Date.now() - START_TIME) / 1000),
        }, 200, CORS_HEADERS);
    });

    // ─── 2. URL Encryption ───────────────────────────────────────────────────────

    app.post("/api/encrypt", async (c) => {
        if (!XOR_KEY) return c.json({ error: "Encryption not configured" }, 503, CORS_HEADERS);
        try {
            const body = await c.req.json();
            const url = body?.url;
            if (!url || typeof url !== "string") return c.json({ error: "Missing url field" }, 400, CORS_HEADERS);
            const encrypted = encryptUrl(url);
            return c.json({ encrypted, proxy: `/?u=${encrypted}` }, 200, CORS_HEADERS);
        } catch {
            return c.json({ error: "Invalid JSON body" }, 400, CORS_HEADERS);
        }
    });

    // ─── 3. Header Steering Preview ──────────────────────────────────────────────

    app.get("/api/headers-preview", (c) => {
        const urlParam = c.req.query("url");
        if (!urlParam) return c.json({ error: "Missing url parameter" }, 400, CORS_HEADERS);
        try {
            const target = new URL(urlParam);
            const headers = generateHeadersOriginal(target);
            return c.json({
                target: target.href,
                hostname: target.hostname,
                computedHeaders: headers,
            }, 200, CORS_HEADERS);
        } catch {
            return c.json({ error: "Invalid URL" }, 400, CORS_HEADERS);
        }
    });

    // ─── 4. Domain Group Registry ────────────────────────────────────────────────

    app.get("/api/domains", (c) => {
        const groups = DOMAIN_GROUPS.map((g) => ({
            origin: g.origin,
            referer: g.referer,
            patterns: g.patterns.map((p) => p.source),
            hasCustomHeaders: !!g.customHeaders,
        }));
        return c.json({ count: groups.length, groups }, 200, CORS_HEADERS);
    });

    // ─── 5. Upstream Connectivity Tester ─────────────────────────────────────────

    app.get("/api/test-upstream", async (c) => {
        const urlParam = c.req.query("url");
        if (!urlParam) return c.json({ error: "Missing url parameter" }, 400, CORS_HEADERS);

        let target: URL;
        try { target = new URL(urlParam); } catch { return c.json({ error: "Invalid URL" }, 400, CORS_HEADERS); }

        const headers = generateHeadersOriginal(target);
        const start = performance.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
            const resp = await fetch(target.href, {
                method: "HEAD",
                headers,
                redirect: "follow",
                signal: controller.signal,
                // @ts-ignore
                tls: { rejectUnauthorized: false },
            });
            clearTimeout(timeout);

            const responseHeaders: Record<string, string> = {};
            for (const [k, v] of resp.headers.entries()) responseHeaders[k] = v;

            return c.json({
                url: target.href,
                reachable: true,
                status: resp.status,
                latency: Math.round(performance.now() - start) + "ms",
                contentType: resp.headers.get("content-type"),
                responseHeaders,
            }, 200, CORS_HEADERS);
        } catch (err) {
            clearTimeout(timeout);
            return c.json({
                url: target.href,
                reachable: false,
                error: err instanceof Error ? err.message : String(err),
                latency: Math.round(performance.now() - start) + "ms",
            }, 200, CORS_HEADERS);
        }
    });

    // ─── 6. Activity Export ──────────────────────────────────────────────────────

    app.get("/api/activity/export", (c) => {
        const requests = getRecentRequests();
        const domains = getDomainBreakdown(50);
        const active = getActiveConnections();

        return c.json({
            exportedAt: new Date().toISOString(),
            recentRequests: requests,
            activeConnections: active,
            domainBreakdown: domains,
            summary: {
                totalLogged: requests.length,
                activeCount: active.length,
                uniqueDomains: domains.length,
            },
        }, 200, CORS_HEADERS);
    });

    // ─── 7. Prometheus Metrics ───────────────────────────────────────────────────

    app.get("/api/metrics", (c) => {
        const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
        const avgLatency = getAvgLatency();

        const lines = [
            "# HELP proxy_requests_total Total proxy requests served",
            "# TYPE proxy_requests_total counter",
            `proxy_requests_total ${getRequestCount()}`,
            "",
            "# HELP proxy_uptime_seconds Seconds since process start",
            "# TYPE proxy_uptime_seconds gauge",
            `proxy_uptime_seconds ${uptimeSeconds}`,
            "",
            "# HELP proxy_avg_latency_ms Average request latency in milliseconds",
            "# TYPE proxy_avg_latency_ms gauge",
            `proxy_avg_latency_ms ${avgLatency.toFixed(2)}`,
            "",
            "# HELP proxy_active_connections Current in-flight proxy requests",
            "# TYPE proxy_active_connections gauge",
            `proxy_active_connections ${getActiveConnections().length}`,
        ];

        return c.text(lines.join("\n"), 200, {
            ...CORS_HEADERS,
            "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        });
    });

    // ─── 8. Redirect Chain Resolver ──────────────────────────────────────────────

    app.get("/api/resolve", async (c) => {
        const urlParam = c.req.query("url");
        if (!urlParam) return c.json({ error: "Missing url parameter" }, 400, CORS_HEADERS);

        const maxHops = Math.min(parseInt(c.req.query("max") ?? "10", 10), 20);
        const chain: { url: string; status: number; location?: string }[] = [];
        let current = urlParam;

        try {
            for (let i = 0; i < maxHops; i++) {
                const target = new URL(current);
                const headers = generateHeadersOriginal(target);

                const resp = await fetch(target.href, {
                    method: "HEAD",
                    headers,
                    redirect: "manual",
                    // @ts-ignore
                    tls: { rejectUnauthorized: false },
                });

                const location = resp.headers.get("location");
                chain.push({ url: current, status: resp.status, location: location ?? undefined });

                if (!location || resp.status < 300 || resp.status >= 400) break;
                current = new URL(location, target).href;
            }
        } catch (err) {
            chain.push({ url: current, status: 0, location: `Error: ${err instanceof Error ? err.message : String(err)}` });
        }

        return c.json({
            originalUrl: urlParam,
            finalUrl: chain[chain.length - 1]?.url ?? urlParam,
            hops: chain.length,
            chain,
        }, 200, CORS_HEADERS);
    });
}
