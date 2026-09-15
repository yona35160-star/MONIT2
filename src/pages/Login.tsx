import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginAdmin, testConnection } from '../api/adminApi';
import { isValidWebappUrl } from '../utils/apiUtils';
import { Lock, Mail, Loader2, AlertCircle, ArrowRight, Settings, Zap, CheckCircle, XCircle } from 'lucide-react';
import { ShakeInput } from '../components/ShakeInput';
import { WhatsAppConnect } from '../components/WhatsAppConnect';
import { setAdminLogin, setAdminLogout, setScriptUrl } from '../store/slices/authSlice';
import { RootState } from '../store';

export const Login: React.FC = () => {
  const dispatch = useDispatch();
  const { isAdminAuthenticated, scriptUrl: reduxScriptUrl } = useSelector((state: RootState) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [scriptUrl, setLocalScriptUrl] = useState(reduxScriptUrl || '');
  const [showUrlInput, setShowUrlInput] = useState(!reduxScriptUrl || reduxScriptUrl.trim() === '');

  // Connection Test State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failure'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdminAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAdminAuthenticated, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === 'true') {
      setEmail('admin@taxi.co.il');
      setPassword('123456');
    }
  }, [location]);

  const handleTestConnection = async () => {
    const trimmedUrl = scriptUrl.trim();
    if (!isValidWebappUrl(trimmedUrl)) {
      setTestStatus('failure');
      setTestMessage('יש להזין כתובת תקינה (https:// או http://localhost:4000)');
      return;
    }
    
    dispatch(setScriptUrl(trimmedUrl));
    await import('../api/api').then(({ initializeApiUrl }) => {
      initializeApiUrl(trimmedUrl);
    });
    
    setTestStatus('testing');
    const res = await testConnection();
    if (res.ok) {
      setTestStatus('success');
      const msg = res.data?.message || (res as any).message || 'Connected';
      const ver = res.data?.version || (res as any).version || '';
      setTestMessage(`${msg}${ver ? ` (גרסה: ${ver})` : ''}`);
    } else {
      setTestStatus('failure');
      setTestMessage(res.error || 'החיבור נכשל. בדוק את הכתובת והרשאות הסקריפט.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const trimmedUrl = scriptUrl.trim();
    if (!isValidWebappUrl(trimmedUrl)) {
      setError('⚙️ יש להגדיר כתובת שרת תקנית (הדבק http://localhost:4000 או Google Script URL ולחץ Test).');
      setIsLoading(false);
      setShowUrlInput(true);
      return;
    }

    dispatch(setScriptUrl(trimmedUrl));
    await import('../api/api').then(({ initializeApiUrl }) => {
      initializeApiUrl(trimmedUrl);
    });

    try {
      const response = await loginAdmin({ email, password });

      if (response.ok) {
        const token = response.data?.token || 'valid';
        const expiresAt = Date.now() + 1000 * 60 * 60 * 12;
        dispatch(setAdminLogin({ token, expiresAt }));
        navigate('/admin', { replace: true });
      } else {
        setError(response.error || 'התחברות נכשלה');
      }
    } catch (err) {
      setError('שגיאת תקשורת עם השרת');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] p-4 relative overflow-hidden font-sans" dir="rtl">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2"></div>

      <div className="bg-[#141A22] w-full max-w-md p-10 rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.6)] border border-white/5 relative z-10 overflow-hidden group">
        <Link to="/" className="absolute top-8 left-8 text-slate-500 hover:text-white transition-all bg-white/5 p-2 rounded-xl border border-white/5">
          <ArrowRight size={20} />
        </Link>

        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className={`absolute top-8 right-8 transition-all p-2 rounded-xl border ${
            !scriptUrl ? 'bg-amber-500 text-white animate-bounce shadow-lg shadow-amber-500/50' : 'text-slate-500 hover:text-white bg-white/5 border-white/5'
          }`}
          title="הגדרות תשתית"
        >
          <Settings size={20} />
        </button>

        <div className="text-center mb-10 pt-4">
          <div className="w-20 h-20 bg-primary-500/10 border border-primary-500/20 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl relative group-hover:scale-110 transition-transform duration-500">
            <Lock className="text-primary-400 w-10 h-10" />
            <div className="absolute -inset-2 bg-primary-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">מרכז שליטה</h1>
          <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">למורשים בלבד</p>
          {!scriptUrl && !showUrlInput && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-bold animate-pulse">
              ⚠️ שגיאה: כתובת שרת לא מוגדרת. יש ללחוץ על גלגל השיניים ולהגדיר כתובת.
            </div>
          )}
        </div>

        {showUrlInput && (
          <div className="mb-8 p-6 bg-[#0B0F14]/50 rounded-[1.5rem] border border-white/5 animate-in slide-in-from-top-4 duration-500">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-1">כתובת שרת</label>
            <div className="flex gap-3 items-center">
              <input
                type="url"
                className="flex-1 p-4 bg-[#0B0F14] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-700 outline-none focus:ring-2 focus:ring-primary-500/50 transition-all font-mono"
                placeholder="http://localhost:4000 או URL מ-Deploy"
                dir="ltr"
                value={scriptUrl}
                onChange={(e) => {
                  setLocalScriptUrl(e.target.value);
                  setTestStatus('idle');
                }}
              />
              <button type="button" onClick={handleTestConnection} className="p-4 bg-primary-500 text-slate-950 rounded-xl hover:bg-primary-400 transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50" disabled={testStatus === 'testing'}>
                {testStatus === 'testing' ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              </button>
            </div>
            {testStatus !== 'idle' && (
              <div className={`mt-4 text-[10px] font-black uppercase tracking-wider p-3 rounded-xl flex items-center gap-3 border ${testStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                testStatus === 'failure' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : ''
                }`}>
                {testStatus === 'success' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testMessage}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">מזהה משתמש</label>
            <div className="relative group/input">
              <Mail className="absolute right-4 top-4 text-slate-600 group-focus-within/input:text-primary-400 transition-colors w-5 h-5" />
              <ShakeInput
                isInvalid={!!error && error.includes('אימייל')}
                type="email"
                required
                autoComplete="email"
                className="w-full pr-12 pl-4 py-4 bg-[#0B0F14] border border-white/5 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder:text-slate-700"
                placeholder="name@taxi-pro.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">סיסמת אבטחה</label>
            <div className="relative group/input">
              <Lock className="absolute right-4 top-4 text-slate-600 group-focus-within/input:text-primary-400 transition-colors w-5 h-5" />
              <ShakeInput
                isInvalid={!!error && error.includes('סיסמה')}
                type="password"
                required
                autoComplete="current-password"
                className="w-full pr-12 pl-4 py-4 bg-[#0B0F14] border border-white/5 rounded-2xl text-white font-bold outline-none focus:ring-2 focus:ring-primary-500/50 transition-all placeholder:text-slate-700 font-mono"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-3 border border-rose-500/20 animate-pulse">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-400 text-slate-950 font-black py-5 rounded-2xl transition-all shadow-xl shadow-primary-600/20 flex items-center justify-center gap-3 relative overflow-hidden group/btn"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_2s_infinite]"></div>
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <span>כניסה למערכת</span>
                <ArrowRight size={20} className="rotate-180" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 space-y-4">
          <WhatsAppConnect />
          <div className="text-center space-y-3">
          <Link to="/station-order" className="block text-primary-400 text-sm font-black hover:text-primary-300">
            טופס הזמנה לתחנה (בלי התחברות)
          </Link>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em]">
            System v1.8.6 // TaxiPro OS
          </span>
          </div>
        </div>
      </div>
    </div>
  );
};
