import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateOrderModal } from '../components/CreateOrderModal';
import { WhatsAppConnect } from '../components/WhatsAppConnect';
import { Car } from 'lucide-react';

export const StationOrder: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [done, setDone] = useState(false);
  const [mapsKey, setMapsKey] = useState('');

  useEffect(() => {
    import('../api/adminApi').then(({ getSystemSettings }) => {
      getSystemSettings().then((res) => {
        const data = res.data as Record<string, string> | undefined;
        if (!res.ok || !data) return;
        setMapsKey(data.googleMapsApiKey || data.GOOGLE_MAPS_API_KEY || data.GOOGLEMAPSAPIKEY || '');
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] p-4 md:p-8" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white">
              <Car size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">טופס הזמנה — תחנת מוניות</h1>
              <p className="text-slate-500 text-sm font-bold">בלי התחברות. נשלח לקבוצת הווטסאפ אחרי יצירה.</p>
            </div>
          </div>
          <Link to="/" className="text-slate-400 text-sm font-bold hover:text-white">לכניסת מנהל</Link>
        </div>

        <WhatsAppConnect />

        {done && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-3xl font-bold">
            ההזמנה נקלטה. אם ווטסאפ מחובר — היא כבר בקבוצה.
            <button
              type="button"
              onClick={() => { setDone(false); setOpen(true); }}
              className="block mt-4 bg-primary-600 text-white px-5 py-3 rounded-2xl font-black"
            >
              הזמנה נוספת
            </button>
          </div>
        )}

        {open && (
          <CreateOrderModal
            embedded
            googleMapsApiKey={mapsKey}
            onClose={() => setOpen(false)}
            onSuccess={() => { setDone(true); setOpen(false); }}
          />
        )}
      </div>
    </div>
  );
};
