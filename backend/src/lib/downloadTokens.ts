import crypto from "crypto";

/**
 * HMAC-signed, expiring download tokens.
 *
 * The token encodes the R2 storage path + filename + purpose + expiry;
 * the backend route `/download/:token` validates the signature, rejects
 * expired/non-download tokens, then re-checks current document access before
 * streaming the file. This keeps chat-history links convenient while avoiding
 * permanently valid bearer-style document links.
 */

export const DEFAULT_DOWNLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const DOWNLOAD_PURPOSE = "download";

type DownloadTokenPurpose = typeof DOWNLOAD_PURPOSE | string;

type SignDownloadOptions = {
    ttlMs?: number;
    purpose?: DownloadTokenPurpose;
    nowMs?: number;
};

type DownloadTokenPayload = {
    p: string;
    f: string;
    purpose: DownloadTokenPurpose;
    exp: number;
};

export type VerifiedDownload = {
    path: string;
    filename: string;
    purpose: typeof DOWNLOAD_PURPOSE;
    expiresAt: number;
};

function getSecret(): string {
    const secret = process.env.DOWNLOAD_SIGNING_SECRET;
    if (!secret) {
        throw new Error(
            "DOWNLOAD_SIGNING_SECRET must be set. " +
                "Generate a strong random value (e.g. `openssl rand -hex 32`) and set it in the environment.",
        );
    }
    return secret;
}

function b64urlEncode(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function b64urlDecode(s: string): Buffer {
    let t = s.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    return Buffer.from(t, "base64");
}

function timingSafeEqStr(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function expiryFromOptions(options: SignDownloadOptions): number {
    const nowMs = options.nowMs ?? Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_DOWNLOAD_TOKEN_TTL_MS;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
        throw new Error("Download token ttlMs must be a positive finite number");
    }
    return nowMs + ttlMs;
}

export function signDownload(
    path: string,
    filename: string,
    options: SignDownloadOptions = {},
): string {
    const payload: DownloadTokenPayload = {
        p: path,
        f: filename,
        purpose: options.purpose ?? DOWNLOAD_PURPOSE,
        exp: expiryFromOptions(options),
    };
    const enc = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
    const sig = crypto
        .createHmac("sha256", getSecret())
        .update(enc)
        .digest();
    return `${enc}.${b64urlEncode(sig)}`;
}

export function verifyDownload(token: string): VerifiedDownload | null {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [enc, sigEnc] = parts;
    const expected = crypto
        .createHmac("sha256", getSecret())
        .update(enc)
        .digest();
    if (!timingSafeEqStr(sigEnc, b64urlEncode(expected))) return null;
    try {
        const parsed = JSON.parse(
            b64urlDecode(enc).toString("utf8"),
        ) as Partial<DownloadTokenPayload>;
        if (!parsed?.p || !parsed?.f) return null;
        if (parsed.purpose !== DOWNLOAD_PURPOSE) return null;
        if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
            return null;
        }
        const expiresAt = parsed.exp;
        if (expiresAt <= Date.now()) return null;
        return {
            path: parsed.p,
            filename: parsed.f,
            purpose: DOWNLOAD_PURPOSE,
            expiresAt,
        };
    } catch {
        return null;
    }
}

/**
 * Returns a relative download URL (e.g. "/download/abc.def"). The frontend
 * prefixes it with NEXT_PUBLIC_API_BASE_URL when rendering `<a href=…>`.
 */
export function buildDownloadUrl(
    path: string,
    filename: string,
    options: SignDownloadOptions = {},
): string {
    return `/download/${signDownload(path, filename, options)}`;
}
