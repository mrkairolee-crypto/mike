"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { getProject, listProjectAuditEvents } from "@/app/lib/mikeApi";
import type {
    MikeProject,
    ProjectAuditEvent,
} from "@/app/components/shared/types";

function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatMetadata(metadata: ProjectAuditEvent["metadata"]) {
    if (!metadata || Object.keys(metadata).length === 0) return "No metadata";
    return Object.entries(metadata)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(" · ");
}

function actionLabel(action: string) {
    return action
        .split(".")
        .map((part) => part.replaceAll("_", " "))
        .join(" · ");
}

export function ProjectSecurityPage({ projectId }: { projectId: string }) {
    const [project, setProject] = useState<MikeProject | null>(null);
    const [events, setEvents] = useState<ProjectAuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        Promise.all([
            getProject(projectId),
            listProjectAuditEvents(projectId, { limit: 50 }),
        ])
            .then(([projectData, auditEvents]) => {
                if (cancelled) return;
                setProject(projectData);
                setEvents(auditEvents);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load confidentiality data.",
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId]);

    const policyItems = useMemo(
        () => [
            {
                title: "Private documents by default",
                body: "Original files, generated exports, and edited versions stay in private storage. Downloads use short-lived app-issued access, not public object URLs.",
            },
            {
                title: "Backend authorization on every sensitive action",
                body: "The API re-checks project, document, review, and owner permissions even when the UI hides unavailable controls.",
            },
            {
                title: "Audit without contract leakage",
                body: "Audit metadata records IDs, counts, status, and file types. Prompts, responses, contract text, tokens, URLs, and storage paths are redacted before persistence.",
            },
            {
                title: "Deletion includes stored bytes",
                body: "Project and document deletion paths remove associated private storage objects in addition to database records where the backend owns those objects.",
            },
            {
                title: "AI provider boundary",
                body: "AI review flows should send minimum necessary context and record the provider/model event, not the full prompt or legal text in audit logs.",
            },
        ],
        [],
    );

    return (
        <div className="min-h-screen bg-white px-6 py-8 text-gray-900 md:px-10">
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href={`/projects/${projectId}`}
                            className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to project
                        </Link>
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl bg-gray-100 p-3">
                                <LockKeyhole className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium uppercase tracking-[0.2em] text-gray-500">
                                    Confidential workspace
                                </p>
                                <h1 className="text-3xl font-semibold">
                                    {project?.name ?? "Project security"}
                                </h1>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                        Owner-only audit view
                    </div>
                </div>

                <section className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-1 h-5 w-5 text-gray-700" />
                        <div>
                            <h2 className="text-xl font-semibold">
                                Confidentiality policy
                            </h2>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                                This workspace is treated as a confidential legal matter.
                                Access, document handling, AI review, and deletion flows
                                are designed to minimize exposure and keep a non-sensitive
                                activity trail for accountable review.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {policyItems.map((item) => (
                            <div
                                key={item.title}
                                className="rounded-2xl border border-gray-200 bg-white p-4"
                            >
                                <h3 className="font-medium">{item.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                    {item.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-3xl border border-gray-200 bg-white p-6">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Audit events</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Latest 50 sensitive project events. Shared members cannot
                                access this ledger.
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">
                            Loading confidentiality audit events…
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="rounded-2xl bg-gray-50 p-6 text-sm text-gray-500">
                            No audit events recorded for this project yet.
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200">
                            <div className="grid grid-cols-[180px_1fr_180px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                <span>Time</span>
                                <span>Action</span>
                                <span>Actor</span>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        className="grid grid-cols-[180px_1fr_180px] gap-4 px-4 py-4 text-sm"
                                    >
                                        <div className="text-gray-500">
                                            {formatTimestamp(event.created_at)}
                                        </div>
                                        <div>
                                            <div className="font-medium capitalize">
                                                {actionLabel(event.action)}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {event.target_type}
                                                {event.target_id
                                                    ? ` · ${event.target_id}`
                                                    : ""}
                                            </div>
                                            <div className="mt-2 line-clamp-2 text-xs text-gray-500">
                                                {formatMetadata(event.metadata)}
                                            </div>
                                        </div>
                                        <div className="truncate text-gray-600">
                                            {event.actor_email ??
                                                event.actor_user_id ??
                                                "Unknown"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
