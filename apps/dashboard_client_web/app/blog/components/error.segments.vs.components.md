Next.js의 `error.tsx`는 **route segment** 레벨에서만 동작합니다. 현재 문제는 **component 레벨**에서 발생하므로 `error.tsx`가 catch하지 못합니다.

## 문제 분석

```
app/blog/layout.tsx          ← 여기서 error 발생
app/blog/error.tsx            ← route 레벨 (catch 못함)

```

`error.tsx`는 해당 route의 **page.tsx**나 **하위 route**에서 발생한 error만 catch합니다. **같은 레벨의 layout.tsx**에서 발생한 error는 catch하지 못합니다.

## 해결 방법

### Option 1: Component Error Boundary 사용 (권장)

```tsx
// app/blog/layout.tsx
import { ErrorBoundary } from '@/app/blog/ErrorBoundary.client';

export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    const dataPromise = getCategoriesByUsername('taeklim');

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="container mx-auto p-2 sm:p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                    <aside className={cn('order-1', 'lg:col-span-1')}>
                        <div
                            className={cn(
                                'space-y-0 lg:space-y-4',
                                'lg:sticky lg:top-4'
                            )}
                        >
                            <ErrorBoundary>
                                <Suspense
                                    fallback={<div>loading categories...</div>}
                                >
                                    <CategorySidebar data={dataPromise} />
                                </Suspense>
                            </ErrorBoundary>

                            <RightTechStackCard />
                        </div>
                    </aside>

                    <main
                        className={cn(
                            'order-2',
                            'space-y-4 md:space-y-6',
                            'lg:col-span-3'
                        )}
                    >
                        {children}
                    </main>
                </div>
            </div>

            <ScrollToTopButton />
        </div>
    );
};
```

### Option 2: 상위 레벨로 이동

```
app/blog/layout.tsx           ← getCategoriesByUsername 호출
app/error.tsx                 ← 이 레벨에서 catch

```

상위 `app/error.tsx`가 있다면 catch 가능합니다.

### Option 3: CategorySidebar를 Client Component로 분리

```tsx
// app/blog/layout.tsx
export const BlogMainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="container mx-auto p-2 sm:p-4 md:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                    <aside className={cn('order-1', 'lg:col-span-1')}>
                        <div
                            className={cn(
                                'space-y-0 lg:space-y-4',
                                'lg:sticky lg:top-4'
                            )}
                        >
                            <CategorySidebarWrapper />
                            <RightTechStackCard />
                        </div>
                    </aside>

                    <main
                        className={cn(
                            'order-2',
                            'space-y-4 md:space-y-6',
                            'lg:col-span-3'
                        )}
                    >
                        {children}
                    </main>
                </div>
            </div>

            <ScrollToTopButton />
        </div>
    );
};
```

```tsx
// app/blog/CategorySidebarWrapper.client.tsx
'use client';

import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { CategorySidebar } from '@/app/blog/CategorySidebar.client';
import { Suspense, use } from 'react';

export const CategorySidebarWrapper = () => {
    const dataPromise = getCategoriesByUsername('taeklim');

    return (
        <Suspense fallback={<div>loading categories...</div>}>
            <CategorySidebar data={dataPromise} />
        </Suspense>
    );
};
```

이제 `app/blog/error.tsx`가 catch합니다.

## 권장 구조

```tsx
// Component 레벨 격리 (Option 1)
<ErrorBoundary>
    <Suspense>
        <CategorySidebar />
    </Suspense>
</ErrorBoundary>
```

**Why**:

- Sidebar error가 main content에 영향 없음
- 세밀한 error 제어 가능
- layout.tsx는 Server Component로 유지

## Next.js Error Handling 규칙

1. `error.tsx`: 같은 레벨 `page.tsx` + 하위 segments
2. `layout.tsx` error는 상위 레벨 `error.tsx`가 catch
3. Component 레벨 error는 Error Boundary 필요
