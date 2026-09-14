import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSystemSettingsRaw, saveSettings, getSystemHealth, sendToBackend } from '../api/adminApi';
import { Toast } from '../components/Toast';
import { Save, ArrowLeft, Loader2, CheckCircle, Plus, Trash2, Zap, AlertTriangle } from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'success'>('loading');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Dual Bridge Status State
  const [localStatus, setLocalStatus] = useState<{ connected: boolean; error?: string; qr?: string } | null>(null);
  const [renderStatus, setRenderStatus] = useState<{ connected: boolean; error?: string; qr?: string } | null>(null);
  const [isCheckingBridge, setIsCheckingBridge] = useState(false);


  // New Setting State
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setStatus('loading');
    const res = await getSystemSettingsRaw({ force: true });
    if (res.ok && res.data) {
      const formattedData: Record<string, string> = {};
      Object.entries(res.data).forEach(([k, v]) => {
        formattedData[k] = String(v ?? '');
      });

      // Auto-fill fallback from .env if missing from backend
      if (!formattedData['WHATSAPP_RENDER_URL'] && import.meta.env.VITE_WHATSAPP_RENDER_URL) {
        formattedData['WHATSAPP_RENDER_URL'] = import.meta.env.VITE_WHATSAPP_RENDER_URL;
      }

      setSettings(formattedData);
      // Initialize API URL from settings on load
      const responseData = formattedData;
      const scriptsUrl = responseData['SCRIPTS_URL'] || responseData['SCRIPTS_GAS_URL'] || responseData['WEBAPP_URL'];
      if (scriptsUrl && scriptsUrl.startsWith('https://')) {
        await import('../api/api').then(({ initializeApiUrl }) => {
          initializeApiUrl(scriptsUrl);
        });
      }
      checkBridgeConnection(formattedData);
    } else {
      setToast({ message: 'שגיאה בטעינת הגדרות', type: 'error' });
    }
    setStatus('idle');
  };

  const checkBridgeConnection = async (currentSettings?: Record<string, string>) => {
    setIsCheckingBridge(true);
    try {
      const activeSettings = currentSettings || settings;
      const localUrl = activeSettings['WHATSAPP_BRIDGE_URL']
        || import.meta.env.VITE_WHATSAPP_BRIDGE_URL
        || 'http://localhost:3002';
      const renderUrl = activeSettings['WHATSAPP_RENDER_URL'] || import.meta.env.VITE_WHATSAPP_RENDER_URL || '';
      const rawKey = activeSettings['BRIDGE_API_KEY'];
      const apiKey = (rawKey && !['[HIDDEN]', '[SECURELY_STORED_IN_PROPS]', '***'].includes(rawKey))
        ? rawKey
        : (import.meta.env.VITE_BRIDGE_API_KEY || '');
      
      const { getBothBridgeStatuses } = await import('../api/api');
      const res = await getBothBridgeStatuses(localUrl, renderUrl, apiKey);
      
      if (res.local.ok && res.local.data) {
        setLocalStatus({ connected: !!res.local.data.connected, qr: res.local.data.qr || undefined });
      } else {
        setLocalStatus({ connected: false, error: res.local.error || 'הגשר לא מגיב' });
      }

      if (res.render.ok && res.render.data) {
        setRenderStatus({ connected: !!res.render.data.connected, qr: res.render.data.qr || undefined });
      } else {
        setRenderStatus({ connected: false, error: res.render.error || 'הגשר לא מגיב' });
      }
    } catch (e: any) {
      setLocalStatus({ connected: false, error: 'שגיאת תקשורת' });
      setRenderStatus({ connected: false, error: 'שגיאת תקשורת' });
    }
    setIsCheckingBridge(false);
  };


  const bridgeMeta = {
    url: settings['WHATSAPP_BRIDGE_URL'] || '',
    updatedAt: settings['WHATSAPP_BRIDGE_URL_UPDATED_AT'] || '',
    updatedBy: settings['WHATSAPP_BRIDGE_URL_UPDATED_BY'] || '',
    tunnelType: settings['WHATSAPP_BRIDGE_TUNNEL_TYPE'] || ''
  };

  const handleSave = async () => {
    setStatus('saving');
    const res = await saveSettings(settings); // Send exactly what matches the Sheet
    if (res.ok) {
      // Update API URL from settings if SCRIPTS_URL or SCRIPTS_GAS_URL is provided
      const scriptsUrl = settings['SCRIPTS_URL'] || settings['SCRIPTS_GAS_URL'] || settings['WEBAPP_URL'];
      if (scriptsUrl && scriptsUrl.startsWith('https://')) {
        await import('../api/api').then(({ initializeApiUrl }) => {
          initializeApiUrl(scriptsUrl);
        });
      }
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      checkBridgeConnection(); // Re-check bridge after save
    } else {
      setStatus('idle');
      setToast({ message: 'שגיאה בשמירה: ' + res.error, type: 'error' });
    }
  };

  const handleDelete = (key: string) => {
    if (confirm(`למחוק את המפתח "${key}"?`)) {
      const next = { ...settings };
      delete next[key];
      setSettings(next);
    }
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    if (settings[newKey]) {
      setToast({ message: 'מפתח זה כבר קיים!', type: 'error' });
      return;
    }
    setSettings({ ...settings, [newKey]: newValue });
    setNewKey('');
    setNewValue('');
  };

  const getType = (key: string) => {
    const k = key.toUpperCase();
    if (k.includes('KEY') || k.includes('PASSWORD') || k.includes('TOKEN') || k.includes('SECRET')) return 'password';
    // List of fields that are strictly numeric
    const numericFields = [
      'STATION_COMMISSION_PCT', 'DEFAULT_RADIUS_KM', 'BASE_PRICE', 'PRICE_PER_KM',
      'CACHE_TTL_DASHBOARD', 'CACHE_TTL_ORDERS', 'CACHE_TTL_DRIVERS',
      'MAX_LOGIN_ATTEMPTS', 'LOGIN_LOCKOUT_SEC', 'ORDER_RATE_LIMIT_SEC',
      'FORCE_SYNC_LIMIT', 'BRIDGE_HEARTBEAT_INTERVAL_MINUTES', 'LAST_ORDER_ID'
    ];
    if (numericFields.includes(k) || ((k.endsWith('_PCT') || k.endsWith('_SEC') || k.endsWith('_MINUTES')) && !k.includes('project') && !k.includes('jid'))) return 'number';
    return 'text';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-10 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">

        {/* Header */}
        <header className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900">הגדרות מערכת (Raw Editor)</h1>
            <p className="text-gray-500 text-sm">עריכה ישירה של נתוני הגוגל-שיטס</p>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchSettings} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition text-slate-600" title="רענן נתונים מהגיליון">
              <Loader2 className={status === 'loading' ? "animate-spin" : ""} size={20} />
            </button>
            <button onClick={async () => {
              if (confirm('זה יבנה מחדש הגדרות חסרות וגיליונות חסרים. להמשיך?')) {
                setStatus('saving');
                const res = await sendToBackend<any>('setupSystem', {});
                setStatus('idle');
                if (res.ok) {
                  setToast({ message: 'המערכת הותקנה/עודכנה בהצלחה!', type: 'success' });
                  fetchSettings();
                } else {
                  setToast({ message: 'שגיאה בהתקנה: ' + res.error, type: 'error' });
                }
              }
            }} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition text-primary-600" title="הרץ התקנת מערכת (setupSystem)">
              <Zap size={20} />
            </button>
            <button onClick={handleSave} disabled={status === 'saving'} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition">
              {status === 'saving' ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {status === 'success' ? 'נשמר!' : 'שמור שינויים'}
            </button>
            <Link to="/admin" className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition"><ArrowLeft size={20} className="text-slate-600" /></Link>
          </div>
        </header>

        <div className="p-8 space-y-8">

          {/* Script URL Setup Hint */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 flex gap-3">
            <AlertTriangle className="text-blue-600 shrink-0" size={20} />
            <div className="text-sm">
              <p className="font-bold text-blue-900 mb-1">⚙️ הגדרת Script URL</p>
              <p className="text-blue-800 text-xs">
                אם קיבלת שגיאה "כתובת השרת לא הוגדרה", הוסף את ה-Google Apps Script URL כ-<code className="bg-blue-100 px-1 rounded">SCRIPTS_URL</code> או <code className="bg-blue-100 px-1 rounded">SCRIPTS_GAS_URL</code> בהגדרות למטה ועדכנו את השרת.
                <br />
                דוגמה: <code className="bg-blue-100 px-1.5 py-0.5 text-xs font-mono">https://script.google.com/macros/s/YOUR_ID/exec</code>
              </p>
            </div>
          </div>
          {/* Bridge Redundancy & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Bridge Card */}
            <div className={`p-5 rounded-3xl border ${localStatus?.connected ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'} transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${localStatus?.connected ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Zap size={20} className={isCheckingBridge ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">גשר מקומי (Local)</h3>
                    <p className={`text-[10px] font-bold ${localStatus?.connected ? 'text-green-600' : 'text-slate-400'}`}>
                      {localStatus?.connected ? 'מחובר ופעיל' : localStatus?.error || 'לא מחובר'}
                    </p>
                  </div>
                </div>
                {localStatus?.qr && !localStatus.connected && (
                  <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <img src={localStatus.qr} className="w-16 h-16" alt="QR" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mb-1 truncate">{settings['WHATSAPP_BRIDGE_URL'] || 'לא הוגדר URL מקומי'}</p>
            </div>

            {/* Cloud Bridge Card (Render) */}
            <div className={`p-5 rounded-3xl border ${renderStatus?.connected ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'} transition-all`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${renderStatus?.connected ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                    <CheckCircle size={20} className={isCheckingBridge ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">גשר ענן (Render)</h3>
                    <p className={`text-[10px] font-bold ${renderStatus?.connected ? 'text-blue-600' : 'text-slate-400'}`}>
                      {renderStatus?.connected ? 'מחובר ופעיל' : renderStatus?.error || 'לא מחובר'}
                    </p>
                  </div>
                </div>
                {renderStatus?.qr && !renderStatus.connected && (
                  <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                    <img src={renderStatus.qr} className="w-16 h-16" alt="QR" />
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-mono mb-1 truncate">{settings['WHATSAPP_RENDER_URL'] || 'לא הוגדר URL ענן'}</p>
            </div>
          </div>

          {/* Bridge Mode Selector */}
          <div className="p-6 bg-slate-900 rounded-[2.5rem] text-white shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-xl font-black mb-1">מצב עבודה (Bridge Mode)</h3>
                <p className="text-slate-400 text-sm">קבע איזה שרת יבצע את שליחת ההודעות בפועל</p>
              </div>
              
              <div className="bg-slate-800 p-1.5 rounded-2xl flex gap-1 border border-slate-700">
                {[
                  { id: 'AUTO', label: 'אוטומטי (AUTO)', desc: 'מעדיף מקומי, עובר לענן אם נכשל' },
                  { id: 'LOCAL', label: 'מקומי בלבד', desc: 'שליחה רק דרך המחשב במשרד' },
                  { id: 'RENDER', label: 'ענן בלבד', desc: 'שליחה רק דרך שרת Render' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setSettings({ ...settings, BRIDGE_MODE: mode.id })}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${
                      (settings['BRIDGE_MODE'] || 'AUTO') === mode.id 
                      ? 'bg-white text-slate-900 shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={mode.desc}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>


          {status === 'loading' ? (
            <div className="flex justify-center p-20"><Loader2 className="animate-spin text-slate-400" size={40} /></div>
          ) : (
            <div className="space-y-2">
              {/* Headers */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-500 uppercase">
                <div className="col-span-4">Setting Key</div>
                <div className="col-span-7">Value</div>
                <div className="col-span-1 text-center">Action</div>
              </div>

              {/* Rows */}
              {Object.keys(settings).sort().map(key => (
                <div key={key} className="grid grid-cols-12 gap-4 items-center group">
                  <div className="col-span-4">
                    <input
                      className="w-full bg-transparent font-bold text-slate-700 text-sm focus:outline-none cursor-default"
                      value={key}
                      readOnly
                      title={key}
                    />
                  </div>
                  <div className="col-span-7">
                    <input
                      type={getType(key) === 'password' ? 'text' : getType(key)} // Show passwords in raw editor? Usually yes for debugging, but let's be safe. User said "Raw Editor". Actually user needs to see keys. I'll make it text but standard input.
                      className="w-full p-2 bg-slate-50 border border-transparent hover:border-slate-200 focus:border-yellow-400 focus:bg-white rounded-lg transition-all text-sm font-mono"
                      value={settings[key]}
                      onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDelete(key)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}

              {/* Add New Row */}
              <div className="grid grid-cols-12 gap-4 items-center pt-6 mt-6 border-t border-dashed border-slate-200">
                <div className="col-span-4">
                  <input
                    placeholder="NEW_KEY_NAME"
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm uppercase font-bold placeholder-slate-300"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                  />
                </div>
                <div className="col-span-7">
                  <input
                    placeholder="Value..."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button onClick={handleAdd} disabled={!newKey} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50"><Plus size={16} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};
