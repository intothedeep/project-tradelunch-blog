import { NextResponse, NextRequest } from 'next/server';

const locales = ['en', 'ko'];

export default function middleware(req: NextRequest) {
    console.log('>>> middleware:: locale');

    const { cookies, headers } = req;
    const res = NextResponse.next();

    // 이미 locale 쿠키가 있으면 그대로 유지
    const savedLocale = cookies.get('locale')?.value;
    if (savedLocale) {
        res.cookies.set('locale', savedLocale, { path: '/' });
        return res;
    }

    // 브라우저 언어 감지
    const acceptLang = headers.get('accept-language') || '';
    const detectedRaw = acceptLang.split(',')[0]?.split('-')[0]; // ex. en-US -> en
    const detected = typeof detectedRaw === 'string' ? detectedRaw : '';

    const locale: string = ['en', 'ko'].includes(detected) ? detected : 'en';

    // 쿠키에 저장 (SSR 전역 접근 가능)
    res.cookies.set('locale', locale, { path: '/' });
    return res;
}

export const config = {
    matcher: ['/((?!_next|api|.*\\..*).*)'],
};

// middleware.ts
// import createMiddleware from 'next-intl/middleware';

// export default createMiddleware({
//     locales: ['en', 'ko'],
//     defaultLocale: 'en',
//     localeDetection: true, // 브라우저 언어 감지
// });

// export const config = {
//     matcher: ['/((?!_next|api|favicon.ico).*)'],
// };
