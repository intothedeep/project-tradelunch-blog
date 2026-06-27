'use client';

import { useIsMounted } from '@/hooks/useIsMounted.hook';
import { createTrailDot, MOUSE_MOVE_EVENTS, toPos } from '@/utils/mouseevents';
import { useObservable, useSubscription } from 'observable-hooks';
import { fromEvent, shareReplay, switchMap } from 'rxjs';

export const useTrailingCursorDom = () => {
    const { isMounted$ } = useIsMounted();

    const move$ = useObservable(() => {
        const click$ = isMounted$.pipe(
            switchMap(() => {
                // if (main == null) {
                //     return NEVER;
                // }

                return fromEvent(document, MOUSE_MOVE_EVENTS.move);
            }),
            toPos,
            shareReplay(1)
        );

        return click$;
    });

    useSubscription(move$, ([x, y]: [number, number]) => {
        // console.log("start$:: subscribed:: ", x, y);
        createTrailDot(x, y);
    });
};
