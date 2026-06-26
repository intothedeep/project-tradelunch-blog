import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { FeaturedPost } from '@/apis/blog.types';

// ============================================================================
// FeaturedPostCard Component
// ============================================================================

interface FeaturedPostCardProps {
    post: FeaturedPost;
}

export const FeaturedPostCard: React.FC<FeaturedPostCardProps> = ({ post }) => {
    return (
        <Card
            className={cn(
                'bg-secondary border-primary/30 hover:border-primary transition-colors cursor-pointer group h-full',
                'overflow-hidden'
            )}
        >
            <div className="aspect-video bg-muted relative overflow-hidden border-b border-primary/30">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                    <div className="text-center p-4">
                        <div className="text-4xl sm:text-5xl mb-2">📄</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 px-2">
                            {post.title}
                        </div>
                    </div>
                </div>
            </div>

            <CardContent className="p-3 sm:p-4">
                <Badge
                    variant="outline"
                    className="mb-2 text-xs"
                >
                    {post.category}
                </Badge>

                <h3 className="font-bold text-xs sm:text-sm mb-2 line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
                    {post.title}
                </h3>

                <p className="text-xs text-muted-foreground mb-2 truncate">
                    {post.author}
                </p>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                    <span>👁 {post.views}</span>
                    {post.comments && <span>💬 {post.comments}</span>}
                    {post.reposts && <span>🔄 {post.reposts}</span>}
                </div>
            </CardContent>
        </Card>
    );
};
