// Purpose: augment Express.Request with the resolved auth identity.
// Invariant: `auth` is set only after requireAuth/optionalAuth resolves a
//            provisioned users row; absence means anonymous.
// Side effects: none (ambient declaration only).

declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId: number;
                username: string;
                isAdmin: boolean;
            };
        }
    }
}

export {};
