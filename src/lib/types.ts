export interface MarketData {
    productCode: string;
    productName: string;
    upperPrice: string;
    middlePrice: string;
    lowerPrice: string;
    averagePrice: string;
    transactionVolume: string;
}

export interface ScrapeResponse {
    status: 'fresh' | 'backup' | 'error';
    date: string;
    type: string;
    data: MarketData[];
    message?: string;
    backupDate?: string;
}
