// ─── URL Encryption (XOR + base64url) ────────────────────────────────────────

export const XOR_KEY = process.env.XOR_KEY ?? "";

export function decryptUrl(encrypted: string): string | null {
    try {
        const b64 = encrypted.replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const key = new TextEncoder().encode(XOR_KEY);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i) ^ key[i % key.length];
        }
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

export function encryptUrl(url: string): string {
    const data = new TextEncoder().encode(url);
    const key = new TextEncoder().encode(XOR_KEY);
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return btoa(String.fromCharCode(...result))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}
