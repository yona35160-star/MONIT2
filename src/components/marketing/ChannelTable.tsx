import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface ChannelData {
    id: string;
    name: string;
    calls: number;
    conversions: number;
    conversionRate: number;
    costPerCall: number;
    roi: number;
    revenue: number;
}

interface ChannelTableProps {
    channels: ChannelData[];
}

export const ChannelTable: React.FC<ChannelTableProps> = ({ channels }) => {
    return (
        <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
            <h3 className="p-4 border-b border-slate-100 font-bold bg-slate-50/50 flex items-center gap-2">
                <ArrowUpRight className="text-blue-500" size={18} /> ביצועי ערוצים
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="p-3">ערוץ</th>
                            <th className="p-3">שיחות</th>
                            <th className="p-3">המרות</th>
                            <th className="p-3">CR%</th>
                            <th className="p-3">עלות לשיחה</th>
                            <th className="p-3">ROI</th>
                            <th className="p-3">הכנסות</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {channels.map((ch) => (
                            <tr key={ch.id} className={`hover:bg-slate-50/80 transition ${ch.roi > 0 && ch.id !== 'organic' ? 'bg-green-50/30' : ''}`}>
                                <td className="p-3 font-bold text-slate-700">{ch.name}</td>
                                <td className="p-3 text-slate-600">{ch.calls}</td>
                                <td className="p-3 text-slate-600">{ch.conversions}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ch.conversionRate >= 50 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {ch.conversionRate}%
                                    </span>
                                </td>
                                <td className="p-3 text-slate-600">₪{ch.costPerCall}</td>
                                <td className={`p-3 font-bold ${ch.roi > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {ch.id === 'organic' ? '-' : `${ch.roi}%`}
                                </td>
                                <td className="p-3 font-medium text-slate-800">₪{ch.revenue.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
