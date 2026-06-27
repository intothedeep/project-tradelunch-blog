// i18n.ts

// export default getRequestConfig(async ({ locale }: { locale?: string }) => {
//     console.log('>>> next-intl config');

//     if (!locale || !locales.includes(locale)) notFound();

//     const commonMessages = (await import(`./messages/${locale}/common.json`))
//         .default;
//     const homeMessages = (await import(`./messages/${locale}/home.json`))
//         .default;

//     return {
//         locale,
//         messages: {
//             ...commonMessages,
//             ...homeMessages,
//         },
//     };
// });

export {};
