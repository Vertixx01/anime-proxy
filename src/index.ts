import { Hono } from "hono";

import { ALLOWED_ORIGINS } from "./constants.js";
import { decryptUrl } from "./crypto.js";
import { trackRequestStart, trackRequestEnd } from "./activity.js";
import { incrementMetrics } from "./metrics.js";
import { registerEndpoints } from "./endpoints.js";
import { registerProxy } from "./proxy.js";

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

// ─── Metrics Middleware (only for proxy requests with url/u params) ──────────
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
    incrementMetrics(latency);
    trackRequestEnd(connId, c.res.status, latency);
});

// Register API endpoints (must come before proxy catch-all)
registerEndpoints(app);

// Register proxy catch-all (must be last)
registerProxy(app);

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`🚀 Proxy alive on http://localhost:${port}`);

export { app };

export default {
    port,
    fetch: app.fetch,
};
