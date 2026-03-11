'use client';

import { ICommodityData } from '@/apis/getFinancialData.mock.api';
import { GridCard } from './GridCard.client';
import { Area, AreaChart, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
} from '@/components/ui/chart';

const chartConfig = {
    price: {
        label: 'Price',
        color: 'hsl(var(--primary))',
    },
} satisfies ChartConfig;

interface CommodityWidgetProps {
    data: ICommodityData;
}

export function CommodityWidget({ data }: CommodityWidgetProps) {
    const sparkData = data.sparkline.map((value, idx) => ({ idx, price: value }));
    const isPositive = data.change >= 0;

    return (
        <GridCard title={`${data.name} (${data.symbol})`}>
            <div className="flex items-center justify-between px-3 pt-1">
                <div>
                    <div className="text-2xl font-bold tabular-nums">
                        ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <div className={`text-xs font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{data.change}%
                    </div>
                </div>
            </div>
            <ChartContainer config={chartConfig} className="h-[60px] w-full mt-1">
                <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={`grad-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis domain={['dataMin', 'dataMax']} hide />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke={isPositive ? '#22c55e' : '#ef4444'}
                        fill={`url(#grad-${data.symbol})`}
                        strokeWidth={1.5}
                        dot={false}
                    />
                </AreaChart>
            </ChartContainer>
        </GridCard>
    );
}
