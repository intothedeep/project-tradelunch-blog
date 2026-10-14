// Author URL builders (Phase PJ). One place for the `/@u/...` shapes so link
// sites never hand-write them. Pure. `u` is a raw username with or without a
// leading '@'; the '@' stays literal in the URL and only the name is encoded.
const handleOf = (u: string): string =>
    `@${encodeURIComponent(u.startsWith('@') ? u.slice(1) : u)}`;

export function postsPath(u: string): string {
    return `/${handleOf(u)}/posts`;
}

export function postPath(u: string, slug: string): string {
    return `/${handleOf(u)}/${slug}`;
}

export function projectsPath(u: string): string {
    return `/${handleOf(u)}/projects`;
}

export function projectPath(u: string, project: string): string {
    return `/${handleOf(u)}/projects/${encodeURIComponent(project)}`;
}

export function aboutPath(u: string): string {
    return `/${handleOf(u)}/about`;
}

export function resumePath(u: string): string {
    return `/${handleOf(u)}/resume`;
}

export function mePath(u: string): string {
    return `/${handleOf(u)}/me`;
}

export function savedPath(u: string): string {
    return `/${handleOf(u)}/saved`;
}

export function logsPath(u: string): string {
    return `/${handleOf(u)}/logs`;
}

export function logPath(u: string, logId: string): string {
    return `/${handleOf(u)}/logs/${encodeURIComponent(logId)}`;
}
