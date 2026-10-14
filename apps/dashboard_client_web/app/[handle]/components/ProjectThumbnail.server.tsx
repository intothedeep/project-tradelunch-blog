import Image from 'next/image';
import { CDN_ASSETS } from '@/env.schema';
import { cn } from '@/lib/utils';

type Props = {
    storedUri: string | null;
    alt: string;
    className?: string;
    // Above-the-fold image (LCP candidate): eager load + preload. First 1-2 only.
    priority?: boolean;
};

// stored_uri is normally an absolute URL; only a legacy bare key gets the CDN
// prefix (same rule as RecentPostCard). Null renders an empty placeholder box.
export const ProjectThumbnail = ({
    storedUri,
    alt,
    className,
    priority = false,
}: Props) => {
    const src = storedUri
        ? /^https?:\/\//.test(storedUri)
            ? storedUri
            : `${CDN_ASSETS}/${storedUri}`
        : null;

    return (
        <div className={cn('relative overflow-hidden bg-muted', className)}>
            {src ? (
                <Image
                    src={src}
                    alt={alt}
                    fill
                    priority={priority}
                    sizes="(max-width: 768px) 100vw, 320px"
                    className="object-cover"
                />
            ) : null}
        </div>
    );
};

export default ProjectThumbnail;
