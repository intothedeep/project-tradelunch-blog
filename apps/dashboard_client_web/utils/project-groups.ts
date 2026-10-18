import type { TProjectCard } from '@repo/types';
import { projectsPath } from '@/utils/routes';

// Group URLs do not exist (§12.2); a group is an anchor on the projects page.
export const groupAnchorPath = (username: string, group: string): string =>
    `${projectsPath(username)}#${group}`;

export type TProjectSection = {
    group: string | null; // null = the ungrouped section
    projects: TProjectCard[];
};

// Sections in input order (the server sorts groups). Ungrouped cards form one
// section placed last; a section never has zero cards.
export function groupProjectCards(cards: TProjectCard[]): TProjectSection[] {
    const byGroup = new Map<string, TProjectCard[]>();
    const ungrouped: TProjectCard[] = [];
    for (const card of cards) {
        if (card.group === null) {
            ungrouped.push(card);
            continue;
        }
        const bucket = byGroup.get(card.group);
        if (bucket) bucket.push(card);
        else byGroup.set(card.group, [card]);
    }
    const sections: TProjectSection[] = [...byGroup].map(
        ([group, projects]) => ({ group, projects })
    );
    if (ungrouped.length > 0) {
        sections.push({ group: null, projects: ungrouped });
    }
    return sections;
}
