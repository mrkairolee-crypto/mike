import { describe, expect, it, vi } from "vitest";
import { AUDIT_ACTIONS, recordAuditEvent, sanitizeAuditMetadata } from "./audit";

function mockDb() {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    return { db: { from }, from, insert };
}

describe("audit events", () => {
    it("records normalized audit rows without blocking callers", async () => {
        const { db, from, insert } = mockDb();

        await recordAuditEvent(db as any, {
            actorUserId: "user-1",
            actorEmail: "lawyer@example.com",
            action: AUDIT_ACTIONS.DOCUMENT_DOWNLOADED,
            targetType: "document",
            targetId: "doc-1",
            projectId: "project-1",
            documentId: "doc-1",
            metadata: { filename: "nda.pdf", token: "secret-token" },
        });

        expect(from).toHaveBeenCalledWith("audit_events");
        expect(insert).toHaveBeenCalledWith({
            actor_user_id: "user-1",
            actor_email: "lawyer@example.com",
            action: "document.downloaded",
            target_type: "document",
            target_id: "doc-1",
            project_id: "project-1",
            document_id: "doc-1",
            review_id: null,
            ip_address: null,
            user_agent: null,
            metadata: { filename: "nda.pdf", token: "[redacted]" },
        });
    });

    it("redacts sensitive metadata fields including prompts, storage paths, urls, and tokens", () => {
        expect(
            sanitizeAuditMetadata({
                prompt: "full legal prompt",
                content: "contract text",
                storage_path: "users/u/doc/source.docx",
                signed_url: "https://example.com/private?sig=abc",
                apiKey: "sk-test",
                safe_count: 2,
                nested: { responseText: "model answer", document_count: 3 },
            }),
        ).toEqual({
            prompt: "[redacted]",
            content: "[redacted]",
            storage_path: "[redacted]",
            signed_url: "[redacted]",
            apiKey: "[redacted]",
            safe_count: 2,
            nested: { responseText: "[redacted]", document_count: 3 },
        });
    });
});
