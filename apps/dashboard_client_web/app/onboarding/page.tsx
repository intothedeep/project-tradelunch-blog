'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMe } from '@/hooks/useMe.query.client';
import { useClaimUsername } from '@/hooks/useClaimUsername.query.client';
import { UsernameClaimError } from '@/apis/postUsername.api';
import { cn } from '@/lib/utils';

// Resolve an inline error message from a claim failure. Prefers the server's
// message; falls back to a localized default keyed off the HTTP status.
const toInlineError = (err: unknown): string => {
    if (err instanceof UsernameClaimError) {
        if (err.message) return err.message;
        if (err.status === 409) return '이미 사용 중인 이름입니다';
        if (err.status === 400) return '사용할 수 없는 이름입니다';
    }
    return '문제가 발생했습니다. 다시 시도해주세요.';
};

export default function OnboardingPage() {
    const router = useRouter();
    const { data: me, isLoading } = useMe();
    const claim = useClaimUsername();

    const [username, setUsername] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Already onboarded → straight to their blog.
    useEffect(() => {
        if (me?.username) {
            router.replace(`/blog/@${me.username}`);
        }
    }, [me?.username, router]);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const trimmed = username.trim();
        if (!trimmed) {
            setError('사용자 이름을 입력해주세요.');
            return;
        }

        try {
            const result = await claim.mutateAsync(trimmed);
            router.replace(`/blog/@${result.username}`);
        } catch (err) {
            setError(toInlineError(err));
        }
    };

    // While resolving the profile or redirecting an onboarded user, hold render.
    if (isLoading || me?.username) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center font-mono text-sm text-muted-foreground">
                &gt; loading...
            </div>
        );
    }

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md border-2 border-primary bg-card p-6 font-mono">
                <h1 className="mb-2 text-2xl text-primary terminal-glow">
                    &gt; CHOOSE USERNAME
                </h1>
                <p className="mb-6 text-sm text-muted-foreground">
                    블로그 주소로 사용할 사용자 이름을 정해주세요.
                </p>

                <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                >
                    <div>
                        <label
                            htmlFor="username"
                            className="mb-1 block text-xs text-muted-foreground"
                        >
                            USERNAME
                        </label>
                        <div className="flex items-center border-2 border-primary/50 focus-within:border-primary">
                            <span className="select-none px-3 text-primary">
                                @
                            </span>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="off"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-transparent py-2 pr-3 text-sm outline-none"
                                placeholder="username"
                            />
                        </div>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={claim.isPending}
                        className={cn(
                            'w-full border-2 border-primary px-4 py-2 text-sm transition-colors',
                            'hover:bg-primary hover:text-primary-foreground',
                            'disabled:cursor-not-allowed disabled:opacity-50'
                        )}
                    >
                        {claim.isPending ? 'CLAIMING...' : 'CLAIM USERNAME'}
                    </button>
                </form>
            </div>
        </div>
    );
}
