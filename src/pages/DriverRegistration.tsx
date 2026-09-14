import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { sendToBackend } from '../api/driverApi';
import { User, Phone, MapPin, CheckCircle, AlertCircle, Send, ChevronDown, Loader2, Zap, ArrowRight } from 'lucide-react';
import { ISRAEL_DISTRICTS } from '../locations';
import { normalizePhone, isValidPhone } from '../utils/phone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const driverSchema = z.object({
  driverName: z.string().min(2, 'שם מלא חייב להכיל לפחות 2 תווים'),
  phone: z.string().min(9, 'מספר טלפון חייב להכיל לפחות 9 ספרות').refine((val) => isValidPhone(val), {
    message: 'מספר הטלפון אינו תקין. נא להזין מספר נייד ישראלי (05...) או מספר בינלאומי תקין.'
  }),
  serviceArea: z.string().min(1, 'חובה לבחור אזור שירות'),
  licenseNumber: z.string().min(5, 'מספר רישיון לא תקין'),
  taxiPlateNumber: z.string().min(6, 'מספר כובע/לוחית לא תקין'),
  telegramId: z.string().optional(),
  telegramUsername: z.string().optional(),
  orderId: z.string().optional(),
  hasConsented: z.boolean().refine(val => val === true, {
    message: 'חובה לאשר את תנאי השימוש ומדיניות הפרטיות'
  })
});

type DriverForm = z.infer<typeof driverSchema>;

