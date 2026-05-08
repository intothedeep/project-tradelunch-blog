export interface IDayChange {
  absolute: number;
  percent: number;
}

export interface IDashboardItem {
  label: string;
  value: number;
  change: IDayChange;
}

export interface IStockItem extends IDashboardItem {
  ticker: string;
  exchange: 'US' | 'KRX';
}

export interface ICategoryMeta {
  asOf: string;
  revalidateSeconds: number;
}

export interface IDashboardSnapshot {
  fetchedAt: string;
  fx:      { meta: ICategoryMeta; items: IDashboardItem[] };
  crypto:  { meta: ICategoryMeta; items: IDashboardItem[] };
  indices: { meta: ICategoryMeta; items: IDashboardItem[] };
  rates:   { meta: ICategoryMeta; items: IDashboardItem[] };
  stocks:  { meta: ICategoryMeta; items: IStockItem[] };
}

export const MA_PERIODS = [5, 20, 50, 100, 200] as const;
export type MAPeriod = (typeof MA_PERIODS)[number];
export type MAArrays = Record<MAPeriod, (number | null)[]>;
export type MAVisibility = Record<MAPeriod, boolean>;

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export interface IchimokuResult {
  tenkan: (number | null)[];
  kijun: (number | null)[];
  senkouA: (number | null)[];
  senkouB: (number | null)[];
  chikou: (number | null)[];
}

export interface IndicatorState {
  maArrays: MAArrays;
  rsiArr: (number | null)[];
  macdResult: MACDResult;
  ichimoku: IchimokuResult;
  maVisible: MAVisibility;
  rsiVisible: boolean;
  macdVisible: boolean;
  ichimokuVisible: boolean;
}
