import { describe, expect, it, vi } from "vitest";
import { listProjectAuditEvents } from "./auditEvents";

function makeDb(rows: unknown[] = []) {
    const range = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(() => ({ range }));
    const limit = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ limit }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { db: { from }, calls: { from, select, eq, limit, order, range } };
}

describe("listProjectAuditEvents", () => {
    it("scopes events to the project and returns newest first with a safe limit", async () => {
        const { db, calls } = makeDb([
            {
                id: "evt-1",
                action: "document.viewed",
                target_type: "document",
                target_id: "doc-1",
                actor_email: "lawyer@example.com",
                created_at: "2026-05-26T00:00:00Z",
                metadata: { file_type: "pdf" },
            },
        ]);

        const events = await listProjectAuditEvents(db as never, "project-1", {
            limit: 500,
        });

        expect(calls.from).toHaveBeenCalledWith("audit_events");
        expect(calls.select).toHaveBeenCalledWith(
            "id, created_at, actor_user_id, actor_email, action, target_type, target_id, project_id, document_id, review_id, metadata",
        );
        expect(calls.eq).toHaveBeenCalledWith("project_id", "project-1");
        expect(calls.limit).toHaveBeenCalledWith(100);
        expect(calls.order).toHaveBeenCalledWith("created_at", { ascending: false });
        expect(calls.range).toHaveBeenCalledWith(0, 99);
        expect(events).toEqual([
            {
                id: "evt-1",
                action: "document.viewed",
                target_type: "document",
                target_id: "doc-1",
                actor_email: "lawyer@example.com",
                created_at: "2026-05-26T00:00:00Z",
                metadata: { file_type: "pdf" },
            },
        ]);
    });

    it("clamps offsets and throws a safe error for database failures", async () => {
        const range = vi.fn().mockResolvedValue({
            data: null,
            error: { message: "permission denied for audit_events" },
        });
        const order = vi.fn(() => ({ range }));
        const limit = vi.fn(() => ({ order }));
        const eq = vi.fn(() => ({ limit }));
        const select = vi.fn(() => ({ eq }));
        const from = vi.fn(() => ({ select }));
        const db = { from };

        await expect(
            listProjectAuditEvents(db as never, "project-1", {
                limit: -5,
                offset: -20,
            }),
        ).rejects.toThrow("Unable to load audit events");
        expect(limit).toHaveBeenCalledWith(25);
        expect(range).toHaveBeenCalledWith(0, 24);
    });
});
