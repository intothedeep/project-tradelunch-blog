import { SignIn } from '@clerk/nextjs';

// cacheComponents (CC-U4): one sample (the bare `/sign-in`) so the shell
// prerenders with known params; sub-paths of the Clerk flow render on request.
export function generateStaticParams() {
    return [{ 'sign-in': [] }];
}

export default function SignInPage() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <SignIn />
        </div>
    );
}
