'use client';

import React, { useState, useRef } from 'react';
import { MarketData, ScrapeResponse } from '@/lib/types';
import QuoteTable from '@/components/QuoteTable';
import ExcelImport from '@/components/ExcelImport';
import { Search, Download, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function Home() {
  const [date, setDate] = useState<string>('');
  const [type, setType] = useState<string>('Vegetable');
  const [data, setData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<{ isBackup: boolean; date?: string } | null>(null);

  const tableRef = useRef<HTMLDivElement>(null);

  // Set default date to today (TW format) on mount
  React.useEffect(() => {
    const today = new Date();
    const year = today.getFullYear() - 1911;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    setDate(`${year}/${month}/${day}`);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setBackupInfo(null);
    setData([]);

    try {
      const res = await fetch(`/api/scrape?date=${encodeURIComponent(date)}&type=${type}`);
      const result: ScrapeResponse = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Failed to fetch data');
      }

      setData(result.data);

      if (result.status === 'backup') {
        setBackupInfo({
          isBackup: true,
          date: result.backupDate || result.date
        });
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = (importedData: MarketData[]) => {
    setData(importedData);
    setBackupInfo(null);
    setError(null);
  };

  const handleImportError = (msg: string) => {
    setError(msg);
  };

  const handleExportPNG = async () => {
    if (!tableRef.current) return;
    const canvas = await html2canvas(tableRef.current);
    const link = document.createElement('a');
    link.download = `quote_${date.replace(/\//g, '-')}_${type}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;
    const canvas = await html2canvas(tableRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`quote_${date.replace(/\//g, '-')}_${type}.pdf`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
            TAPMC Daily Quote
          </h1>
          <p className="text-slate-500">Taipei Agricultural Products Marketing Corporation</p>
        </div>

        {/* Controls */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end justify-center">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date (TW Year)</label>
            <input
              type="text"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="114/12/03"
              className="block w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="block w-40 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            >
              <option value="Vegetable">Vegetable (蔬菜)</option>
              <option value="Fruit">Fruit (水果)</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
            Fetch Data
          </button>

          <div className="h-8 w-px bg-slate-200 mx-2"></div>

          <ExcelImport onImport={handleImport} onError={handleImportError} />
        </div>

        {/* Warning Banner */}
        {backupInfo && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
            <AlertTriangle className="text-amber-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-amber-800">Stale Data Warning</h3>
              <p className="text-amber-700 text-sm">
                Unable to fetch fresh data for the selected date. Showing backup data from <strong>{backupInfo.date}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-red-800">Error</h3>
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
              Export PNG
            </button>
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
            >
              <FileText size={18} />
              Export PDF
            </button>
          </div>
        )}

        {/* Table Area */}
        <div ref={tableRef} className="bg-white p-1 rounded-xl">
          <QuoteTable initialData={data} onDataChange={setData} />
        </div>

      </div>
    </main>
  );
}
