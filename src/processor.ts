/**
 * M3U8 Manifest Processing & URL Resolution.
 */

export function resolveUrl(line: string, base: URL): URL {
    try {
        return new URL(line);
    } catch {
        return new URL(line, base);
    }
}

export function buildProxyQuery(url: URL, debugEnabled = false, encrypt?: (u: string) => string): string {
    if (encrypt) {
        return "u=" + encrypt(url.href);
    }
    let q = "url=" + encodeURIComponent(url.href);
    if (debugEnabled) q += "&debug=1";
    return q;
}

export function extractManifestDebug(textBody: string) {
    const lines = textBody.split("\n").map((line) => line.replace(/\r$/, ""));
    const streamLines = lines.filter((line) => line.startsWith("#EXT-X-STREAM-INF"));
    const codecs = streamLines
        .map((line) => line.match(/CODECS="([^"]+)"/)?.[1] ?? null)
        .filter((value): value is string => Boolean(value));

    return {
        lineCount: lines.length,
        variantCount: streamLines.length,
        codecs: [...new Set(codecs)].slice(0, 8),
        preview: lines.filter((line) => line.startsWith("#EXT")).slice(0, 8),
    };
}

function extractQuotedAttr(line: string, valueStart: number): [string, number] | null {
    if (line[valueStart] !== '"') return null;
    const closeQuote = line.indexOf('"', valueStart + 1);
    if (closeQuote === -1) return null;
    return [line.slice(valueStart + 1, closeQuote), closeQuote + 1];
}

function rewriteUriAttrs(attrs: string, scrapeUrl: URL, debugEnabled = false, encrypt?: (u: string) => string): string {
    let result = "";
    let i = 0;

    while (i < attrs.length) {
        const eqPos = attrs.indexOf("=", i);
        if (eqPos === -1) {
            result += attrs.slice(i);
            break;
        }

        const key = attrs.slice(i, eqPos).trim();
        const afterEq = eqPos + 1;

        if (attrs[afterEq] === '"') {
            const parsed = extractQuotedAttr(attrs, afterEq);
            if (!parsed) break;
            const [value, afterClose] = parsed;

            if (key === "URI" || key === "URL") {
                const resolved = resolveUrl(value, scrapeUrl);
                const q = buildProxyQuery(resolved, debugEnabled, encrypt);
                result += `${key}="?${q}"`;
            } else {
                result += attrs.slice(i, afterClose);
            }

            if (afterClose < attrs.length && attrs[afterClose] === ',') {
                result += ',';
                i = afterClose + 1;
            } else {
                i = afterClose;
            }
            continue;
        }

        const commaPos = attrs.indexOf(",", afterEq);
        if (commaPos === -1) {
            result += attrs.slice(i);
            break;
        }
        result += attrs.slice(i, commaPos + 1);
        i = commaPos + 1;
    }

    return result;
}

export function processM3u8Line(
    line: string,
    scrapeUrl: URL,
    debugEnabled = false,
    encrypt?: (u: string) => string,
): string {
    if (line.length === 0) return "";

    if (line[0] === "#") {
        if (/(URI|URL)\s*=\s*"/.test(line)) {
            const colonPos = line.indexOf(":");
            if (colonPos !== -1) {
                const prefix = line.slice(0, colonPos + 1);
                const attrs = line.slice(colonPos + 1);
                return prefix + rewriteUriAttrs(attrs, scrapeUrl, debugEnabled, encrypt);
            }
        }
        return line;
    }

    const resolved = resolveUrl(line, scrapeUrl);
    const q = buildProxyQuery(resolved, debugEnabled, encrypt);
    return `?${q}`;
}
