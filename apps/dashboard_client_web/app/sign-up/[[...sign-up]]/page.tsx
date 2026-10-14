import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <SignUp forceRedirectUrl="/onboarding" />
        </div>
    );
}
