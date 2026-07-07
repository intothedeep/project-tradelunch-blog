import { SignUp } from '@clerk/nextjs';

// Clerk catch-all sign-up route. Public (see proxy.ts isPublicRoute).
export default function SignUpPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-8">
            <SignUp />
        </div>
    );
}
