import { SignUp } from '@clerk/nextjs';

// cacheComponents (CC-U4): one sample (the bare `/sign-up`), see sign-in.
export function generateStaticParams() {
    return [{ 'sign-up': [] }];
}

export default function SignUpPage() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <SignUp forceRedirectUrl="/onboarding" />
        </div>
    );
}
