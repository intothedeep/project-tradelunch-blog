import { BlogContentShell } from '@/app/blog/components/BlogContentShell.server';
import { stripUsernameAt } from '@/utils/blog-author';

// Username-DEPENDENT blog chrome. Lives at the [username] segment so it can
// read params.username and thread it into the category sidebar.
type Props = {
    children: React.ReactNode;
    params: Promise<{ username: string }>;
};

export default async function BlogUsernameLayout({ children, params }: Props) {
    const { username } = await params;
    const decoded = decodeURIComponent(username);

    return (
        <BlogContentShell username={stripUsernameAt(decoded)}>
            {children}
        </BlogContentShell>
    );
}
