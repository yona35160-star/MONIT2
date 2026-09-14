import React from 'react';
import { MapPin } from 'lucide-react';

interface GeoData {
    city: string;
    count: number;
}

interface GeoMapProps {
    geo: GeoData[];
}

export const GeoMap: React.FC<GeoMapProps> = ({ geo }) => {
    return (
        <div className="bg-white p-5 rounded-xl shadow border border-slate-100">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-slate-800">
                <MapPin className="text-red-500" size={20} /> מוקדי ביקוש (ערים מובילות)
            </h3>
            <div className="flex flex-wrap gap-3">
                {geo.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 pl-4 pr-1 py-1 rounded-full group hover:bg-slate-100 transition">
                        <span className="bg-white shadow-sm text-blue-600 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border border-slate-100">
                            {g.count}
                        </span>
                        <span className="font-medium text-slate-700 text-sm">{g.city}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
