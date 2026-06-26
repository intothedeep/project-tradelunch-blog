// Purpose: augment Express.Request with the resolved auth identity.
// Invariant: `auth` is set only after requireAuth/optionalAuth resolves a
//            provisioned users row; absence means anonymous. `username` is null
//            for a freshly lazy-provisioned account that has not onboarded yet.
// Side effects: none (ambient declaration only).

declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: number;
                username: string | null;
                isAdmin: boolean;
            };
        }
    }
}

export {};
