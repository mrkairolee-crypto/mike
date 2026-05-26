import type { createServerSupabase } from "./supabase";

type Db = ReturnType<typeof createServerSupabase>;

export type ProjectAuditEvent = {
    id: string;
    created_at: string;
    actor_user_id?: string | null;
    actor_email?: string | null;
    action: string;
    target_type: string;
    target_id?: string | null;
    project_id?: string | null;
    document_id?: string | null;
    review_id?: string | null;
    metadata?: Record<string, unknown> | null;
};

const AUDIT_EVENT_COLUMNS =
    "id, created_at, actor_user_id, actor_email, action, target_type, target_id, project_id, document_id, review_id, metadata";

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return Math.min(max, parsed);
}

export async function listProjectAuditEvents(
    db: Db,
    projectId: string,
    options?: { limit?: unknown; offset?: unknown },
): Promise<ProjectAuditEvent[]> {
    const limit = clampInteger(options?.limit, 25, 1, 100);
    const offset = clampInteger(options?.offset, 0, 0, 10_000);
    const { data, error } = await db
        .from("audit_events")
        .select(AUDIT_EVENT_COLUMNS)
        .eq("project_id", projectId)
        .limit(limit)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error("[audit] failed to list project audit events", {
            projectId,
            error: error.message,
        });
        throw new Error("Unable to load audit events");
    }

    return ((data ?? []) as ProjectAuditEvent[]).map((event) => ({
        id: event.id,
        created_at: event.created_at,
        actor_user_id: event.actor_user_id,
        actor_email: event.actor_email,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        project_id: event.project_id,
        document_id: event.document_id,
        review_id: event.review_id,
        metadata: event.metadata ?? null,
    }));
}
