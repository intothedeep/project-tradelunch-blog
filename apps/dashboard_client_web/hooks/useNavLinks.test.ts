// Purpose: lock the pure primary-nav builder — it always emits Home/Write/Saved
// and hides "My blog" when there is no resolved username.

import { describe, it, expect } from 'vitest';
import { buildPrimaryNavLinks } from '@/hooks/useNavLinks.hook';

describe('buildPrimaryNavLinks', () => {
    it('emits Home, Write, and Saved', () => {
        const hrefs = buildPrimaryNavLinks('taeklim').map((l) => l.href);
        expect(hrefs).toContain('/');
        expect(hrefs).toContain('/write');
        expect(hrefs).toContain('/me/saved');
    });

    it('includes My blog scoped to the resolved username', () => {
        const myBlog = buildPrimaryNavLinks('taeklim').find(
            (l) => l.title === 'My blog'
        );
        expect(myBlog?.href).toBe('/blog/@taeklim');
    });

    it('emits an enabled "All posts" link to the aggregate feed', () => {
        const allPosts = buildPrimaryNavLinks('taeklim').find(
            (l) => l.href === '/blog'
        );
        expect(allPosts?.title).toBe('All posts');
        expect(allPosts?.disabled).toBeUndefined();
    });

    it.each([null, undefined, '', '   '])(
        'hides My blog when username is %p',
        (username) => {
            const links = buildPrimaryNavLinks(username);
            expect(links.some((l) => l.title === 'My blog')).toBe(false);
            expect(links.every((l) => !l.href.includes('@'))).toBe(true);
        }
    );
});
