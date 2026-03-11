'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveGridLayout } from 'react-grid-layout';
import { useElementSize } from '@/hooks/useElementSize.hook';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useFinancialDataQuery } from '@/hooks/useFinancialData.query.client';
import {
    CurrencyWidget,
    CommodityWidget,
    StockWidget,
    StockGroupWidget,
    Company13FWidget,
    InterestRatesWidget,
    TreasuryWidget,
} from './widgets';

export function FinancialGridLayout() {
    const [mounted, setMounted] = useState(false);
    const { data, isLoading, isError } = useFinancialDataQuery();
    const [containerRef, { width: containerWidth }] =
        useElementSize<HTMLDivElement>();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Build layouts & widgets from data
    const { layouts, widgets } = useMemo(() => {
        if (!data) return { layouts: {}, widgets: [] };

        const lgItems: {
            i: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [];
        const mdItems: {
            i: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [];
        const smItems: {
            i: string;
            x: number;
            y: number;
            w: number;
            h: number;
        }[] = [];
        const widgetList: React.ReactNode[] = [];

        let lgCol = 0,
            lgRow = 0;
        let mdCol = 0,
            mdRow = 0;
        let smCol = 0,
            smRow = 0;

        const addWidget = (
            key: string,
            node: React.ReactNode,
            lgW: number,
            lgH: number
        ) => {
            // lg: 12 cols
            lgItems.push({ i: key, x: lgCol, y: lgRow, w: lgW, h: lgH });
            lgCol += lgW;
            if (lgCol >= 12) {
                lgCol = 0;
                lgRow += lgH;
            }

            // md: 8 cols
            const mdW = Math.min(lgW, 4);
            mdItems.push({ i: key, x: mdCol, y: mdRow, w: mdW, h: lgH });
            mdCol += mdW;
            if (mdCol >= 8) {
                mdCol = 0;
                mdRow += lgH;
            }

            // sm: 4 cols
            const smW = 4;
            smItems.push({ i: key, x: smCol, y: smRow, w: smW, h: lgH });
            smCol = 0;
            smRow += lgH;

            widgetList.push(<div key={key}>{node}</div>);
        };

        // Currencies (3 cols each on lg)
        data.currencies.forEach((c) => {
            addWidget(`currency-${c.pair}`, <CurrencyWidget data={c} />, 3, 3);
        });

        // Reset row for next section
        if (lgCol !== 0) {
            lgCol = 0;
            lgRow += 3;
        }
        if (mdCol !== 0) {
            mdCol = 0;
            mdRow += 3;
        }

        // Commodities (3 cols each on lg)
        data.commodities.forEach((c) => {
            addWidget(
                `commodity-${c.symbol}`,
                <CommodityWidget data={c} />,
                3,
                3
            );
        });

        if (lgCol !== 0) {
            lgCol = 0;
            lgRow += 3;
        }
        if (mdCol !== 0) {
            mdCol = 0;
            mdRow += 3;
        }

        // Stocks (3 cols each on lg)
        data.stocks.forEach((s) => {
            addWidget(`stock-${s.ticker}`, <StockWidget data={s} />, 3, 3);
        });

        if (lgCol !== 0) {
            lgCol = 0;
            lgRow += 3;
        }
        if (mdCol !== 0) {
            mdCol = 0;
            mdRow += 3;
        }

        // Stock Groups (6 cols on lg)
        data.stockGroups.forEach((g) => {
            addWidget(
                `group-${g.groupName}`,
                <StockGroupWidget data={g} />,
                6,
                5
            );
        });

        // 13F Reports (6 cols on lg)
        data.companies13F.forEach((c) => {
            addWidget(`13f-${c.cik}`, <Company13FWidget data={c} />, 6, 5);
        });

        if (lgCol !== 0) {
            lgCol = 0;
            lgRow += 5;
        }
        if (mdCol !== 0) {
            mdCol = 0;
            mdRow += 5;
        }

        // Interest Rates & Treasuries
        addWidget('interest', <InterestRatesWidget />, 6, 5);
        addWidget('treasury', <TreasuryWidget />, 6, 5);

        return {
            layouts: { lg: lgItems, md: mdItems, sm: smItems },
            widgets: widgetList,
        };
    }, [data]);

    if (!mounted || isLoading) {
        return (
            <div
                className="w-full"
                ref={containerRef}
            >
                <div className="p-4 text-muted-foreground">
                    Loading dashboard layout...
                </div>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="p-4 text-red-500">
                Failed to load dashboard data.
            </div>
        );
    }

    return (
        <div
            className="w-full overflow-y-scroll"
            ref={containerRef}
        >
            {containerWidth > 0 && (
                <ResponsiveGridLayout
                    className="grid-layout"
                    layouts={layouts}
                    width={containerWidth}
                    breakpoints={{ lg: 1200, md: 768, sm: 0 }}
                    cols={{ lg: 12, md: 8, sm: 4 }}
                    rowHeight={50}
                    margin={[12, 12]}
                    dragConfig={{
                        enabled: true,
                        bounded: false,
                        handle: '.drag-handle',
                        threshold: 3,
                    }}
                    resizeConfig={{
                        enabled: true,
                        handles: ['se'],
                    }}
                >
                    {widgets}
                </ResponsiveGridLayout>
            )}
        </div>
    );
}
