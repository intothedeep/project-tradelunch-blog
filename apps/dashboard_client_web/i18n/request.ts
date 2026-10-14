import { getRequestConfig } from 'next-intl/server';

import en_common from '../messages/en/common.json';
import en_blog from '../messages/en/blog.json';
import en_write from '../messages/en/write.json';
import ko_common from '../messages/ko/common.json';
import ko_blog from '../messages/ko/blog.json';
import ko_write from '../messages/ko/write.json';

// Define the specific locales supported by the application as a union type.
// This provides stronger type safety than relying solely on `next-intl`'s generic `Locale` type (which might be just `string`).
type AppLocale = 'en' | 'ko';

// The `locales` array holds our `AppLocale`s.
// We don't need `as const` here if we explicitly type the array elements.
const locales: AppLocale[] = ['en', 'ko'];

// Define the structure of the messages for a single locale.
// This assumes that all `common.json` files have the same structure, and similarly for `blog.json`.
type LocaleMessages = {
    common: typeof en_common;
    blog: typeof en_blog;
    write: typeof en_write;
};

// Explicitly type the `messages` object using `Record<AppLocale, LocaleMessages>`.
// This ensures that TypeScript knows the exact structure of the messages for each locale,
// and provides type safety when accessing `messages` with an `AppLocale` key.
const messages: Record<AppLocale, LocaleMessages> = {
    en: { common: en_common, blog: en_blog, write: en_write },
    ko: {
        common: {
            ...en_blog,
            ...ko_common,
        },
        blog: {
            ...en_blog,
            ...ko_blog,
        },
        write: {
            ...en_write,
            ...ko_write,
        },
    },
};

export default getRequestConfig(async ({ locale }) => {
    // The incoming `locale` is a `string`. We check if it's one of our `AppLocale`s.
    // If not, we fallback to 'en'.
    // We use a type assertion `locale as AppLocale` for the `includes` check because `locales` expects `AppLocale`.
    const resolvedLocale: AppLocale = locales.includes(locale as AppLocale)
        ? (locale as AppLocale)
        : 'en';

    return {
        locale: resolvedLocale,
        messages: messages[resolvedLocale],
    };
});
