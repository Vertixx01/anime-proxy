// ─── URL Encryption (XOR + base64url) ────────────────────────────────────────
export const XOR_KEY = (() => {
    const key = process.env.XOR_KEY ?? "";
    if (!key) {
        console.warn(
            "[url-crypto] XOR_KEY is empty – URLs will be base64‑encoded but NOT encrypted."
        );
    }
    return key;
})();

function bytesToBinaryString(bytes: Uint8Array): string {
    return new TextDecoder("latin1").decode(bytes);
}

function binaryStringToBytes(binary: string): Uint8Array {
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i) & 0xff;
    }
    return bytes;
}

export function encryptUrl(url: string): string {
    const data = new TextEncoder().encode(url);
    const key = new TextEncoder().encode(XOR_KEY);

    if (key.length === 0) {
        return btoa(bytesToBinaryString(data))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    }

    const len = data.length;
    const keyLen = key.length;
    const result = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        result[i] = data[i] ^ key[i % keyLen];
    }

    return btoa(bytesToBinaryString(result))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export function decryptUrl(encrypted: string): string | null {
    try {
        const b64 = encrypted.replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64);
        const bytes = binaryStringToBytes(raw);
        const key = new TextEncoder().encode(XOR_KEY);

        if (key.length === 0) {
            return new TextDecoder().decode(bytes);
        }

        const keyLen = key.length;
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] ^= key[i % keyLen];
        }

        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}
