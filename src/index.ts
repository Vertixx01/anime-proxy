import { Hono } from "hono";
import { ALLOWED_ORIGINS } from "./constants.js";
import { decryptUrl } from "./crypto.js";
import { trackRequestStart, trackRequestEnd } from "./activity.js";
import { incrementMetrics } from "./metrics.js";
import { registerEndpoints } from "./endpoints.js";
import { registerProxy } from "./proxy.js";

const app = new Hono();

app.use("*", async (c, next) => {
    await next();

    const origin = c.req.header("origin") ?? "";
    if (!c.res.headers.get("Access-Control-Allow-Origin")) {
        if (ALLOWED_ORIGINS.size === 0) {
            c.header("Access-Control-Allow-Origin", "*");
        } else if (origin && ALLOWED_ORIGINS.has(origin)) {
            c.header("Access-Control-Allow-Origin", origin);
        }
    }
});

app.use("*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/api/") || path === "/help") {
        await next();
        return;
    }

    const rawUrl = c.req.query("url");
    const encUrl = c.req.query("u");
    if (!rawUrl && !encUrl) {
        await next();
        return;
    }

    let displayUrl = rawUrl ?? "";
    if (!displayUrl && encUrl) {
        displayUrl = decryptUrl(encUrl) ?? encUrl;
    }

    const connId = trackRequestStart(displayUrl, c.req.method);
    const start = performance.now();
    await next();
    const latency = performance.now() - start;
    incrementMetrics(latency);
    trackRequestEnd(connId, c.res.status);
});

registerEndpoints(app);
registerProxy(app);

const port = parseInt(process.env.PORT || "8080", 10);
console.log(`🚀 Proxy alive on http://localhost:${port}`);

export { app };

export default {
    port,
    fetch: app.fetch,
};
