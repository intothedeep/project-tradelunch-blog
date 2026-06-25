'use client';

import { useQuery } from '@tanstack/react-query';
import {
    getFinancialMockData,
    IFinancialDashboardData,
} from '@/apis/getFinancialData.mock.api';

export const FINANCIAL_DATA_QUERY_KEY = ['financialDashboardData'];

export function useFinancialDataQuery() {
    return useQuery<IFinancialDashboardData, Error>({
        queryKey: FINANCIAL_DATA_QUERY_KEY,
        queryFn: getFinancialMockData,
        refetchInterval: 30000,
        staleTime: 10000,
    });
}
