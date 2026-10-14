import { Spinner } from '@/components/ui/spinner';
import clsx from 'clsx';

export default function Loading() {
    return (
        <div
            className={clsx(
                'prose max-w-2xl mx-auto p-4 flex justify-center items-center h-64'
            )}
        >
            <Spinner className="size-8" />
        </div>
    );
}
