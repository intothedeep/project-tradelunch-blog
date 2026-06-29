import { atom } from 'jotai';
import type { TTocItem } from '@/utils/markdown/toc.types';

// Post-detail table-of-contents bridge. The post page has the slug and extracts
// the TOC server-side (PostContentToc → extractTocParsed); it publishes the items
// here via TocPublisher, and the right-rail RightRailToc reads them so the TOC can
// sit between the profile card and the category section. Stays empty on non-post
// routes (the publisher clears it on unmount), so the author feed shows no TOC.
export const tocItemsAtom = atom<TTocItem[]>([]);
