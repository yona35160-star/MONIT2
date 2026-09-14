import React, { useState } from 'react';
import { RadarScanner } from '../components/RadarScanner';
import { PredictiveHeatmap } from '../components/PredictiveHeatmap';
import { LiquidSwipe } from '../components/LiquidSwipe';
import { BiddingSlider } from '../components/BiddingSlider';
import { DynamicIslandAlert, AlertData } from '../components/DynamicIslandAlert';
import { Map } from 'lucide-react';

export const SmartUIPreview: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertData[]>([
    { id: '1', type: 'info', title: 'התראת מערכת', subtitle: 'ברוכים הבאים למערכת החדשה' }
  ]);
  const [bid, setBid] = useState(0);

  const addAlert = (type: AlertData['type'], title: string, subtitle?: string) => {
    const newAlert = { id: Date.now().toString(), type, title, subtitle };
    setAlerts([newAlert, ...alerts].slice(0, 3)); // Keep last 3
  };

  const removeAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans pb-24" dir="rtl">
      <DynamicIslandAlert alerts={alerts} onDismiss={removeAlert} />

      <div className="max-w-4xl mx-auto space-y-12">
        <header className="mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-black bg-gradient-to-l from-primary-400 to-primary-500 bg-clip-text text-transparent">
            Smart UI Preview (10x Edition)
          </h1>
          <p className="text-slate-400 mt-2">בדיקת הרכיבים החדשים מחוץ להקשר האפליקציה</p>
        </header>

        {/* 1. Dynamic Island Tester */}
        <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-white">1. אי חכם מרחף (Dynamic Island)</h2>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => addAlert('new_order', 'נסיעה חדשה', 'פלורנטין 10 -> רוטשילד 5')} className="px-4 py-2 bg-yellow-500/20 text-yellow-500 rounded-xl hover:bg-yellow-500/30 transition"> + הזמנה חדשה </button>
            <button onClick={() => addAlert('success', 'נסיעה אושרה', 'הנהג בדרך אליך')} className="px-4 py-2 bg-green-500/20 text-green-500 rounded-xl hover:bg-green-500/30 transition"> + נסיעה אושרה </button>
            <button onClick={() => addAlert('warning', 'עומס חריג', 'נהגים מעטים באזורך')} className="px-4 py-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/30 transition"> + אזהרת עומס </button>
            <button onClick={() => addAlert('info', 'עדכון גרסה', 'נוספו פיצ׳רים חדשים')} className="px-4 py-2 bg-blue-500/20 text-blue-500 rounded-xl hover:bg-blue-500/30 transition"> + מידע כללי </button>
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 2. Radar Scanner */}
          <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col items-center justify-center">
            <h2 className="text-xl font-bold mb-6 text-white w-full text-right">2. רדאר חיפוש נוסע</h2>
            <div className="bg-slate-100 rounded-2xl w-full py-8">
              <RadarScanner />
            </div>
          </section>

          {/* 3. Predictive Heatmap */}
          <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-white w-full text-right">3. מפת חום פולסטיבית (נהג)</h2>
            <div className="relative h-64 bg-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
              <Map className="w-16 h-16 text-slate-700 absolute" />
              <PredictiveHeatmap active={true} />
            </div>
          </section>

          {/* 4. Liquid Swipe */}
          <section className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-white w-full text-right">4. החלקת אישור נוזלית (נהג)</h2>
            <div className="pt-8 px-4">
              <LiquidSwipe onAccept={() => addAlert('success', 'הנסיעה התקבלה בהצלחה!')} />
            </div>
            <p className="text-xs text-slate-500 mt-6 md:hidden text-center">* יש לנסות בסלולר או באמצעות הדמיית Touch</p>
          </section>

          {/* 5. Bidding Slider */}
          <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl">
            <h2 className="text-xl font-bold mb-6 text-slate-800 text-right">5. סליידר תמריצים (נוסע)</h2>
            <BiddingSlider basePrice={45} onBidChange={setBid} />
            <div className="mt-4 text-center text-sm font-semibold text-slate-600">
              תוספת נבחרת: ₪{bid}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
