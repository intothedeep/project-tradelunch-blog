import { SignIn } from '@clerk/nextjs';

// Clerk catch-all sign-in route. Public (see proxy.ts isPublicRoute) so the
// auth gate can redirect unauthenticated users here without a loop.
export default function SignInPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-8">
            <SignIn />
        </div>
    );
}
