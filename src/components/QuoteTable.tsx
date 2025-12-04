'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Calendar } from 'lucide-react';
import { MarketData } from '@/lib/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface QuoteTableProps {
    initialData: MarketData[];
    onDataChange: (data: MarketData[]) => void;
    date: string;
    productMasterList?: MarketData[];
}

export default function QuoteTable({ initialData, onDataChange, date, productMasterList = [] }: QuoteTableProps) {
    const [data, setData] = useState<MarketData[]>(initialData);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const endDateInputRef = useRef<HTMLInputElement>(null);

    // Autocomplete States
    const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
    const [searchResults, setSearchResults] = useState<MarketData[]>([]);
    const searchWrapperRef = useRef<HTMLDivElement>(null);

    // Helper to get TW Date
    const getTWDate = (d: Date = new Date()) => {
        const year = d.getFullYear() - 1911;
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    };

    // Header States
    const [startDate, setStartDate] = useState(getTWDate());
    const [endDate, setEndDate] = useState(getTWDate());
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    // Handle click outside to close autocomplete
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
                setActiveSearchIndex(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const handleChange = (index: number, field: keyof MarketData, value: string) => {
        const newData = [...data];
        newData[index] = { ...newData[index], [field]: value };

        // Auto-calculate subtotal if quantity or salesPrice changes
        if (field === 'quantity' || field === 'salesPrice') {
            const qty = parseFloat(newData[index].quantity || '0');
            const price = parseFloat(newData[index].salesPrice || '0');
            if (!isNaN(qty) && !isNaN(price)) {
                newData[index].subtotal = (qty * price).toFixed(2);
            }
        }

        // Autocomplete Logic for Product Name
        if (field === 'productName' && productMasterList.length > 0) {
            setActiveSearchIndex(index);
            const term = value.toLowerCase();
            if (term) {
                const results = productMasterList.filter(p =>
                    (p.productCode && p.productCode.toLowerCase().includes(term)) ||
                    (p.productName && p.productName.toLowerCase().includes(term)) ||
                    (p.variety && p.variety.toLowerCase().includes(term))
                ).slice(0, 10); // Limit to 10 results
                setSearchResults(results);
            } else {
                setSearchResults([]);
            }
        }

        setData(newData);
        onDataChange(newData);
    };

    const handleSelectProduct = (index: number, product: MarketData) => {
        const newData = [...data];
        const formattedName = `${product.productName}${product.variety ? `(${product.variety})` : ''}`;

        newData[index] = {
            ...newData[index],
            productName: formattedName,
            // Optionally fill other fields if needed, but user mainly asked for Name(Variety)
            // We could also fill price defaults if we wanted to be fancy
        };

        setData(newData);
        onDataChange(newData);
        setActiveSearchIndex(null);
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
            quantity: '1',
            unit: '公斤',
            salesPrice: '0',
            subtotal: '0',
            remarks: ''
        };
        const newData = [...data, newRow];
        setData(newData);
        onDataChange(newData);
    };

    const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate.getTime())) {
            setStartDate(getTWDate(selectedDate));
        }
    };

    const handleEndDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedDate = new Date(e.target.value);
        if (!isNaN(selectedDate.getTime())) {
            setEndDate(getTWDate(selectedDate));
        }
    };

    // Calculate Total Amount
    const totalAmount = data.reduce((sum, item) => {
        const sub = parseFloat(item.subtotal || '0');
        return sum + (isNaN(sub) ? 0 : sub);
    }, 0);

    // Calculate Total Weight (in KG)
    const totalWeight = data.reduce((sum, item) => {
        const qty = parseFloat(item.quantity || '0');
        if (isNaN(qty)) return sum;

        let factor = 1;
        switch (item.unit) {
            case '公克': factor = 0.001; break;
            case '台斤': factor = 0.6; break;
            case '公斤': default: factor = 1; break;
        }
        return sum + (qty * factor);
    }, 0);

    const inputClass = "w-full bg-white border border-gray-400 rounded px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none text-center font-medium";
    const headerInputClass = "bg-white border-2 border-gray-800 rounded px-2 py-0.5 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg mx-1";

    return (
        <div className="w-full bg-white p-8 min-h-[800px] font-serif text-black" ref={searchWrapperRef}>
            {/* Header */}
            <div className="text-center mb-6">
                <h1 className="text-3xl font-bold tracking-widest mb-2">義庄合作農場</h1>
                <h2 className="text-2xl font-normal tracking-widest">明細表</h2>
            </div>

            {/* Info Row */}
            <div className="flex justify-between items-end border-b-4 border-black pb-2 mb-2 text-lg font-medium">
                <div className="flex items-center flex-wrap gap-2">
                    <span>貨單日期：</span>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className={headerInputClass}
                            style={{ width: '120px' }}
                        />
                        <button
                            onClick={() => dateInputRef.current?.showPicker()}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <Calendar size={20} />
                        </button>
                        <input
                            ref={dateInputRef}
                            type="date"
                            className="absolute opacity-0 w-0 h-0"
                            onChange={handleDateSelect}
                        />
                    </div>
                    <span>至</span>
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className={headerInputClass}
                            style={{ width: '120px' }}
                        />
                        <button
                            onClick={() => endDateInputRef.current?.showPicker()}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <Calendar size={20} />
                        </button>
                        <input
                            ref={endDateInputRef}
                            type="date"
                            className="absolute opacity-0 w-0 h-0"
                            onChange={handleEndDateSelect}
                        />
                    </div>


                    <span className="ml-4">客戶編號：</span>
                    <input
                        type="text"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className={headerInputClass}
                        style={{ width: '80px' }}
                    />
                </div>
            </div>
            <div className="flex flex-col border-b-4 border-black pb-2 mb-2 text-lg font-medium gap-2">
                <div className="flex items-center">
                    <span>客戶編號：</span>
                    <input
                        type="text"
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className={headerInputClass}
                        style={{ width: '80px' }}
                    />
                </div>
                <div className="flex items-center">
                    <span>客戶簡稱：</span>
                    <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className={headerInputClass}
                        style={{ width: '150px' }}
                    />
                </div>
            </div>

            {/* Table */}
            <table className="w-full text-lg border-collapse">
                <thead>
                    <tr className="border-b border-black">
                        <th className="py-2 text-left w-32">貨單日期</th>
                        <th className="py-2 text-left">貨品名稱</th>
                        <th className="py-2 text-right w-24">數量</th>
                        <th className="py-2 text-center w-24">單位</th>
                        <th className="py-2 text-right w-24">售價</th>
                        <th className="py-2 text-right w-32">小計</th>
                        <th className="py-2 text-left pl-4">備註</th>
                        <th className="w-10"></th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 relative">
                            <td className="py-2 pr-2">
                                <input
                                    type="text"
                                    value={startDate} // Sync with header start date
                                    readOnly
                                    className="w-full bg-transparent outline-none text-gray-600"
                                />
                            </td>
                            <td className="py-2 pr-2 relative">
                                <input
                                    type="text"
                                    value={row.productName}
                                    onChange={(e) => handleChange(index, 'productName', e.target.value)}
                                    onFocus={() => setActiveSearchIndex(index)}
                                    className={`${inputClass} text-left`}
                                    placeholder="輸入代號/品名/品種"
                                />
                                {/* Autocomplete Dropdown */}
                                {activeSearchIndex === index && searchResults.length > 0 && (
                                    <div className="absolute z-50 left-0 top-full w-full bg-white border border-gray-300 shadow-lg rounded-md mt-1 max-h-48 overflow-y-auto">
                                        {searchResults.map((result, rIndex) => (
                                            <div
                                                key={rIndex}
                                                className="px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm border-b border-gray-100 last:border-0"
                                                onClick={() => handleSelectProduct(index, result)}
                                            >
                                                <div className="font-medium text-gray-800">
                                                    {result.productName}
                                                    {result.variety && <span className="text-gray-500">({result.variety})</span>}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {result.productCode}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="py-2 pr-2">
                                <input
                                    type="text"
                                    value={row.quantity}
                                    onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                                    className={`${inputClass} text-right`}
                                />
                            </td>
                            <td className="py-2 pr-2">
                                <select
                                    value={row.unit}
                                    onChange={(e) => handleChange(index, 'unit', e.target.value)}
                                    className={`${inputClass} text-center appearance-none cursor-pointer`}
                                >
                                    <option value="公斤">公斤</option>
                                    <option value="公克">公克</option>
                                    <option value="台斤">台斤</option>
                                </select>
                            </td>
                            <td className="py-2 pr-2">
                                <input
                                    type="text"
                                    value={row.salesPrice}
                                    onChange={(e) => handleChange(index, 'salesPrice', e.target.value)}
                                    className={`${inputClass} text-right`}
                                />
                            </td>
                            <td className="py-2 text-right pr-2 font-medium">
                                {row.subtotal}
                            </td>
                            <td className="py-2 pl-2">
                                <input
                                    type="text"
                                    value={row.remarks}
                                    onChange={(e) => handleChange(index, 'remarks', e.target.value)}
                                    className={`${inputClass} text-left`}
                                />
                            </td>
                            <td className="text-center">
                                <button
                                    onClick={() => handleDelete(index)}
                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="border-t-4 border-black font-bold text-xl">
                        <td colSpan={2} className="py-4">小計</td>
                        <td className="text-right pr-2 text-lg align-middle">總重</td>
                        <td className="text-center text-lg align-middle">{totalWeight.toFixed(3)} 公斤</td>
                        <td className="text-right"></td>
                        <td className="text-right pr-2">{totalAmount.toFixed(2)}</td>
                        <td colSpan={2}></td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-8 flex justify-center print:hidden">
                <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors border border-emerald-200"
                >
                    <Plus size={20} />
                    Add Item
                </button>
            </div>
        </div >
    );
}
