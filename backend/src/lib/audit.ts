import type { Request } from "express";
import type { createServerSupabase } from "./supabase";

type Db = ReturnType<typeof createServerSupabase>;

export const AUDIT_ACTIONS = {
    PROJECT_CREATED: "project.created",
    PROJECT_UPDATED: "project.updated",
    PROJECT_DELETED: "project.deleted",
    PROJECT_SHARED: "project.shared",
    DOCUMENT_UPLOADED: "document.uploaded",
    DOCUMENT_VIEWED: "document.viewed",
    DOCUMENT_DOWNLOAD_LINK_CREATED: "document.download_link_created",
    DOCUMENT_DOWNLOADED: "document.downloaded",
    DOCUMENT_ZIP_EXPORTED: "document.zip_exported",
    DOCUMENT_VERSION_UPLOADED: "document.version_uploaded",
    DOCUMENT_VERSION_RENAMED: "document.version_renamed",
    DOCUMENT_EDIT_RESOLVED: "document.edit_resolved",
    DOCUMENT_DELETED: "document.deleted",
    CHAT_CREATED: "chat.created",
    AI_REVIEW_STARTED: "ai.review_started",
    AI_REVIEW_COMPLETED: "ai.review_completed",
    TABULAR_REVIEW_CREATED: "tabular_review.created",
    TABULAR_REVIEW_UPDATED: "tabular_review.updated",
    TABULAR_REVIEW_DELETED: "tabular_review.deleted",
    TABULAR_REVIEW_GENERATED: "tabular_review.generated",
    TABULAR_CHAT_STARTED: "tabular_chat.started",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

export type AuditEventInput = {
    actorUserId: string;
    actorEmail?: string | null;
    action: AuditAction;
    targetType: string;
    targetId?: string | null;
    projectId?: string | null;
    documentId?: string | null;
    reviewId?: string | null;
    metadata?: Record<string, unknown> | null;
    req?: Request;
};

const SENSITIVE_KEY_PATTERN =
    /(content|text|body|prompt|response|message|messages|token|secret|key|signed|url|path|storage|bytes|buffer|password)/i;

function sanitizeMetadataValue(value: unknown, depth = 0): unknown {
    if (value == null) return value;
    if (depth > 3) return "[redacted:depth]";
    if (typeof value === "string") return value.slice(0, 200);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
    }
    if (typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (SENSITIVE_KEY_PATTERN.test(key)) {
                out[key] = "[redacted]";
            } else {
                out[key] = sanitizeMetadataValue(child, depth + 1);
            }
        }
        return out;
    }
    return String(value).slice(0, 200);
}

export function sanitizeAuditMetadata(
    metadata?: Record<string, unknown> | null,
): Record<string, unknown> | null {
    if (!metadata) return null;
    return sanitizeMetadataValue(metadata) as Record<string, unknown>;
}

function requestIp(req?: Request): string | null {
    if (!req) return null;
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0]?.trim() || null;
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
        return forwarded[0].split(",")[0]?.trim() || null;
    }
    return req.ip ?? req.socket?.remoteAddress ?? null;
}

export async function recordAuditEvent(
    db: Db,
    input: AuditEventInput,
): Promise<void> {
    const row = {
        actor_user_id: input.actorUserId,
        actor_email: input.actorEmail ?? null,
        action: input.action,
        target_type: input.targetType,
        target_id: input.targetId ?? null,
        project_id: input.projectId ?? null,
        document_id: input.documentId ?? null,
        review_id: input.reviewId ?? null,
        ip_address: requestIp(input.req),
        user_agent: input.req?.get("user-agent") ?? null,
        metadata: sanitizeAuditMetadata(input.metadata),
    };

    const { error } = await db.from("audit_events").insert(row);
    if (error) {
        // Audit write failures should not break the user flow, but surface a
        // non-sensitive operational signal so deployment/schema drift is visible.
        console.error("[audit] failed to record event", {
            action: input.action,
            targetType: input.targetType,
            targetId: input.targetId ?? null,
            error: error.message,
        });
    }
}
