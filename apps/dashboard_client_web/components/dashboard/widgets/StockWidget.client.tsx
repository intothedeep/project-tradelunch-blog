'use client';

import { IStockData } from '@/apis/getFinancialData.mock.api';
import { GridCard } from './GridCard.client';

interface StockWidgetProps {
    data: IStockData;
}

export function StockWidget({ data }: StockWidgetProps) {
    const isPositive = data.change >= 0;

    return (
        <GridCard title={data.ticker}>
            <div className="flex flex-col gap-1 px-3 pt-1">
                <div className="text-xs text-muted-foreground truncate">
                    {data.name}
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tabular-nums">
                        ${data.price.toFixed(2)}
                    </span>
                    <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{data.change}%
                    </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                    Vol: {data.volume}
                </div>
            </div>
        </GridCard>
    );
}
