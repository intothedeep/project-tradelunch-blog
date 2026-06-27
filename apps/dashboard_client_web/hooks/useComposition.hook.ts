// hooks/useComposition.hook.ts
// Purpose: track IME (e.g. Korean Hangul) composition on an input/textarea so
// side effects can be gated until a character is committed. During composition
// the IME owns the caret and a partial value; flushing previews or mutating the
// selection mid-composition duplicates the trailing jamo and jumps the cursor.
// Constraints: client-only, generic. Exposes a synchronous ref for reads inside
// event handlers plus boolean state for components that must re-render on end.

'use client';

import { useCallback, useRef, useState } from 'react';

interface CompositionState {
    isComposing: boolean;
    isComposingRef: React.RefObject<boolean>;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
}

export function useComposition(): CompositionState {
    const [isComposing, setIsComposing] = useState(false);
    const isComposingRef = useRef(false);

    const onCompositionStart = useCallback(() => {
        isComposingRef.current = true;
        setIsComposing(true);
    }, []);

    const onCompositionEnd = useCallback(() => {
        isComposingRef.current = false;
        setIsComposing(false);
    }, []);

    return {
        isComposing,
        isComposingRef,
        onCompositionStart,
        onCompositionEnd,
    };
}
