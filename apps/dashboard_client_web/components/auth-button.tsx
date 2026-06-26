'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { CircleUserRound } from 'lucide-react';

type AuthButtonProps = { signInClassName?: string; showName?: boolean };

// Default icon-button style for the signed-out avatar trigger.
const DEFAULT_SIGN_IN_CLASS =
    'flex h-9 w-9 items-center justify-center border border-transparent hover:border-primary hover:bg-primary hover:text-primary-foreground transition-colors';

export function AuthButton({
    signInClassName = DEFAULT_SIGN_IN_CLASS,
    showName = false,
}: AuthButtonProps) {
    const { isSignedIn, isLoaded } = useUser();

    if (!isLoaded) return <div className="w-9 h-9" aria-hidden />;
    if (isSignedIn) return <UserButton showName={showName} />;

    return (
        <SignInButton mode="modal">
            <button className={signInClassName} aria-label="Sign in">
                <CircleUserRound className="h-6 w-6" />
            </button>
        </SignInButton>
    );
}
