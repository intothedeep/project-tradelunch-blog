import { redirect } from 'next/navigation';

// `/blog` has no index of its own — send visitors to the global feed at `/`.
// Does not affect `/blog/[username]` (handled by the [username] segment).
export default function BlogIndex() {
    redirect('/');
}
