import { getRequestConfig } from 'next-intl/server';

import en_common from '../messages/en/common.json';
import ko_common from '../messages/ko/common.json';

// Supported locales as a union for stronger typing than next-intl's generic Locale.
type AppLocale = 'en' | 'ko';
const locales: AppLocale[] = ['en', 'ko'];

// One namespace per file; add finance domains (dashboard/funds/…) as the UI moves
// in P3. Mirrors dashboard_client_web's messages/{locale}/<namespace>.json shape.
type LocaleMessages = {
    common: typeof en_common;
};

const messages: Record<AppLocale, LocaleMessages> = {
    en: { common: en_common },
    ko: { common: ko_common },
};

export default getRequestConfig(async ({ locale }) => {
    // finance_web has no i18n routing; locale comes from the `locale` cookie the
    // proxy will set (P3). Unknown/absent → fall back to 'en'.
    const resolvedLocale: AppLocale = locales.includes(locale as AppLocale)
        ? (locale as AppLocale)
        : 'en';

    return {
        locale: resolvedLocale,
        messages: messages[resolvedLocale],
    };
});
