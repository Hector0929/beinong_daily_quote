'use client';

import React, { useState, useEffect } from 'react';
import { MarketData } from '@/lib/types';
import { Trash2, Plus, ArrowUpDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface QuoteTableProps {
    initialData: MarketData[];
    onDataChange: (data: MarketData[]) => void;
}

type SortKey = keyof MarketData;

export default function QuoteTable({ initialData, onDataChange }: QuoteTableProps) {
    const [data, setData] = useState<MarketData[]>(initialData);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });

        const sortedData = [...data].sort((a, b) => {
            if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        setData(sortedData);
        onDataChange(sortedData);
    };

    const handleChange = (index: number, key: keyof MarketData, value: string) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [key]: value };
        setData(newData);
        onDataChange(newData);
    };

    const handleDelete = (index: number) => {
        const newData = data.filter((_, i) => i !== index);
        setData(newData);
        onDataChange(newData);
    };

    const handleAddRow = () => {
        const newRow: MarketData = {
            productCode: '',
            productName: '',
            upperPrice: '',
            middlePrice: '',
            lowerPrice: '',
            averagePrice: '',
            transactionVolume: '',
        };
        const newData = [newRow, ...data];
        setData(newData);
        onDataChange(newData);
    };

    return (
        <div className="w-full overflow-x-auto rounded-lg shadow-lg bg-white/80 backdrop-blur-sm border border-white/20">
            <div className="p-4 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-lg">
                <h2 className="text-xl font-bold">Market Quotes</h2>
                <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md transition-colors text-sm font-medium"
                >
                    <Plus size={16} />
                    Add Row
                </button>
            </div>
            <table className="w-full text-sm text-left text-gray-700">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50/50">
                    <tr>
                        {[
                            { key: 'productCode', label: 'Code' },
                            { key: 'productName', label: 'Product' },
                            { key: 'upperPrice', label: 'Upper' },
                            { key: 'middlePrice', label: 'Middle' },
                            { key: 'lowerPrice', label: 'Lower' },
                            { key: 'averagePrice', label: 'Avg' },
                            { key: 'transactionVolume', label: 'Volume' },
                        ].map((col) => (
                            <th key={col.key} className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort(col.key as SortKey)}>
                                <div className="flex items-center gap-1">
                                    {col.label}
                                    <ArrowUpDown size={14} className="text-gray-400" />
                                </div>
                            </th>
                        ))}
                        <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index} className="bg-white border-b hover:bg-gray-50 transition-colors group">
                            {(Object.keys(row) as Array<keyof MarketData>).map((key) => (
                                <td key={key} className="px-4 py-2">
                                    <input
                                        type="text"
                                        value={row[key]}
                                        onChange={(e) => handleChange(index, key, e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-2 focus:ring-emerald-500 rounded px-2 py-1 transition-all"
                                    />
                                </td>
                            ))}
                            <td className="px-6 py-4 text-right">
                                <button
                                    onClick={() => handleDelete(index)}
                                    className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                No data available. Fetch data or add a row manually.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
