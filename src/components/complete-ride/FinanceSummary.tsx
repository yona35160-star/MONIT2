import React from 'react';

interface FinanceSummaryProps {
    financeData: any;
}

export const FinanceSummary: React.FC<FinanceSummaryProps> = ({ financeData }) => {
    return (
        <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-lg mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
            <div className="flex justify-between items-end mb-6">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">רווח משוער</p>
                    <h3 className="text-4xl font-black">₪{Math.round(financeData?.driverProfit || 0)}</h3>
                </div>
                <div className="text-left">
                    <p className="text-slate-400 text-[10px] font-bold uppercase">מחיר מלא</p>
                    <p className="text-lg font-bold">₪{financeData?.fullPrice || 0}</p>
                </div>
            </div>
            <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-sm font-bold text-yellow-400">עמלה לתשלום כעת:</span>
                <span className="text-2xl font-black text-yellow-400">₪{Math.round(financeData?.commission || 0)}</span>
            </div>
        </div>
    );
};
