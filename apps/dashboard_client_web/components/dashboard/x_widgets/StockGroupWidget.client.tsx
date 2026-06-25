'use client';

import { IStockGroup } from '@/apis/getFinancialData.mock.api';
import { GridCard } from './GridCard.client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface StockGroupWidgetProps {
    data: IStockGroup;
}

export function StockGroupWidget({ data }: StockGroupWidgetProps) {
    return (
        <GridCard title={data.groupName}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Chg</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.stocks.map((stock) => {
                        const isPositive = stock.change >= 0;
                        return (
                            <TableRow key={stock.ticker}>
                                <TableCell className="font-medium">
                                    <div>{stock.ticker}</div>
                                    <div className="text-[10px] text-muted-foreground">{stock.name}</div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-bold">
                                    ${stock.price.toFixed(2)}
                                </TableCell>
                                <TableCell className={`text-right tabular-nums ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}{stock.change}%
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </GridCard>
    );
}
