'use client';

import { use, useRef, useState } from 'react';
import { FeaturedPostCard } from '@/app/blog/components/FeaturedPostCard.server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TPaginatedResponse } from '@/apis/blog.types';

// ============================================================================
// FeaturedPostsCarousel Component
// ============================================================================

interface FeaturedPostsCarouselProps {
    data: Promise<TPaginatedResponse>;
}

export const FeaturedPostsCarouselClient: React.FC<
    FeaturedPostsCarouselProps
> = ({ data }) => {
    const { posts } = use(data);

    const [currentSlide, setCurrentSlide] = useState(0);
    const carouselRef = useRef<HTMLDivElement>(null);

    const scrollToSlide = (index: number) => {
        if (carouselRef.current) {
            const slideWidth = carouselRef.current.offsetWidth;
            carouselRef.current.scrollTo({
                left: slideWidth * index,
                behavior: 'smooth',
            });
            setCurrentSlide(index);
        }
    };

    const nextSlide = () => {
        const next = (currentSlide + 1) % posts.length;
        scrollToSlide(next);
    };

    const prevSlide = () => {
        const prev = (currentSlide - 1 + posts.length) % posts.length;
        scrollToSlide(prev);
    };

    return (
        <Card className="bg-card border-primary">
            <CardHeader className="p-3 sm:p-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-primary text-sm sm:text-base">
                        &gt; FEATURED_POSTS
                    </CardTitle>

                    <div className="flex gap-2">
                        <button
                            onClick={prevSlide}
                            className="w-8 h-8 border border-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            aria-label="Previous"
                        >
                            ‹
                        </button>

                        <button
                            onClick={nextSlide}
                            className="w-8 h-8 border border-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                            aria-label="Next"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-6 pt-0">
                <div className="relative overflow-hidden">
                    <div
                        ref={carouselRef}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4"
                        style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                        }}
                    >
                        {posts.map((post, idx) => (
                            <div
                                key={idx}
                                className="flex-shrink-0 w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] snap-start"
                            >
                                <FeaturedPostCard post={post} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-center gap-2 mt-4">
                    {posts.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => scrollToSlide(idx)}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                currentSlide === idx
                                    ? 'bg-primary'
                                    : 'bg-primary/30'
                            }`}
                            aria-label={`Go to slide ${idx + 1}`}
                        />
                    ))}
                </div>
            </CardContent>

            {/* styled-jsx directives: `jsx`/`global` are consumed by the
                styled-jsx Babel transform, not real DOM props. */}
            {/* eslint-disable react/no-unknown-property */}
            <style
                // @ts-expect-error styled-jsx jsx/global props are not typed
                jsx
                global
            >{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
            {/* eslint-enable react/no-unknown-property */}
        </Card>
    );
};
