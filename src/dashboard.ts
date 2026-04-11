import { CORS_HEADERS } from "./constants.js";
import type { RequestLogEntry, ActiveConnection } from "./activity.js";

/**
 * Premium Dashboard & Help UI for the Proxy.
 * Uses HTMX (htmlx) for real-time, low-latency status updates.
 */

const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anime Proxy | High Performance</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0a0a0f;
            --card-bg: #12121e;
            --accent: #ff0055;
            --accent-glow: rgba(255, 0, 85, 0.3);
            --text-main: #ffffff;
            --text-dim: #9494b8;
            --gradient: linear-gradient(135deg, #ff0055 0%, #7000ff 100%);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg);
            color: var(--text-main);
            line-height: 1.6;
            overflow-x: hidden;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 4rem 2rem;
            position: relative;
            z-index: 1;
        }

        /* Glassmorphism background elements */
        body::before {
            content: '';
            position: absolute;
            top: -10%;
            right: -10%;
            width: 400px;
            height: 400px;
            background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
            z-index: 0;
            pointer-events: none;
        }

        header {
            text-align: center;
            margin-bottom: 4rem;
        }

        h1 {
            font-size: 3.5rem;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1rem;
            letter-spacing: -1px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            background: rgba(0, 255, 128, 0.1);
            color: #00ff80;
            padding: 0.5rem 1.25rem;
            border-radius: 2rem;
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid rgba(0, 255, 128, 0.2);
            margin-top: 1rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: #00ff80;
            border-radius: 50%;
            margin-right: 10px;
            box-shadow: 0 0 10px #00ff80;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
        }

        .stats-strip {
            display: flex;
            gap: 1.5rem;
            justify-content: center;
            margin-bottom: 3rem;
            flex-wrap: wrap;
        }

        .stat-item {
            background: rgba(255, 255, 255, 0.03);
            padding: 1rem 2rem;
            border-radius: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
            min-width: 150px;
        }

        .stat-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--accent);
        }

        .stat-label {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-dim);
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }

        .example-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
        }

        .card {
            background: var(--card-bg);
            padding: 2.5rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .card:hover {
            transform: translateY(-10px);
            border-color: var(--accent);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }

        .card h2 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: var(--text-main);
        }

        .card p {
            color: var(--text-dim);
            font-size: 1rem;
        }

        code {
            display: block;
            background: #000;
            padding: 1rem;
            border-radius: 0.75rem;
            color: #00ffd5;
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            margin-top: 1rem;
            overflow-x: auto;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .example-card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 1rem;
            padding: 1rem;
        }

        .example-card label {
            display: block;
            color: var(--text-dim);
            font-size: 0.8rem;
            margin-bottom: 0.4rem;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .example-card input {
            width: 100%;
            padding: 0.9rem 1rem;
            border-radius: 0.75rem;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.45);
            color: white;
            margin-bottom: 0.75rem;
        }

        .example-actions {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
        }

        .btn {
            padding: 0.8rem 1rem;
            border-radius: 0.75rem;
            border: none;
            background: var(--gradient);
            color: white;
            font-weight: 700;
            cursor: pointer;
        }

        .btn.secondary {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.08);
        }

        pre {
            white-space: pre-wrap;
            word-break: break-word;
            background: #05050a;
            color: #c8ffee;
            padding: 1rem;
            border-radius: 0.9rem;
            border: 1px solid rgba(255,255,255,0.08);
            margin-top: 1rem;
            min-height: 160px;
            max-height: 360px;
            overflow: auto;
            font-size: 0.82rem;
        }

        .htmx-indicator {
            opacity: 0;
            transition: opacity 200ms ease-in;
        }
        .htmx-request .htmx-indicator {
            opacity: 1;
        }

        .footer {
            text-align: center;
            margin-top: 6rem;
            color: var(--text-dim);
            font-size: 0.9rem;
        }

        .footer a {
            color: var(--accent);
            text-decoration: none;
            transition: color 0.2s;
        }

        .footer a:hover {
            color: #fff;
        }

        .socials {
            display: flex;
            justify-content: center;
            gap: 1.5rem;
            margin-top: 1rem;
        }

        .social-link {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 600;
            opacity: 0.6;
        }

        .social-link:hover {
            opacity: 1;
        }

        /* ─── Live Activities ─────────────────────────────────── */
        .activity-section {
            margin-top: 2.5rem;
        }

        .activity-section h2 {
            font-size: 2rem;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 1.5rem;
            text-align: center;
        }

        .active-conn-card {
            background: var(--card-bg);
            padding: 1.5rem 2rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 1.5rem;
        }

        .active-conn-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1rem;
        }

        .active-conn-header h3 {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-main);
        }

        .conn-count-badge {
            background: var(--gradient);
            color: white;
            font-weight: 800;
            font-size: 0.85rem;
            padding: 0.3rem 0.9rem;
            border-radius: 2rem;
            min-width: 28px;
            text-align: center;
        }

        .conn-list {
            list-style: none;
        }

        .conn-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            font-size: 0.85rem;
        }

        .conn-item:last-child {
            border-bottom: none;
        }

        .conn-dot {
            width: 8px;
            height: 8px;
            background: #00ff80;
            border-radius: 50%;
            box-shadow: 0 0 8px #00ff80;
            animation: pulse 1.5s infinite;
            flex-shrink: 0;
        }

        .conn-url {
            color: var(--text-dim);
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: 'Fira Code', monospace;
            font-size: 0.8rem;
        }

        .conn-elapsed {
            color: var(--accent);
            font-weight: 600;
            flex-shrink: 0;
        }

        .conn-method {
            color: #7000ff;
            font-weight: 700;
            font-size: 0.75rem;
            flex-shrink: 0;
        }

        .conn-empty {
            color: var(--text-dim);
            font-size: 0.85rem;
            text-align: center;
            padding: 1rem;
            opacity: 0.6;
        }

        .activity-grid {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;
        }

        .activity-card {
            background: var(--card-bg);
            padding: 1.5rem;
            border-radius: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .activity-card h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }

        /* Request Log Table */
        .req-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.82rem;
        }

        .req-table thead {
            position: sticky;
            top: 0;
            z-index: 1;
        }

        .req-table th {
            background: rgba(0, 0, 0, 0.6);
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-size: 0.7rem;
            font-weight: 600;
            padding: 0.6rem 0.5rem;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .req-table td {
            padding: 0.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            color: var(--text-dim);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 280px;
        }

        .req-table-scroll {
            max-height: 360px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: var(--accent) transparent;
        }

        .req-table-scroll::-webkit-scrollbar {
            width: 4px;
        }

        .req-table-scroll::-webkit-scrollbar-thumb {
            background: var(--accent);
            border-radius: 4px;
        }

        .status-2xx { color: #00ff80; font-weight: 700; }
        .status-3xx { color: #ffbe00; font-weight: 700; }
        .status-4xx { color: #ff8c00; font-weight: 700; }
        .status-5xx { color: var(--accent); font-weight: 700; }

        .req-method {
            color: #7000ff;
            font-weight: 700;
            font-size: 0.75rem;
        }

        .req-latency {
            font-family: 'Fira Code', monospace;
            font-size: 0.78rem;
        }

        .req-url-cell {
            font-family: 'Fira Code', monospace;
            font-size: 0.78rem;
        }

        .req-empty {
            color: var(--text-dim);
            text-align: center;
            padding: 2rem;
            opacity: 0.5;
        }

        /* Domain Breakdown */
        .domain-list {
            list-style: none;
        }

        .domain-item {
            margin-bottom: 0.75rem;
        }

        .domain-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.3rem;
            font-size: 0.82rem;
        }

        .domain-name {
            color: var(--text-main);
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 150px;
        }

        .domain-count {
            color: var(--text-dim);
            font-size: 0.78rem;
            flex-shrink: 0;
        }

        .domain-bar-bg {
            height: 6px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
            overflow: hidden;
        }

        .domain-bar-fill {
            height: 100%;
            background: var(--gradient);
            border-radius: 3px;
            transition: width 0.5s ease;
        }

        .domain-empty {
            color: var(--text-dim);
            text-align: center;
            padding: 2rem;
            opacity: 0.5;
            font-size: 0.85rem;
        }

        @media (max-width: 768px) {
            .activity-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 600px) {
            h1 { font-size: 2.5rem; }
            .container { padding: 2rem 1rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Anime Proxy</h1>
            <p style="color: var(--text-dim); font-size: 1.2rem;">Ultra high-performance M3U8 & Binary Streaming</p>
            <div class="status-badge" hx-get="/api/status" hx-trigger="every 5s" hx-swap="outerHTML">
                <div class="status-dot"></div>
                Status: ONLINE (Bun)
            </div>
        </header>

        <div id="stats-container" class="stats-strip" hx-get="/api/stats" hx-trigger="load, every 10s">
            <!-- HTMX will load stats here -->
            <div class="stat-item">
                <span class="stat-value">...</span>
                <span class="stat-label">Requests</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">...</span>
                <span class="stat-label">Uptime</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">...</span>
                <span class="stat-label">Latency</span>
            </div>
        </div>

        <div class="card" style="grid-column: 1 / -1; background: linear-gradient(rgba(18, 18, 30, 0.8), rgba(18, 18, 30, 0.8)), url('https://i.pinimg.com/originals/7e/e3/3e/7ee33e07e6794f7db4e785a5fe731f04.gif'); background-size: cover; background-position: center;">
            <h2>Quick Proxy Search</h2>
            <p>Paste a manifest or media URL below to stream it instantly through the proxy.</p>
            <form id="proxy-form" style="display: flex; gap: 10px; margin-top: 1.5rem;">
                <input type="url" id="proxy-url" placeholder="https://example.com/video.m3u8" required 
                    style="flex: 1; padding: 1rem; border-radius: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); color: white; outline: none; transition: border-color 0.3s;">
                <button type="submit" style="padding: 1rem 2rem; border-radius: 0.75rem; border: none; background: var(--gradient); color: white; font-weight: 800; cursor: pointer; transition: transform 0.2s;">
                    STREAM
                </button>
            </form>
            <script>
                document.getElementById('proxy-form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const url = document.getElementById('proxy-url').value;
                    if (url) {
                        window.location.href = '/?url=' + encodeURIComponent(url);
                    }
                });
                // Focus styling
                const input = document.getElementById('proxy-url');
                input.addEventListener('focus', () => input.style.borderColor = 'var(--accent)');
                input.addEventListener('blur', () => input.style.borderColor = 'rgba(255,255,255,0.1)');
            </script>
        </div>

        <!-- ─── Live Activities ──────────────────────────────── -->
        <div class="activity-section">
            <h2>Live Activities</h2>

            <div class="active-conn-card">
                <div class="active-conn-header">
                    <h3>Active Connections</h3>
                    <div id="conn-badge" class="conn-count-badge">0</div>
                </div>
                <div id="active-connections" hx-get="/api/activity/active" hx-trigger="load, every 2s" hx-swap="innerHTML">
                    <div class="conn-empty">No active connections</div>
                </div>
            </div>

            <div class="activity-grid">
                <div class="activity-card">
                    <h3>Recent Requests</h3>
                    <div class="req-table-scroll">
                        <table class="req-table">
                            <thead>
                                <tr>
                                    <th>Method</th>
                                    <th>URL</th>
                                    <th>Status</th>
                                    <th>Latency</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody id="requests-body" hx-get="/api/activity/requests" hx-trigger="load, every 3s" hx-swap="innerHTML">
                                <tr><td colspan="5" class="req-empty">No requests yet</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="activity-card">
                    <h3>Top Domains</h3>
                    <div id="domain-breakdown" hx-get="/api/activity/domains" hx-trigger="load, every 10s" hx-swap="innerHTML">
                        <div class="domain-empty">No data yet</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h2>Direct Proxy</h2>
                <p>Stream any file by appending the target URL.</p>
                <code>/?url=ENCODED_URL</code>
            </div>
            <div class="card">
                <h2>Health Check</h2>
                <p>Granular system health and metadata JSON.</p>
                <code>/api/info</code>
            </div>
            <div class="card">
                <h2>Manifest Debug</h2>
                <p>Inspect codec and variant information for Railway debugging.</p>
                <code>/api/debug-manifest?url=ENCODED_M3U8_URL</code>
            </div>
            <div class="card">
                <h2>Stats API</h2>
                <p>Pure HTMX fragment for real-time monitoring.</p>
                <code>/api/stats</code>
            </div>
            <div class="card">
                <h2>Dashboard Force</h2>
                <p>Force the UI overlay on any proxy request.</p>
                <code>?dashboard=true</code>
            </div>
        </div>

        <div class="card" style="margin-top: 2rem;">
            <h2>Example Requests</h2>
            <p>Run common API calls directly from the dashboard and inspect beautified JSON output.</p>
            <div class="example-grid">
                <div class="example-card">
                    <label for="manifest-url">Manifest URL</label>
                    <input id="manifest-url" placeholder="https://example.com/master.m3u8" />
                    <div class="example-actions">
                        <button class="btn" data-endpoint="manifest-debug">Run Manifest Debug</button>
                        <button class="btn secondary" data-endpoint="proxy-debug">Open Proxied Debug</button>
                    </div>
                </div>
                <div class="example-card">
                    <label>Service Metadata</label>
                    <div class="example-actions">
                        <button class="btn" data-endpoint="info">Run /api/info</button>
                    </div>
                </div>
            </div>
            <pre id="example-output">Click an example above to inspect formatted JSON responses.</pre>
        </div>

        <div class="footer">
            Built for Railway.app &bull; Optimized by <a href="https://github.com/vertixx01" target="_blank">Vertixx</a>
            <div class="socials">
                <a href="https://github.com/vertixx01" target="_blank" class="social-link">GitHub</a>
                <a href="https://www.linkedin.com/in/rudranil-dev" target="_blank" class="social-link">LinkedIn</a>
                <a href="mailto:hmu@vertixx.lol" class="social-link">Email</a>
            </div>
        </div>
    </div>
    <script>
        const output = document.getElementById('example-output');

        const setOutput = (value) => {
            output.textContent = value;
        };

        const runJsonRequest = async (url) => {
            setOutput('Loading...\\n' + url);
            try {
                const response = await fetch(url);
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    const text = await response.text();
                    setOutput(text);
                    return;
                }

                const data = await response.json();
                setOutput(JSON.stringify(data, null, 2));
            } catch (error) {
                setOutput(JSON.stringify({
                    error: error instanceof Error ? error.message : String(error)
                }, null, 2));
            }
        };

        document.querySelectorAll('[data-endpoint]').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-endpoint');
                const manifestUrl = document.getElementById('manifest-url').value.trim();

                if (action === 'manifest-debug') {
                    if (!manifestUrl) {
                        setOutput('Provide a manifest URL first.');
                        return;
                    }

                    const params = new URLSearchParams({ url: manifestUrl });
                    await runJsonRequest('/api/debug-manifest?' + params.toString());
                    return;
                }

                if (action === 'proxy-debug') {
                    if (!manifestUrl) {
                        setOutput('Provide a manifest URL first.');
                        return;
                    }

                    const params = new URLSearchParams({ url: manifestUrl, debug: '1' });
                    window.open('/?' + params.toString(), '_blank');
                    setOutput(JSON.stringify({
                        opened: '/?' + params.toString()
                    }, null, 2));
                    return;
                }

                await runJsonRequest('/api/info');
            });
        });
    </script>
