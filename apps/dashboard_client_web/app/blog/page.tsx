import { permanentRedirect } from 'next/navigation';

// `/blog` is gone (#81): `/` is the all-authors feed. next.config.ts redirects
// the exact path at the edge; this stub is the fallback if that rule is missed.
export default function BlogIndex() {
    permanentRedirect('/');
}
