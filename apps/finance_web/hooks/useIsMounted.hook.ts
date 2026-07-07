import { pluckFirst, useObservable, useSubscription } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { fromEvent, NEVER, share, switchMap } from 'rxjs';

export const useIsMounted = () => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const isMounted$ = useObservable(
        (inputs$) => {
            return inputs$.pipe(pluckFirst, share());
        },
        [isMounted]
    );

    useSubscription(isMounted$, (isMounted) => {
        console.log('mounted? ', isMounted);
    });

    const DOMContentLoaded$ = useObservable(() => {
        return isMounted$.pipe(
            switchMap((isMounted) => {
                if (!isMounted) {
                    return NEVER;
                }

                return fromEvent(document, 'DOMContentLoaded');
            })
        );
    });

    return {
        isMounted,
        isMounted$,
        DOMContentLoaded$,
    };
};
