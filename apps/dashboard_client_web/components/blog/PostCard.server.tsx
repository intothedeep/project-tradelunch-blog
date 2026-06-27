import Image from 'next/image';
import { TPost } from '@/apis/blog.types';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

type PostCardProps = {
    image: string;
} & TPost;

export function PostCard({ title, content, image }: PostCardProps) {
    return (
        <Card className="flex flex-col overflow-hidden transition hover:bg-secondary">
            <div className="relative w-full flex-shrink-0 overflow-hidden">
                <Image
                    src={image}
                    alt={title ?? 'Post Image'}
                    // fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMjcyNzI3Ii8+PC9zdmc+"
                    width={600}
                    height={600}
                />
            </div>

            <CardHeader className="p-4 pb-2">
                <CardTitle className="truncate text-base font-bold md:text-lg">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 px-4 pb-2">
                <p className="line-clamp-2 text-sm text-muted-foreground">
                    {content}
                </p>
            </CardContent>

            <CardFooter className="flex gap-3 px-4 pb-4">
                <button
                    type="button"
                    className="text-xs font-semibold text-blue-400 transition hover:text-blue-300"
                >
                    Read more
                </button>

                {/* <button
                    type="button"
                    className="text-xs text-zinc-500 transition hover:text-zinc-300"
                >
                    Share
                </button> */}
            </CardFooter>
        </Card>
    );
}
