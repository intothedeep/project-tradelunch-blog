'use client';

import { ICompany13F } from '@/apis/getFinancialData.mock.api';
import { GridCard } from './GridCard.client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface Company13FWidgetProps {
    data: ICompany13F;
}

export function Company13FWidget({ data }: Company13FWidgetProps) {
    return (
        <GridCard title={`13F · ${data.companyName}`}>
            <div className="px-3 pt-1">
                <span className="text-[10px] text-muted-foreground">
                    Report: {data.reportDate} &middot; CIK: {data.cik}
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.holdings.map((h) => (
                        <TableRow key={h.ticker}>
                            <TableCell className="font-medium">
                                <div>{h.ticker}</div>
                                <div className="text-[10px] text-muted-foreground">
                                    {(h.shares / 1_000_000).toFixed(1)}M shs
                                </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {h.marketValue}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold">
                                {h.percentage}%
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </GridCard>
    );
}
