import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setDriverLogin } from '../store/slices/authSlice';
import { requestOTP, verifyOTP } from '../api/driverApi';
import { sendToBackend } from '../api/api';
import { Car, Phone, Loader2, AlertCircle, ArrowRight } from 'lucide-react';
import { normalizePhone, isValidPhone } from '../utils/phone';
import { GoogleProfile } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

export const DriverLogin: React.FC<{ onLogin?: () => void }> = ({ onLogin }) => {
  const dispatch = useDispatch();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    // Initialize Google Login
    const initializeGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
          callback: handleGoogleCallback
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleBtn"),
          { theme: "outline", size: "large", width: "100%", text: "continue_with" }
        );
      }
    };

    const interval = setInterval(() => {
      if (window.google) {
        initializeGoogle();
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleGoogleCallback = async (response: any) => {
    setIsLoading(true);
    setError('');
    try {
      const base64Url = response.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const profile = JSON.parse(window.atob(base64)) as GoogleProfile;

      const res = await sendToBackend('loginWithGoogle', {
        type: 'driver',
        profile: profile
      });

      if (res.ok && res.data) {
        const data = res.data as any;
        dispatch(setDriverLogin({ token: data.token, driverId: data.driverId }));
        if (onLogin) onLogin();
        navigate('/portal');
      } else {
        setError(res.error || 'שגיאה בהתחברות עם גוגל');
      }
    } catch (err) {
      console.error(err);
      setError('תקלה באימות גוגל');
    } finally {
      setIsLoading(false);
    }
  };

  const [isApiReady, setIsApiReady] = useState<boolean | null>(null);

  useEffect(() => {
    import('../api/api').then(({ initializeApiUrl, DEFAULT_WEBAPP_URL }) => {
      const url = localStorage.getItem('taxi_app_script_url') || DEFAULT_WEBAPP_URL;
      setIsApiReady(!!url && url.startsWith('https://'));
    });
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!isValidPhone(phone)) {
      setError('מספר טלפון לא תקין');
      setIsLoading(false);
      return;
    }

    try {
      const resp = await requestOTP(phone);
      if (resp.ok) {
        setStep('otp');
      } else {
        setError(resp.error || 'שגיאה בשליחת הקוד');
      }
    } catch (err: any) {
      setError('שגיאה בשליחת קוד');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await verifyOTP(phone, otp);

      if (response.ok && response.data) {
        const data = response.data as any;
        dispatch(setDriverLogin({ token: data.token, driverId: data.driverId }));
        
        const localPhone = normalizePhone(phone);
        localStorage.setItem('driver_phone', localPhone);

        if (onLogin) onLogin();
        navigate('/portal');
      } else {
        setError(response.error || 'קוד שגוי או פג תוקף');
      }
    } catch (err: any) {
      setError('תקלה באימות הקוד');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-heebo">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-slate-200 relative">
        <Link to="/" className="absolute top-6 left-6 text-gray-400 hover:text-slate-900 transition">
          <ArrowRight />
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Car className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">פורטל נהגים</h1>
          <p className="text-slate-500 mt-2 text-sm">הזדהות מאובטחת באמצעות וואטסאפ או גוגל</p>
          {!isApiReady && isApiReady !== null && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-800 text-xs text-right">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                ⚙️ כתובת שרת (Script URL) לא מוגדרת. להפעלה מקומית: העתיקו את{' '}
                <span className="font-mono" dir="ltr">.env.example</span> ל־
                <span className="font-mono" dir="ltr">.env</span>, מלאו את{' '}
                <span className="font-mono" dir="ltr">VITE_WEBAPP_URL</span> והפעילו מחדש —
                או הזינו כתובת בגלגל השיניים במסך המנהל.
              </span>
            </div>
          )}
        </div>

        {step === 'phone' ? (
          <div className="space-y-6">
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">טלפון נייד</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-3 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    required
                    className="w-full pr-10 pl-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-black"
                    placeholder="050-1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded-lg flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

              <button
                type="submit"
                disabled={isLoading || !phone}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition shadow-md flex items-center justify-center gap-2 disabled:bg-slate-400"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'שלח קוד אימות בוואטסאפ'}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-500">או</span></div>
            </div>

            <div id="googleBtn" className="w-full flex justify-center"></div>
          </div>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">קוד אימות (6 ספרות) שנשלח בוואטסאפ</label>
              <input
                type="text"
                required
                maxLength={6}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-center text-2xl tracking-widest text-black"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded-lg flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

            <button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition shadow-md flex items-center justify-center gap-2 disabled:bg-slate-400"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : 'אמת והתחבר'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-slate-500 text-sm hover:underline"
            >
              שנה מספר טלפון
            </button>
          </form>
        )}

        <div className="mt-8 text-center text-xs">
          <p className="text-gray-400">לא רשום? <Link to="/register-driver" className="font-bold text-blue-600 hover:underline">לחץ כאן להרשמה מהירה</Link></p>
        </div>
      </div>
    </div>
  );
};
