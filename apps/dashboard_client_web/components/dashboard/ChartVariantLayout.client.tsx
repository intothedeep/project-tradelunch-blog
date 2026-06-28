'use client';

import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { selectedLabelAtom } from '@/store/dashboard.atom';
import ChartPanel from '@/components/dashboard/ChartPanel.client';
import HistoryTable from '@/components/dashboard/HistoryTable.client';
import type { IDashboardSnapshot } from '@/types/dashboard';
import type { IDashboardOHLCHistory } from '@/types/history';

interface Props {
    snapshot: IDashboardSnapshot;
    history: IDashboardOHLCHistory;
}

export default function ChartVariantLayout({ snapshot, history }: Props) {
    const [selected, setSelected] = useAtom(selectedLabelAtom);

    useEffect(() => {
        if (selected === null) {
            const firstStock = snapshot.stocks.items[0];
            if (firstStock !== undefined) {
                setSelected(firstStock.label);
            }
        }
        // Intentional one-time default selection on mount only; re-running on
        // snapshot/selected changes would clobber the user's manual choice.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex flex-col lg:flex-row lg:h-[100dvh] lg:overflow-hidden bg-white dark:bg-[#131722]">
            <div className="lg:flex-[7] h-[500px] lg:h-full lg:overflow-hidden flex flex-col">
                <ChartPanel history={history} />
            </div>
            <div className="lg:flex-[3] lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-[#e0e3eb] dark:border-[#2a2e39]">
                <HistoryTable snapshot={snapshot} />
            </div>
        </div>
    );
}
