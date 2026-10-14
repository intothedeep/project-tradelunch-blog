import { FeedListSkeleton } from '@/components/blog/FeedListSkeleton';

// Home feed placeholder; sits inside the (feed) layout so the shell stays put.
export default function Loading() {
    return <FeedListSkeleton />;
}
