'use client';

import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';
import { MarketData } from '@/lib/types';

interface ExcelImportProps {
    onImport: (data: MarketData[]) => void;
    onError: (message: string) => void;
}

export default function ExcelImport({ onImport, onError }: ExcelImportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Basic validation and parsing
                // TAPMC Excel usually has headers. We'll look for rows with data.
                // Expected columns: Code, Name, Upper, Middle, Lower, Avg, Volume
                // We'll try to map by index, assuming standard format.

                const parsedData: MarketData[] = [];
                let headerFound = false;

                for (let i = 0; i < data.length; i++) {
                    const row = data[i];
                    // Simple heuristic to find header or data start
                    if (!headerFound) {
                        // Check if this row looks like a header or data
                        // If column 0 is "產品代號" or similar, or if it looks like a code
                        if (row[0] && (String(row[0]).includes('產品') || String(row[0]).match(/^[A-Z0-9]+$/))) {
                            headerFound = true;
                            if (String(row[0]).includes('產品')) continue; // Skip header row
                        } else {
                            continue;
                        }
                    }

                    if (row.length < 7) continue;

                    parsedData.push({
                        productCode: String(row[0] || '').trim(),
                        productName: String(row[1] || '').trim(),
                        upperPrice: String(row[2] || '').trim(),
                        middlePrice: String(row[3] || '').trim(),
                        lowerPrice: String(row[4] || '').trim(),
                        averagePrice: String(row[5] || '').trim(),
                        transactionVolume: String(row[6] || '').trim(),
                    });
                }

                if (parsedData.length === 0) {
                    onError('No valid data found in the Excel file.');
                } else {
                    onImport(parsedData);
                }

            } catch (err) {
                console.error('Excel import error:', err);
                onError('Failed to parse Excel file.');
            }
        };
        reader.readAsBinaryString(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
                <Upload size={18} />
                Import Excel
            </button>
        </div>
    );
}
