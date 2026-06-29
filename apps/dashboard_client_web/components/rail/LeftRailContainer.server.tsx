// Purpose: SERVER composition site for the left rail. Reads the `railCollapsed`
// cookie (for hydration-correct initial collapse) and passes the async server
// TagCloud — wrapped in Suspense with a chip skeleton — DOWN into the client
// LeftRail as a child (a server component cannot be imported inside a client
// component, but it can be passed as a prop from a server parent).
// Side effects: reads request cookies (next/headers).

import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { LeftRail } from '@/components/rail/LeftRail.client';
import { TagCloud } from '@/components/rail/TagCloud.server';
import { TagCloudSkeleton } from '@/components/rail/TagCloud.skeleton';

export const LeftRailContainer = async () => {
    const cookieStore = await cookies();
    const initialCollapsed = cookieStore.get('railCollapsed')?.value === '1';

    return (
        <LeftRail
            initialCollapsed={initialCollapsed}
            tagCloud={
                <Suspense fallback={<TagCloudSkeleton />}>
                    <TagCloud />
                </Suspense>
            }
        />
    );
};

export default LeftRailContainer;
