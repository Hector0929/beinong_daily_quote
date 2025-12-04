'use client';

import React, { useState, useRef } from 'react';
import { MarketData, ScrapeResponse } from '@/lib/types';
import QuoteTable from '@/components/QuoteTable';
import ExcelImport from '@/components/ExcelImport';
import { Search, Download, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';

export default function Home() {
  const EMPTY_ROW: MarketData = {
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

  const [date, setDate] = useState<string>('');
  const [type, setType] = useState<string>('Vegetable');
  // Default to 2 empty rows
  const [data, setData] = useState<MarketData[]>([EMPTY_ROW, EMPTY_ROW]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ isBackup: boolean; date?: string } | null>(null);

  const [productMasterList, setProductMasterList] = useState<MarketData[]>([]);

  const tableRef = useRef<HTMLDivElement>(null);

  // Set default date to today (TW format) on mount
  React.useEffect(() => {
    const today = new Date();
    const year = today.getFullYear() - 1911;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}/${month}/${day}`);
  }, []);

  // Load master list on mount
  React.useEffect(() => {
    const loadMasterList = async () => {
      try {
        // Try to fetch latest backups for both types
        const [vegRes, fruitRes] = await Promise.all([
          fetch('/api/scrape?type=Vegetable&date=latest'), // We need to support 'latest' or just rely on backup logic
          fetch('/api/scrape?type=Fruit&date=latest')
        ]);

        let combinedList: MarketData[] = [];

        if (vegRes.ok) {
          const vegData = await vegRes.json();
          if (vegData.data) combinedList = [...combinedList, ...vegData.data];
        }
        if (fruitRes.ok) {
          const fruitData = await fruitRes.json();
          if (fruitData.data) combinedList = [...combinedList, ...fruitData.data];
        }

        setProductMasterList(combinedList);
      } catch (e) {
        console.error('Failed to load master list', e);
      }
    };

    loadMasterList();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setBackupInfo(null);
    // setData([]); // Do not clear existing data

    try {
      const res = await fetch(`/api/scrape?date=${encodeURIComponent(date)}&type=${type}`);
      const result: ScrapeResponse = await res.json();

      if (!res.ok) {
        throw new Error(result.message || '無法取得資料');
      }

      // Transform data for Delivery Note format
      const transformedData = result.data.map(item => ({
        ...item,
        quantity: '1',
        unit: '公斤',
        salesPrice: item.averagePrice, // Default to average price
        subtotal: item.averagePrice, // 1 * averagePrice
        remarks: ''
      }));

      // setData(transformedData); // User requested NOT to auto-fill the table

      // Update master list: Merge new data with existing master list to ensure we have the latest
      // But we should be careful about duplicates.
      // For simplicity, let's just re-fetch the master list or append.
      // Actually, if we just fetched 'Vegetable', we should update the Vegetable part of the master list.
      // But since we want "combined", maybe we just append new items?
      // Or simpler: Just trigger a reload of the master list?
      // Or manually merge:
      setProductMasterList(prev => {
        // Filter out items of the same type? No, we don't know the type of items in prev easily without checking.
        // Let's just append and maybe dedupe by productCode?
        // Actually, just appending is fine for now, the autocomplete limits to 10 anyway.
        // But better to be cleaner.
        // Let's just add the new ones.
        return [...prev, ...result.data];
      });

      alert(`資料庫已更新，共 ${result.data.length} 筆來自 ${result.date} 的資料。您現在可以搜尋這些產品。`);

      if (result.status === 'backup') {
        setBackupInfo({
          isBackup: true,
          date: result.backupDate || result.date
        });
      }
    } catch (err: any) {
      setError(err.message || '發生未預期的錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (importedData: MarketData[]) => {
    // Do NOT populate table with imported data, only update master list
    // setData(importedData); 
    setProductMasterList(importedData);
    setBackupInfo(null);
    setError(null);
    alert(`成功匯入 ${importedData.length} 筆產品至自動完成列表。`);
  };

  const handleImportError = (msg: string) => {
    setError(msg);
  };

  const copyInputValues = (original: HTMLElement, clone: HTMLElement) => {
    const originalInputs = original.querySelectorAll('input, select, textarea');
    const clonedInputs = clone.querySelectorAll('input, select, textarea');

    originalInputs.forEach((el, index) => {
      const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const clonedInput = clonedInputs[index] as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

      // Explicitly set value attribute for inputs
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        clonedInput.value = input.value;
        clonedInput.setAttribute('value', input.value);
      } else if (input.tagName === 'SELECT') {
        clonedInput.value = input.value;
        const options = clonedInput.querySelectorAll('option');
        options.forEach(opt => {
          if (opt.value === input.value) opt.setAttribute('selected', 'true');
        });
      }
    });
  };

  const cleanStyles = (node: HTMLElement) => {
    const inputs = node.querySelectorAll('input, select');
    inputs.forEach((input: any) => {
      input.style.border = 'none';
      input.style.outline = 'none';
      input.style.background = 'transparent';
      input.style.boxShadow = 'none';
      input.style.padding = '0';
      input.style.margin = '0';
      // input.style.width = '100%'; // Removed to preserve original widths (especially for header)
      // input.style.height = 'auto';
      // Ensure text is visible and correctly aligned
      input.style.textAlign = input.className.includes('text-right') ? 'right' : (input.className.includes('text-center') ? 'center' : 'left');

      // Remove drop-down arrow for selects
      if (input.tagName === 'SELECT') {
        input.style.appearance = 'none';
        input.style.webkitAppearance = 'none';
        input.style.mozAppearance = 'none';
        input.style.backgroundImage = 'none';
      }
    });

    // Hide add button and delete buttons
    const buttons = node.querySelectorAll('button');
    buttons.forEach((btn: any) => btn.style.display = 'none');

    // Hide any placeholder text in the clone
    const inputsWithPlaceholder = node.querySelectorAll('input::placeholder');
    inputs.forEach((input: any) => {
      input.removeAttribute('placeholder');
    });
  };

  const handleExportPNG = async () => {
    if (!tableRef.current) return;
    try {
      const element = tableRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      // Manually copy values because cloneNode doesn't copy React state values
      copyInputValues(element, clone);

      clone.style.position = 'absolute';
      // Use a visible position but obscured if possible, or just off-screen but rendered
      // Sometimes -9999px causes issues with some engines, but usually fine.
      // Let's try z-index underneath.
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      clone.style.width = `${element.offsetWidth}px`;
      document.body.appendChild(clone);

      cleanStyles(clone);

      // Small delay to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 100));

      const dataUrl = await toPng(clone, { cacheBust: true, backgroundColor: '#ffffff' });

      document.body.removeChild(clone);

      const link = document.createElement('a');
      link.download = `quote_${date.replace(/\//g, '-')}_${type}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert('匯出失敗，請重試。');
    }
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    try {
      const element = tableRef.current;
      const clone = element.cloneNode(true) as HTMLElement;

      copyInputValues(element, clone);

      clone.style.position = 'absolute';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      clone.style.width = `${element.offsetWidth}px`;
      document.body.appendChild(clone);

      cleanStyles(clone);

      await new Promise(resolve => setTimeout(resolve, 100));

      const imgData = await toPng(clone, { cacheBust: true, backgroundColor: '#ffffff' });

      document.body.removeChild(clone);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`quote_${date.replace(/\//g, '-')}_${type}.pdf`);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
            北農每日行情查詢
          </h1>
          <p className="text-slate-500">臺北農產運銷股份有限公司</p>
        </div>

        {/* Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end justify-center">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">日期 (民國年)</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="114/12/03"
              className="block w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">類別</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="block w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            >
              <option value="Vegetable">蔬菜</option>
              <option value="Fruit">水果</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            查詢資料
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2"></div>

          <ExcelImport onImport={handleImport} onError={handleImportError} />
        </div>

        {/* Warning Banner */}
        {backupInfo && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-amber-800">過期資料警告</h3>
              <p className="text-amber-700 text-sm">
                無法取得所選日期的最新資料。顯示 <strong>{backupInfo.date}</strong> 的備份資料。
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-red-800">錯誤</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Action Bar (Export) */}
        {data.length > 0 && (
          <div className="flex justify-end gap-3">
            <button
              onClick={handleExportPNG}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <Download size={18} />
              匯出 PNG
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <FileText size={18} />
              匯出 PDF
            </button>
          </div>
        )}

        {/* Table Area */}
        <div ref={tableRef} className="bg-white p-1 rounded-xl">
          <QuoteTable
            initialData={data}
            onDataChange={setData}
            date={date}
            productMasterList={productMasterList}
          />
        </div>

      </div>
    </main>
  );
}
