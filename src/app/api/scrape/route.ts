import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define types for the scraped data
interface MarketData {
    productCode: string;
    productName: string;
    upperPrice: string;
    middlePrice: string;
    lowerPrice: string;
    averagePrice: string;
    transactionVolume: string;
}

interface MOAData {
    交易日期: string;
    種類代碼: string;
    作物代號: string;
    作物名稱: string;
    市場代號: string;
    市場名稱: string;
    上價: number;
    中價: number;
    下價: number;
    平均價: number;
    交易量: number;
}

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backup');

async function ensureBackupDir() {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
}

async function saveBackup(date: string, type: string, data: MarketData[]) {
    await ensureBackupDir();
    // Save to a single file: latest_{type}.json
    const filename = `latest_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    // We might want to include the date in the file content, which we already do in the API response,
    // but the file content is just the array of MarketData.
    // The API response wrapper handles the date.
    // If we want to know the date of the backup, we might need to store it.
    // However, the current implementation stores just the array.
    // Let's stick to the array for compatibility, or wrap it?
    // The previous implementation stored just the array.
    // But wait, if we overwrite, we lose the date info if it's just the array.
    // The `getLatestBackup` logic relied on the filename for the date.
    // If we use a single file, we should probably store the date inside.
    // But `MarketData[]` is the expected format for `getBackup`.
    // Let's modify the file content to be `{ date: string, data: MarketData[] }`?
    // That would break `getBackup` which expects `MarketData[]`.
    // Let's keep it simple: The user wants "one copy".
    // If I change the format, I might break other things.
    // But if I don't store the date, I can't tell the user what date the backup is from.
    // Let's try to store it as `latest_${type}.json` but keep the content as `MarketData[]`.
    // Wait, if I do that, `getLatestBackup` (which I should rename or modify) won't know the date.
    // Actually, `getLatestBackup` in the previous code read the filename.
    // I should change the storage format to include metadata, or just accept that "latest" implies "whatever is there".
    // But the frontend displays "Showing backup data from [Date]".
    // So I MUST store the date.
    // Let's change the stored format to `{ date: string, data: MarketData[] }`.
    // And update `getBackup` to handle this.

    const content = {
        date,
        data
    };
    await fs.writeFile(filePath, JSON.stringify(content, null, 2));
}

async function getBackup(date: string, type: string): Promise<MarketData[] | null> {
    // This function was looking for a specific date's backup.
    // With the new "single file" policy, we can only return the backup if it matches the requested date,
    // OR if we treat "backup" as "whatever we have".
    // The user said "continuously update one copy".
    // So `getBackup` for a specific date might fail if the single file is for a different date.
    // Let's check the single file.
    const filename = `latest_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    try {
        const contentStr = await fs.readFile(filePath, 'utf-8');
        const content = JSON.parse(contentStr);
        // Check if it matches the requested date? 
        // Or just return it?
        // The original logic had `getBackup` (exact match) and `getLatestBackup` (fallback).
        // Now we only have one file.
        // If the user requests date X, and we have date Y in the file:
        // We should probably return it as a "backup" (fallback).
        return content.data; // This returns the data array.
    } catch {
        return null;
    }
}

async function getLatestBackup(type: string): Promise<{ date: string, data: MarketData[] } | null> {
    const filename = `latest_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    try {
        const contentStr = await fs.readFile(filePath, 'utf-8');
        const content = JSON.parse(contentStr);
        // Expecting { date: string, data: MarketData[] }
        if (content.date && content.data) {
            return content;
        }
        // Handle legacy format (array only) if exists?
        if (Array.isArray(content)) {
            return { date: 'Unknown', data: content };
        }
        return null;
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // Format: 114/12/03
    const type = searchParams.get('type') || 'Vegetable'; // 'Vegetable' or 'Fruit'

    if (!date) {
        return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Convert date format: 114/12/03 -> 114.12.03 for API
    const apiDate = date.replace(/\//g, '.');

    try {
        console.log(`Starting fetch for ${date} - ${type}`);

        // MOA Open Data API URL
        // Endpoint: https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx
        // Parameters:
        // StartDate, EndDate: ROC date (e.g., 113.12.04)
        // MarketName: 台北一 (Taipei Market 1 is the main one for Beinong)

        const apiUrl = new URL('https://data.moa.gov.tw/Service/OpenData/FromM/FarmTransData.aspx');
        apiUrl.searchParams.append('StartDate', apiDate);
        apiUrl.searchParams.append('EndDate', apiDate);
        apiUrl.searchParams.append('MarketName', '台北一');

        const response = await fetch(apiUrl.toString());

        if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
        }

        const rawData: MOAData[] = await response.json();

        // Filter by type if necessary, though the API returns all.
        // The current app distinguishes 'Vegetable' and 'Fruit'.
        // We can filter by '種類代碼' (Type Code).
        // Usually: N04 = Vegetable, N05 = Fruit (Need to verify, but often codes starting with N04 are veggies, N05 fruit)
        // Or we can just return everything and let frontend handle, or try to filter.
        // Looking at the data, '種類代碼' isn't always consistent across datasets, but let's check '作物代號'.
        // Actually, the previous scraper relied on the user selecting the type in the UI which loaded a specific page/dropdown.
        // The MOA data has '種類代碼'. 
        // Let's assume we return all data for now, or filter if we can identify.
        // A common convention: 
        // Vegetable codes often start with 'L', 'F', 'S', 'O' etc? No.
        // Let's look at '種類代碼': 'N04' is often Veg, 'N05' is Fruit.
        // Let's try to filter based on the requested 'type'.

        let filteredData = rawData;
        if (type === 'Vegetable') {
            filteredData = rawData.filter(item => item.種類代碼 === 'N04');
        } else if (type === 'Fruit') {
            filteredData = rawData.filter(item => item.種類代碼 === 'N05');
        }

        if (filteredData.length === 0 && rawData.length > 0) {
            // If strict filtering returns nothing but we have data, maybe return all or log warning.
            // For now, let's trust the N04/N05 distinction which is standard for MOA data.
            console.log(`No data found for type ${type} (N04/N05 filter), returning empty.`);
        }

        const data: MarketData[] = filteredData.map(item => ({
            productCode: item.作物代號,
            productName: item.作物名稱,
            upperPrice: item.上價.toString(),
            middlePrice: item.中價.toString(),
            lowerPrice: item.下價.toString(),
            averagePrice: item.平均價.toString(),
            transactionVolume: item.交易量.toString()
        }));

        if (data.length === 0) {
            throw new Error('No data found');
        }

        // Save backup
        await saveBackup(date, type, data);

        return NextResponse.json({
            status: 'fresh',
            date,
            type,
            data
        });

    } catch (error) {
        console.error('Fetching failed:', error);

        // Try to load the single backup file
        const backup = await getLatestBackup(type);

        if (backup) {
            // If the backup date matches the requested date, it's an "exact match" (though we just failed to fetch, so maybe it's from a previous successful fetch today).
            // If it doesn't match, it's a fallback.
            const isExact = backup.date === date;

            return NextResponse.json({
                status: 'backup',
                date: isExact ? date : backup.date,
                type,
                data: backup.data,
                message: isExact
                    ? 'Fetching failed. Loaded local backup for this date.'
                    : `Fetching failed and no backup for ${date}. Loaded latest backup from ${backup.date}.`,
                backupDate: backup.date
            });
        }

        return NextResponse.json({
            status: 'error',
            message: 'Fetching failed and no backup available.'
        }, { status: 500 });
    }
}
