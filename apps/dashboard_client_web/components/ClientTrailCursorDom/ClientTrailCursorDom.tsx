'use client';

import { useTrailingCursorDom } from '@/hooks/useTrailingCursor.hook';

import './ClientTrailCursorDom.scss';

type Props = Record<string, never>;

export const ClientTrailCursorDom: React.FC<Props> = () => {
    useTrailingCursorDom();

    return undefined;
};

export default ClientTrailCursorDom;
