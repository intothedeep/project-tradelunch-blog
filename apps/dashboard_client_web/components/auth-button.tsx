'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';

type AuthButtonProps = { signInClassName?: string };

export function AuthButton({ signInClassName }: AuthButtonProps) {
    const { isSignedIn, isLoaded } = useUser();

    if (!isLoaded) return <div className="w-9 h-9" aria-hidden />;
    if (isSignedIn) return <UserButton />;

    return (
        <SignInButton mode="modal">
            <button className={signInClassName}>SIGN IN</button>
        </SignInButton>
    );
}
