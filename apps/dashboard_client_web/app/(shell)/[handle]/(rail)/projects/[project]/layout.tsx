import { Suspense } from 'react';
import { ProjectGate } from '@/components/projects/ProjectGate.server';
import { CC_SAMPLE_PROJECT } from '@/env.schema';
import { stripUsernameAt } from '@/utils/blog-author';

// cacheComponents (CC-U4): sample project for the shell prerender (env.schema).
// The `handle` sample comes from the parent layout.
export function generateStaticParams() {
    return [{ project: CC_SAMPLE_PROJECT }];
}

// 404 gate for an unknown project. Under cacheComponents a layout cannot await
// uncached data above every Suspense boundary, so the gate is a Suspense leaf
// (ProjectGate): the view becomes the 404 page, the HTTP status stays 200.
// Backup defense only: proxy.ts (#97, #103) decides the real 404 before render.
type Props = {
    children: React.ReactNode;
    params: Promise<{ handle: string; project: string }>;
};

export default async function ProjectLayout({ children, params }: Props) {
    const { handle, project } = await params;
    return (
        <>
            <Suspense fallback={null}>
                <ProjectGate
                    username={stripUsernameAt(decodeURIComponent(handle))}
                    project={decodeURIComponent(project)}
                />
            </Suspense>
            {children}
        </>
    );
}
