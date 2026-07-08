export interface IPricePoint {
    time: string;
    value: number;
}

export interface IItemHistory {
    label: string;
    points: IPricePoint[];
}

export interface IDashboardHistory {
    [label: string]: IPricePoint[];
}

export interface IOHLCPoint {
    time: string | number; // ISO date "YYYY-MM-DD" for daily+, UTCTimestamp seconds for intraday
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface IItemOHLCHistory {
    label: string;
    candles: IOHLCPoint[];
}

export interface IDashboardOHLCHistory {
    [label: string]: IOHLCPoint[];
}
