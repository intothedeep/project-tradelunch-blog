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

export function TreasuryWidget() {
    const { data, isLoading, isError } = useFinancialDataQuery();

    if (isLoading) return <GridCard title="U.S. Treasuries"><p className="p-4 text-sm text-muted-foreground">Loading...</p></GridCard>;
    if (isError || !data) return <GridCard title="U.S. Treasuries"><p className="p-4 text-sm text-red-500">Error loading data</p></GridCard>;

    return (
        <GridCard title="U.S. Treasuries">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Maturity</TableHead>
                        <TableHead className="text-right">Yield</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.treasuries.map((item) => (
                        <TableRow key={item.maturity}>
                            <TableCell className="font-medium">{item.maturity}</TableCell>
                            <TableCell className="text-right font-bold">{item.yield.toFixed(2)}%</TableCell>
                            <TableCell className={`text-right ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {item.change > 0 ? '+' : ''}{item.change}%
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </GridCard>
    );
}
