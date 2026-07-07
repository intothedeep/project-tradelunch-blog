import { SITE_URL } from '@/env.schema';

// TODO(seo): owner to supply X/Twitter profile URL for Person.sameAs (knowledge-graph signal)
const SOCIAL_LINKS: string[] = [
    'https://www.linkedin.com/in/tiotaeklim/',
    'https://github.com/tradelunch',
];

function toAbsolute(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function buildWebSiteLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Taek Lim',
        url: SITE_URL,
    };
}

export function buildPersonLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Taek Lim',
        url: SITE_URL,
        jobTitle: 'Software Engineer',
        sameAs: SOCIAL_LINKS,
    };
}

export function buildBreadcrumbLd(
    items: { name: string; url: string }[]
): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: toAbsolute(item.url),
        })),
    };
}

export function buildBlogPostingLd(input: {
    title: string;
    description: string;
    url: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
    authorName: string;
}): object {
    const absoluteUrl = toAbsolute(input.url);
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: input.title,
        description: input.description,
        url: absoluteUrl,
        mainEntityOfPage: absoluteUrl,
        ...(input.image ? { image: toAbsolute(input.image) } : {}),
        ...(input.datePublished ? { datePublished: input.datePublished } : {}),
        ...(input.dateModified ? { dateModified: input.dateModified } : {}),
        author: {
            '@type': 'Person',
            name: input.authorName,
        },
    };
}

export function buildProfilePageLd(): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: buildPersonLd(),
    };
}

export function buildDatasetLd(input: {
    name: string;
    description: string;
    url: string;
    creator?: string;
    temporalCoverage?: string;
    isBasedOnUrl?: string;
}): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: input.name,
        description: input.description,
        url: toAbsolute(input.url),
        ...(input.creator
            ? {
                  creator: {
                      '@type': 'Organization',
                      name: input.creator,
                  },
              }
            : {}),
        ...(input.temporalCoverage
            ? { temporalCoverage: input.temporalCoverage }
            : {}),
        ...(input.isBasedOnUrl
            ? { isBasedOn: input.isBasedOnUrl, sameAs: input.isBasedOnUrl }
            : {}),
    };
}
