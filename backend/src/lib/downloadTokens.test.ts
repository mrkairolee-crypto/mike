import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildDownloadUrl,
    signDownload,
    verifyDownload,
} from "./downloadTokens";

const SECRET = "test-download-signing-secret";
const ONE_HOUR_MS = 60 * 60 * 1000;

function tamperPayload(token: string): string {
    const [payload, signature] = token.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    json.f = "tampered.docx";
    return `${Buffer.from(JSON.stringify(json), "utf8").toString("base64url")}.${signature}`;
}

function tokenPayload(token: string): Record<string, unknown> {
    const [payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

describe("download tokens", () => {
    beforeEach(() => {
        process.env.DOWNLOAD_SIGNING_SECRET = SECRET;
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-05-26T00:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        delete process.env.DOWNLOAD_SIGNING_SECRET;
    });

    it("signs download tokens with path, filename, purpose, and expiry", () => {
        const token = signDownload("users/u1/docs/d1/source.docx", "source.docx", {
            ttlMs: ONE_HOUR_MS,
        });

        const payload = tokenPayload(token);
        expect(payload).toMatchObject({
            p: "users/u1/docs/d1/source.docx",
            f: "source.docx",
            purpose: "download",
            exp: Date.parse("2026-05-26T01:00:00.000Z"),
        });

        expect(verifyDownload(token)).toEqual({
            path: "users/u1/docs/d1/source.docx",
            filename: "source.docx",
            purpose: "download",
            expiresAt: Date.parse("2026-05-26T01:00:00.000Z"),
        });
    });

    it("rejects expired tokens", () => {
        const token = signDownload("users/u1/docs/d1/source.docx", "source.docx", {
            ttlMs: ONE_HOUR_MS,
        });

        vi.setSystemTime(new Date("2026-05-26T01:00:01.000Z"));

        expect(verifyDownload(token)).toBeNull();
    });

    it("rejects tokens with the wrong purpose", () => {
        const token = signDownload("users/u1/docs/d1/source.docx", "source.docx", {
            purpose: "preview",
            ttlMs: ONE_HOUR_MS,
        });

        expect(verifyDownload(token)).toBeNull();
    });

    it("rejects tampered payloads and signatures", () => {
        const token = signDownload("users/u1/docs/d1/source.docx", "source.docx", {
            ttlMs: ONE_HOUR_MS,
        });
        const [payload, signature] = token.split(".");

        expect(verifyDownload(tamperPayload(token))).toBeNull();
        expect(verifyDownload(`${payload}.${signature.slice(0, -1)}x`)).toBeNull();
    });

    it("builds relative URLs using expiring download tokens", () => {
        const url = buildDownloadUrl("users/u1/docs/d1/source.docx", "source.docx", {
            ttlMs: ONE_HOUR_MS,
        });

        expect(url).toMatch(/^\/download\/.+\..+$/);
        const token = url.replace("/download/", "");
        expect(verifyDownload(token)?.expiresAt).toBe(
            Date.parse("2026-05-26T01:00:00.000Z"),
        );
    });
});
