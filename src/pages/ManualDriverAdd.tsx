
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { sendToBackend } from '../api/adminApi';
import { UserPlus, ArrowRight, User, Phone, MapPin, FileText, Car, CheckCircle, AlertCircle, Loader2, Send, ChevronDown } from 'lucide-react';
import { ISRAEL_DISTRICTS } from '../locations';

export const ManualDriverAdd: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const telegramIdFromUrl = searchParams.get('telegramId') || '';

  const [formData, setFormData] = useState({
    driverName: '',
    phone: '',
    serviceArea: '',
    licenseNumber: '',
    taxiPlateNumber: '',
    telegramId: telegramIdFromUrl
  });

  useEffect(() => {
    if (telegramIdFromUrl && formData.telegramId !== telegramIdFromUrl) {
        setFormData(prev => ({ ...prev, telegramId: telegramIdFromUrl }));
    }
  }, [telegramIdFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('idle');
    setErrorMsg('');

    // Basic phone validation
    const digits = formData.phone.replace(/\D/g, '');
    if (!(digits.length === 10 && digits.startsWith('05'))) {
      setIsLoading(false);
      setStatus('error');
      setErrorMsg('מספר הטלפון אינו תקין. נא להזין מספר נייד ישראלי (05...).');
      return;
    }
    
    try {
      // Use registerDriver for admin manual add (activates immediately)
      const res = await sendToBackend('registerDriver', formData);
      if (res.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(res.error || 'שגיאה בהוספת נהג');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('שגיאת תקשורת');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
      setFormData({
        driverName: '',
        phone: '',
        serviceArea: '',
        licenseNumber: '',
        taxiPlateNumber: '',
        telegramId: ''
      });
      setStatus('idle');
  };

  if (status === 'success') {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="text-green-600 w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">הנהג נוסף בהצלחה!</h2>
                <p className="text-gray-500 mb-6">הנהג {formData.driverName} נקלט במערכת בסטטוס "פעיל".</p>
                <div className="flex flex-col gap-3">
                    <button onClick={handleReset} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">
                        הוסף נהג נוסף
                    </button>
                    <button onClick={() => navigate('/admin')} className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200">
                        חזור ללוח הבקרה
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link to="/admin" className="p-2 hover:bg-slate-800 rounded-full transition">
                    <ArrowRight size={24} />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <UserPlus className="text-yellow-400" />
                    הוספת נהג ידנית
                </h1>
            </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-6 bg-white">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-blue-50">
                <p className="text-blue-800 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    טופס זה מיועד לשימוש מנהל המערכת. נהגים שיתווספו כאן יוגדרו כ"פעילים" באופן מיידי.
                </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">שם מלא</label>
                        <div className="relative">
                            <User className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                required 
                                type="text" 
                                placeholder="ישראל ישראלי"
                                className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition placeholder-gray-400"
                                value={formData.driverName}
                                onChange={e => setFormData({...formData, driverName: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">טלפון נייד</label>
                        <div className="relative">
                            <Phone className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                required 
                                type="tel" 
                                placeholder="050-0000000"
                                className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition placeholder-gray-400"
                                value={formData.phone}
                                onChange={e => setFormData({...formData, phone: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">אזור שירות</label>
                    <div className="relative">
                        <MapPin className="absolute right-3 top-3 text-gray-400 w-5 h-5 pointer-events-none" />
                        <ChevronDown className="absolute left-3 top-3 text-gray-400 w-5 h-5 pointer-events-none" />
                        <select
                            required
                            className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition appearance-none cursor-pointer"
                            value={formData.serviceArea}
                            onChange={e => setFormData({...formData, serviceArea: e.target.value})}
                        >
                            <option value="" disabled>בחר אזור שירות...</option>
                            {ISRAEL_DISTRICTS.map(district => (
                                <option key={district} value={district}>{district}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">מספר רישיון</label>
                        <div className="relative">
                            <FileText className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                required 
                                type="text" 
                                className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition"
                                value={formData.licenseNumber}
                                onChange={e => setFormData({...formData, licenseNumber: e.target.value})}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">מספר כובע / לוחית</label>
                        <div className="relative">
                            <Car className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                            <input 
                                required 
                                type="text" 
                                className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition"
                                value={formData.taxiPlateNumber}
                                onChange={e => setFormData({...formData, taxiPlateNumber: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Telegram ID (אופציונלי)</label>
                    <div className="relative">
                        <Send className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                        <input 
                            type="text" 
                            placeholder="לדוגמה: 123456789"
                            className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black transition placeholder-gray-400"
                            value={formData.telegramId}
                            onChange={e => setFormData({...formData, telegramId: e.target.value})}
                        />
                    </div>
                    {telegramIdFromUrl && <p className="text-xs text-green-600 mt-1">זוהה אוטומטית מהקישור</p>}
                    <p className="text-xs text-gray-500 mt-1">נדרש עבור קבלת הודעות בבוט. ניתן למצוא באמצעות הבוט @userinfobot</p>
                </div>

                {status === 'error' && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                        <AlertCircle size={20} />
                        {errorMsg}
                    </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-4">
                     <button 
                        type="button" 
                        onClick={() => navigate('/admin')}
                        className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition"
                    >
                        ביטול
                    </button>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-200"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <UserPlus size={20} />}
                        הרשם
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};
