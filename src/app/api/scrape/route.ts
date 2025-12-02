import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
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

interface ScrapeResponse {
    status: 'fresh' | 'backup' | 'error';
    date: string;
    type: string;
    data: MarketData[];
    message?: string;
    backupDate?: string;
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
    // Sanitize date for filename (replace / with -)
    const safeDate = date.replace(/\//g, '-');
    const filename = `${safeDate}_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

async function getBackup(date: string, type: string): Promise<MarketData[] | null> {
    const safeDate = date.replace(/\//g, '-');
    const filename = `${safeDate}_${type}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

async function getLatestBackup(type: string): Promise<{ date: string, data: MarketData[] } | null> {
    try {
        const files = await fs.readdir(BACKUP_DIR);
        const typeFiles = files.filter(f => f.endsWith(`_${type}.json`));

        if (typeFiles.length === 0) return null;

        // Sort by date (filename) descending
        typeFiles.sort().reverse();

        const latestFile = typeFiles[0];
        const content = await fs.readFile(path.join(BACKUP_DIR, latestFile), 'utf-8');
        // Extract date from filename: 114-12-03_Vegetable.json -> 114/12/03
        const datePart = latestFile.split('_')[0].replace(/-/g, '/');

        return {
            date: datePart,
            data: JSON.parse(content)
        };
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

    // Map type to TAPMC dropdown value
    // Vegetable -> 蔬菜 (Value: 蔬菜)
    // Fruit -> 水果 (Value: 水果)
    const categoryValue = type === 'Fruit' ? '水果' : '蔬菜';

    try {
        console.log(`Starting scrape for ${date} - ${type}`);
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        const page = await browser.newPage();

        // Set User-Agent to mimic a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        await page.goto('https://www.tapmc.com.tw/Pages/Trans/Price1', { waitUntil: 'networkidle0' });

        // 1. Set Date
        // IDs found: ContentPlaceHolder1_txtDate, DDL_FV_Code, ContentPlaceHolder1_btnQuery
        const dateInputSelector = '#ContentPlaceHolder1_txtDate';
        await page.waitForSelector(dateInputSelector);

        // Use DOM API to set value directly
        await page.evaluate((selector, dateVal) => {
            const el = document.querySelector(selector) as HTMLInputElement;
            if (el) {
                el.value = dateVal;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('blur', { bubbles: true }));
            }
        }, dateInputSelector, date);

        // Click body to close datepicker just in case
        await page.mouse.click(10, 10);

        // 2. Set Category
        // The dropdown for Fruit/Vegetable seems to be DDL_FV_Code or similar.
        // Let's try DDL_FV_Code first.
        const categorySelectSelector = '#DDL_FV_Code';
        // Wait for it to be visible
        try {
            await page.waitForSelector(categorySelectSelector, { timeout: 3000 });
            await page.select(categorySelectSelector, categoryValue);
        } catch (e) {
            console.log('DDL_FV_Code not found, trying alternate selector');
            // Fallback or just log
        }

        // 3. Click Query
        const queryButtonSelector = '#ContentPlaceHolder1_btnQuery';

        // ASP.NET WebForms might use UpdatePanel, so waitForNavigation might not work if it's an AJAX update.
        // Instead, we wait for the button click and then wait for the table.
        await page.click(queryButtonSelector);

        // 4. Wait for table
        // The table ID is likely ContentPlaceHolder1_gv
        const tableSelector = '#ContentPlaceHolder1_gv';

        try {
            // Wait for table to be present and visible
            await page.waitForSelector(tableSelector, { timeout: 10000, visible: true });
        } catch (e) {
            console.log('Table not found. Checking for "No Data" message...');
            const content = await page.content();

            // Take debug screenshot
            await page.screenshot({ path: 'public/debug_scrape_error.png' });

            if (content.includes('無資料') || content.includes('查無資料')) {
                throw new Error('No data found for this date');
            }
            throw new Error('Table not found (timeout)');
        }

        // 5. Scrape Data
        const data = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#ctl00_ContentPlaceHolder1_gv tr'));
            // Skip header row
            return rows.slice(1).map(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length < 7) return null;
                return {
                    productCode: cols[0]?.textContent?.trim() || '',
                    productName: cols[1]?.textContent?.trim() || '',
                    upperPrice: cols[2]?.textContent?.trim() || '',
                    middlePrice: cols[3]?.textContent?.trim() || '',
                    lowerPrice: cols[4]?.textContent?.trim() || '',
                    averagePrice: cols[5]?.textContent?.trim() || '',
                    transactionVolume: cols[6]?.textContent?.trim() || '',
                };
            }).filter(item => item !== null);
        });

        await browser.close();

        if (data.length === 0) {
            throw new Error('No data found');
        }

        // Save backup
        await saveBackup(date, type, data as MarketData[]);

        return NextResponse.json({
            status: 'fresh',
            date,
            type,
            data
        });

    } catch (error) {
        console.error('Scraping failed:', error);

        // Try to load backup for the specific date
        const exactBackup = await getBackup(date, type);
        if (exactBackup) {
            return NextResponse.json({
                status: 'backup',
                date,
                type,
                data: exactBackup,
                message: 'Scraping failed. Loaded local backup for this date.'
            });
        }

        // Try to load latest backup
        const latestBackup = await getLatestBackup(type);
        if (latestBackup) {
            return NextResponse.json({
                status: 'backup',
                date: latestBackup.date,
                type,
                data: latestBackup.data,
                message: `Scraping failed and no backup for ${date}. Loaded latest backup from ${latestBackup.date}.`,
                backupDate: latestBackup.date
            });
        }

        return NextResponse.json({
            status: 'error',
            message: 'Scraping failed and no backup available.'
        }, { status: 500 });
    }
}
