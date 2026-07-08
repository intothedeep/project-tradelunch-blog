export enum Breakpoints {
    // Mobile = 415, // 0 and above for mobile
    // Tablet = 768, // 767px and above for tablet
    // Desktop = 1060, // 1024px and above for desktop
    XS = 0,
    SM = 480,
    MD = 768,
    LG = 1060,
    XL = 1440,
}

export const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

export const IS_MOBILE_QUERY = `(max-width: ${Breakpoints.MD}px)`;
