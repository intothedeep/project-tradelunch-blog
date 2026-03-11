'use client';

import { useFinancialDataQuery } from '@/hooks/useFinancialData.query.client';
import { GridCard } from './GridCard.client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export function InterestRatesWidget() {
    const { data, isLoading, isError } = useFinancialDataQuery();

    if (isLoading) return <GridCard title="Global Interest Rates"><p className="p-4 text-sm text-muted-foreground">Loading...</p></GridCard>;
    if (isError || !data) return <GridCard title="Global Interest Rates"><p className="p-4 text-sm text-red-500">Error loading data</p></GridCard>;

    return (
        <GridCard title="Global Interest Rates">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.interestRates.map((item) => (
                        <TableRow key={item.country}>
                            <TableCell className="font-medium">{item.country}</TableCell>
                            <TableCell className="text-right font-bold">{item.rate.toFixed(2)}%</TableCell>
                            <TableCell className={`text-right ${item.change >= 0 ? 'text-green-500' : (item.change < 0 ? 'text-red-500' : 'text-muted-foreground')}`}>
                                {item.change > 0 ? '+' : ''}{item.change === 0 ? '0.00' : item.change}%
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </GridCard>
    );
}
