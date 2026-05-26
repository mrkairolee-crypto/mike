"use client";

import { use } from "react";
import { ProjectSecurityPage } from "@/app/components/projects/ProjectSecurityPage";

interface Props {
    params: Promise<{ id: string }>;
}

export default function ProjectSecurityRoute({ params }: Props) {
    const { id } = use(params);
    return <ProjectSecurityPage projectId={id} />;
}