</body>
</html>
`;

export function handleDashboard(c: any) {
    return c.html(DASHBOARD_HTML, 200, CORS_HEADERS);
}

/**
 * Beautifies uptime seconds into a human-readable string (Hh Mm Ss).
 */
export function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    let result = "";
    if (h > 0) result += `${h}h `;
    if (m > 0 || h > 0) result += `${m}m `;
    result += `${s}s`;
    
    return result.trim();
}

export function handleStatsFragment(stats: { uptime: number | string, requests: number, latency: string }) {
    const displayUptime = typeof stats.uptime === "number" ? formatUptime(stats.uptime) : stats.uptime;
    
    return `
        <div class="stat-item">
            <span class="stat-value">${stats.requests}</span>
            <span class="stat-label">Requests</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${displayUptime}</span>
            <span class="stat-label">Uptime</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${stats.latency}</span>
            <span class="stat-label">Avg. Latency</span>
        </div>
    `;
}

export function handleStatusBadge(status: string) {
    return `
        <div class="status-badge" hx-get="/api/status" hx-trigger="every 5s" hx-swap="outerHTML">
            <div class="status-dot"></div>
            Status: ${status} (Bun)
        </div>
    `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatTimeAgo(timestamp: number): string {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
}

function statusClass(status: number): string {
    if (status >= 500) return "status-5xx";
    if (status >= 400) return "status-4xx";
    if (status >= 300) return "status-3xx";
    return "status-2xx";
}

// ─── Live Activity Fragments ─────────────────────────────────────────────────

export function handleRequestsFragment(requests: RequestLogEntry[]): string {
    if (requests.length === 0) {
        return `<tr><td colspan="5" class="req-empty">No requests yet</td></tr>`;
    }

    return requests.map((r) => `
        <tr>
            <td><span class="req-method">${escapeHtml(r.method)}</span></td>
            <td class="req-url-cell" title="${escapeHtml(r.url)}">${escapeHtml(r.hostname)}${escapeHtml(r.url.replace(/^https?:\/\/[^/]+/, "").slice(0, 40))}</td>
            <td><span class="${statusClass(r.status)}">${r.status}</span></td>
            <td class="req-latency">${r.latency}ms</td>
            <td>${formatTimeAgo(r.timestamp)}</td>
        </tr>
    `).join("");
}

export function handleActiveFragment(connections: (ActiveConnection & { elapsed: number })[]): string {
    const badge = `<div id="conn-badge" class="conn-count-badge" hx-swap-oob="true">${connections.length}</div>`;

    if (connections.length === 0) {
        return `<div class="conn-empty">No active connections</div>${badge}`;
    }

    const items = connections.map((c) => `
        <li class="conn-item">
            <div class="conn-dot"></div>
            <span class="conn-method">${escapeHtml(c.method)}</span>
            <span class="conn-url" title="${escapeHtml(c.url)}">${escapeHtml(c.url)}</span>
            <span class="conn-elapsed">${c.elapsed < 1000 ? c.elapsed + "ms" : (c.elapsed / 1000).toFixed(1) + "s"}</span>
        </li>
    `).join("");

    return `<ul class="conn-list">${items}</ul>${badge}`;
}

export function handleDomainsFragment(domains: { hostname: string; count: number; percent: number }[]): string {
    if (domains.length === 0) {
        return `<div class="domain-empty">No data yet</div>`;
    }

    return `<ul class="domain-list">${domains.map((d) => `
        <li class="domain-item">
            <div class="domain-info">
                <span class="domain-name" title="${escapeHtml(d.hostname)}">${escapeHtml(d.hostname)}</span>
                <span class="domain-count">${d.count} req</span>
            </div>
            <div class="domain-bar-bg">
                <div class="domain-bar-fill" style="width: ${d.percent}%"></div>
            </div>
        </li>
    `).join("")}</ul>`;
}
