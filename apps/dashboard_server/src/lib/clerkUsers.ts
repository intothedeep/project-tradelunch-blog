// Purpose: isolate the Clerk Backend SDK network I/O — fetch a user's VERIFIED
//          primary email. Used by resolveAuth on first sight to adopt (link) a
//          pre-existing users row by email.
// Invariants: returns the email ONLY when its Clerk verification status is
//             'verified' — an unverified email must never drive row adoption
//             (otherwise an attacker could register a victim's email and hijack
//             their row).
// Side effects: one Clerk Backend API call. Availability-first: ANY failure
//               (network, missing user, no verified email) resolves to null so
//               provisioning falls back to creating a row without an email.
import { createClerkClient } from '@clerk/express';
import { CLERK_SECRET_KEY } from '../config/env.schema';

const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

export async function fetchVerifiedPrimaryEmail(
    clerkUserId: string
): Promise<string | null> {
    try {
        const user = await clerk.users.getUser(clerkUserId);
        const primary =
            user.emailAddresses.find(
                (e) => e.id === user.primaryEmailAddressId
            ) ?? user.emailAddresses[0];
        if (!primary || primary.verification?.status !== 'verified') {
            return null;
        }
        return primary.emailAddress ?? null;
    } catch {
        return null;
    }
}