export const DriverRegistration: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'success' | 'checking'>('idle');
  const [serverError, setServerError] = useState('');

  // Flags to track if data truly came from the system (URL)
  const [isPhoneSystemSource, setIsPhoneSystemSource] = useState(false);
  const [isTelegramSystemSource, setIsTelegramSystemSource] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<DriverForm>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      driverName: searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : '',
      phone: searchParams.get('phone') || '',
      serviceArea: '',
      licenseNumber: '',
      taxiPlateNumber: '',
      telegramId: searchParams.get('telegramId') || '',
      telegramUsername: searchParams.get('username') || '',
      orderId: searchParams.get('orderId') || '',
      hasConsented: false
    }
  });

  const watchedPhone = watch('phone');
  const watchedTelegramId = watch('telegramId');
  const orderId = searchParams.get('orderId');

  // Effect to determine source of data (System vs Manual)
  useEffect(() => {
    const urlPhone = searchParams.get('phone');
    const urlTg = searchParams.get('telegramId');

    if (urlPhone && urlPhone === watchedPhone) {
      setIsPhoneSystemSource(true);
    } else {
      setIsPhoneSystemSource(false);
    }

    if (urlTg && urlTg === watchedTelegramId) {
      setIsTelegramSystemSource(true);
    } else {
      setIsTelegramSystemSource(false);
    }
  }, [watchedPhone, watchedTelegramId, searchParams]);

  const skipAuthCheck = searchParams.get('skipAuthCheck') === 'true';

  // SMART AUTH CHECK
  useEffect(() => {
    const checkExistingDriver = async () => {
      if (!orderId || skipAuthCheck) return;

      const savedPhone = localStorage.getItem('driver_phone');
      // If we have a saved phone, and we didn't arrive here with a specific phone in URL to override it
      if (savedPhone && !searchParams.get('phone')) {
        setStatus('checking');
        navigate(`/accept-ride?orderId=${orderId}`);
      }
    };
    checkExistingDriver();
  }, [orderId, navigate, skipAuthCheck, searchParams]);

  const onSubmit = async (data: DriverForm) => {
    setStatus('idle');
    setServerError('');

    const normalized = normalizePhone(data.phone);

    try {
      const action = data.orderId ? 'registerDriverAndAssignOrder' : 'registerDriverSelf';

      // Ensure normalized phone is sent
      const payload = { ...data, phone: normalized };
      const res = await sendToBackend(action, payload);

      if (res.ok) {
        // Save normalized phone to ensure consistency
        localStorage.setItem('driver_phone', normalized);
        setStatus('success');

        if (data.orderId) {
          // Success assignment!
          // Small delay then redirect to AcceptRide (which will show success)
          setTimeout(() => {
            navigate(`/accept-ride?orderId=${data.orderId}&phone=${normalized}`);
          }, 2000);
        }
      } else {
        setServerError(res.error || 'שגיאה בהרשמה');
      }
    } catch (err) {
      setServerError('שגיאת תקשורת');
    }
  };

  const handleClose = () => {
    try { (window.open('', '_self')!).close(); } catch (e) { }
    window.location.href = "https://t.me/TAXIEXPRESS_bot";
  };

  const closeWebApp = () => {
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.close();
    } else {
      window.location.href = '/';
    }
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="animate-spin text-[#FACC15] w-14 h-14" />
          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">מזהה נהג במערכת...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-[#1E293B] p-12 rounded-[3.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.5)] border border-white/5 max-w-md w-full text-center animate-in zoom-in duration-500">
          <div className="w-24 h-24 bg-[#FACC15]/20 rounded-[2rem] flex items-center justify-center mx-auto mb-10 rotate-12 shadow-inner">
            <CheckCircle className="text-[#FACC15] w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3 tracking-tight">
            {orderId ? 'הנסיעה שוייכה!' : 'ההרשמה נקלטה!'}
          </h2>
          <p className="text-slate-500 mb-10 font-medium leading-relaxed">
            {orderId
              ? `הפרטים סונכרנו. מיד תועבר לצפייה בפרטי הלקוח המלאים.`
              : 'הפרטים הועברו לאישור מנהל. כעת תוכל להתחיל לקבל הצעות.'}
          </p>

          {orderId ? (
            <div className="flex justify-center items-center gap-3 text-[#FACC15] font-black uppercase tracking-widest text-xs bg-slate-900/40 py-4 rounded-2xl border border-white/5">
              <Loader2 className="animate-spin" size={18} />
              <span>טוען פרטי נסיעה...</span>
            </div>
          ) : (
            <div className="flex justify-center gap-5 flex-col">
              <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-[0.2em] font-black">שלב אחרון: הפעלת הבוט</p>
              <a
                href={`https://t.me/TaxiExpressBot?start=${watchedPhone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="bg-[#FACC15] text-slate-900 px-8 py-4 rounded-[1.5rem] font-black hover:bg-[#FDE047] flex items-center justify-center gap-3 shadow-xl shadow-[#FACC15]/10 text-lg transition-all"
              >
                <Send size={22} className="rotate-45" /> חבר טלגרם לקבלת קריאות
              </a>
              <button onClick={handleClose} className="text-slate-600 text-xs font-black uppercase tracking-widest hover:text-slate-400 transition-colors mt-4">
                סגור דף
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-[2rem] shadow-xl p-8 w-full max-w-lg border border-slate-100">

        <header className="flex justify-between items-center mb-8">
          <button onClick={closeWebApp} className="p-3 hover:bg-slate-100 rounded-xl transition text-slate-400">
            <ArrowRight size={24} />
          </button>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center text-slate-900 font-black text-xl shadow-lg mb-1">TX</div>
            <span className="text-xs font-bold text-slate-400 tracking-widest">DRIVER</span>
          </div>
          <div className="w-12"></div>
        </header>

        <h1 className="text-4xl font-black text-white mb-2 tracking-tight">הצטרף לצי המוניות</h1>
        <p className="text-slate-500 mb-4 font-medium text-lg leading-relaxed">סידור עבודה חכם - ללא דמי מנוי קבועים.</p>
        <div className="inline-flex items-center gap-2 text-[10px] text-[#FACC15] font-black mb-10 bg-[#FACC15]/5 px-4 py-2 rounded-full border border-[#FACC15]/10 uppercase tracking-widest">
          <Zap size={14} className="fill-current" /> שלם רק על נסיעה שבוצעה • גמישות מלאה
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {orderId && (
            <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl text-sm text-blue-400 mb-6 flex items-start gap-3 backdrop-blur-md">
              <div className="mt-0.5"><AlertCircle size={18} /></div>
              <div className="font-medium leading-relaxed"><span className="font-black block text-xs uppercase tracking-widest mb-1">השלמת רישום מהירה</span>המערכת זיהתה הזמנה שמחכה לך (<strong>{orderId}</strong>). <br />הזן את פרטייך והנסיעה תשוריין לך באופן מיידי.</div>
            </div>
          )}

          {/* Driver Name */}
          <div className="space-y-2">
            <label htmlFor="driverName" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">שם מלא באנגלית/עברית</label>
            <div className="relative">
              <User className="absolute right-4 top-4 text-slate-500" size={20} />
              <input
                id="driverName"
                {...register('driverName')}
                placeholder="ישראל ישראלי"
                aria-invalid={!!errors.driverName}
                className={`w-full pr-12 pl-4 py-4 bg-slate-900 border ${errors.driverName ? 'border-red-500' : 'border-white/10'} rounded-2xl outline-none focus:ring-4 focus:ring-[#FACC15]/20 focus:border-[#FACC15]/50 font-black text-white text-lg transition-all placeholder:font-normal placeholder:text-slate-700`}
              />
            </div>
            {errors.driverName && <p role="alert" className="text-red-500 text-xs mt-2 font-bold">{errors.driverName.message}</p>}
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1 flex items-center gap-2">
              מספר טלפון נייד
              {isPhoneSystemSource && (
                <span className="text-[9px] bg-[#FACC15]/10 text-[#FACC15] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#FACC15]/20">
                  <Zap size={10} className="fill-current" /> סונכרן
                </span>
              )}
            </label>
            <div className="relative">
              <Phone className="absolute right-4 top-4 text-slate-500 w-5 h-5" />
              <input
                id="phone"
                {...register('phone')}
                type="tel"
                placeholder="050-0000000"
                aria-invalid={!!errors.phone}
                className={`w-full pr-12 pl-4 py-4 border ${errors.phone ? 'border-red-500' : 'border-white/10'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 focus:border-[#FACC15]/50 outline-none bg-slate-900 text-white font-black text-lg tracking-widest`}
                readOnly={isPhoneSystemSource}
                dir="ltr"
              />
            </div>
            {errors.phone && <p role="alert" className="text-red-500 text-xs mt-2 font-bold">{errors.phone.message}</p>}
          </div>

          {/* Service Area */}
          <div className="space-y-2">
            <label htmlFor="serviceArea" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">אזור שירות עיקרי</label>
            <div className="relative">
              <MapPin className="absolute right-4 top-4 text-slate-500 w-5 h-5 pointer-events-none" />
              <ChevronDown className="absolute left-4 top-4 text-slate-500 w-5 h-5 pointer-events-none" />
              <select
                id="serviceArea"
                {...register('serviceArea')}
                aria-invalid={!!errors.serviceArea}
                className={`w-full pr-12 pl-4 py-4 border ${errors.serviceArea ? 'border-red-500' : 'border-white/10'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 focus:border-[#FACC15]/50 outline-none bg-slate-900 text-white font-black text-lg appearance-none transition-all`}
              >
                <option value="" disabled>בחר אזור...</option>
                {ISRAEL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {errors.serviceArea && <p role="alert" className="text-red-500 text-xs mt-2 font-bold">{errors.serviceArea.message}</p>}
          </div>

          {/* License & Plate */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="licenseNumber" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">מס׳ רישיון</label>
              <input
                id="licenseNumber"
                {...register('licenseNumber')}
                type="text"
                aria-invalid={!!errors.licenseNumber}
                className={`w-full p-4 border ${errors.licenseNumber ? 'border-red-500' : 'border-white/10'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 focus:border-[#FACC15]/50 outline-none bg-slate-900 text-white font-black text-lg transition-all`}
                placeholder="1234567"
              />
              {errors.licenseNumber && <p role="alert" className="text-red-500 text-xs mt-2 font-bold">{errors.licenseNumber.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="taxiPlateNumber" className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">לוחית זיהוי/כובע</label>
              <input
                id="taxiPlateNumber"
                {...register('taxiPlateNumber')}
                type="text"
                aria-invalid={!!errors.taxiPlateNumber}
                className={`w-full p-4 border ${errors.taxiPlateNumber ? 'border-red-500' : 'border-white/10'} rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 focus:border-[#FACC15]/50 outline-none bg-slate-900 text-white font-black text-lg transition-all`}
                placeholder="00-000-00"
              />
              {errors.taxiPlateNumber && <p role="alert" className="text-red-500 text-xs mt-2 font-bold">{errors.taxiPlateNumber.message}</p>}
            </div>
          </div>

          {/* Telegram ID */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1 flex items-center gap-2">
              Telegram ID
              {isTelegramSystemSource && (
                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/20">
                  <Send size={10} /> מאומת
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Send className="absolute right-4 top-4 text-slate-500 w-5 h-5" />
                <input
                  {...register('telegramId')}
                  type="text"
                  className="w-full pr-12 pl-4 py-4 bg-slate-800 border border-white/5 rounded-2xl focus:ring-4 focus:ring-[#FACC15]/20 outline-none text-slate-300 font-black text-lg"
                  readOnly={isTelegramSystemSource}
                  placeholder="מספר מזהה"
                />
              </div>
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-4 p-5 bg-slate-900/40 rounded-2xl border border-white/5">
            <div className="pt-1">
              <input
                type="checkbox"
                id="consent"
                {...register('hasConsented')}
                className="w-5 h-5 text-[#FACC15] bg-slate-800 border-white/10 rounded focus:ring-[#FACC15] focus:ring-offset-slate-900 cursor-pointer"
              />
            </div>
            <label htmlFor="consent" className="text-[11px] text-slate-400 cursor-pointer leading-relaxed">
              <span className="text-slate-300 font-medium">
                אני מאשר/ת את
                <Link to="/privacy-policy" className="text-[#FACC15] font-black hover:underline mx-1">תקנון הנהגים</Link>
                וכן את
                <Link to="/privacy-policy" className="text-[#FACC15] font-black hover:underline mx-1">מדיניות הפרטיות</Link>
              </span>
              . אני מסכים לקבל עדכונים תפעוליים והצעות לנסיעות באפליקציה ובטלגרם.
            </label>
          </div>
          {errors.hasConsented && <p className="text-red-500 text-xs font-bold leading-none">{errors.hasConsented.message}</p>}

          {serverError && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm flex items-center gap-2 border border-red-100">
              <AlertCircle size={20} />
              {serverError}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="w-full bg-yellow-400 text-slate-900 font-bold py-4 rounded-xl hover:bg-yellow-500 transition mt-6 shadow-md text-lg disabled:opacity-50">
            {isSubmitting ? 'מעבד נתונים...' : 'הרשם וקבל נסיעה'}
          </button>
        </form>
      </div>
    </div>
  );
};
