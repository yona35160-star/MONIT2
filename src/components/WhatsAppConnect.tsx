import React, { useEffect, useState } from 'react';
import { Loader2, QrCode, RefreshCw, Smartphone } from 'lucide-react';

type SessionState = {
  connected: boolean;
  waitingForQr?: boolean;
};

export const WhatsAppConnect: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrPage, setQrPage] = useState('');
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState(import.meta.env.VITE_STATION_WHATSAPP_PHONE || '');
  const [pairCode, setPairCode] = useState('');
  const [pairing, setPairing] = useState(false);

  const check = async () => {
    try {
      const { discoverLocalBridgeUrl, getLocalBridgeKey } = await import('../api/localBridge');
      const url = await discoverLocalBridgeUrl();
      const key = getLocalBridgeKey();
      if (!url) {
        setConnected(false);
        setQr(null);
        setError('הגשר המקומי לא מגיב — הפעל START-ALL.bat');
        return;
      }
      setBridgeUrl(url);
      if (key) setQrPage(`${url}/qr?role=dispatcher&key=${encodeURIComponent(key)}`);
      const res = await fetch(`${url}/status?key=${encodeURIComponent(key)}`, {
        signal: AbortSignal.timeout(5000)
      });
      const json = await res.json();
      const sessions = json?.data?.userData?.roles as Record<string, SessionState> | undefined;
      const anyConnected = !!(sessions && Object.values(sessions).some(s => s && s.connected));
      setConnected(anyConnected);
      setQr(anyConnected ? null : (json?.data?.qr || null));
      if (anyConnected) setPairCode('');
      else setPairCode(json?.data?.pairingCode || '');
      setError(anyConnected ? '' : (json?.data?.qr || json?.data?.pairingCode ? '' : 'חבר עם קוד קישור או סרוק QR'));
    } catch {
      setConnected(false);
      setQr(null);
      setError('הגשר המקומי לא מגיב — הפעל START-ALL.bat');
    } finally {
      setChecking(false);
    }
  };

  const requestPair = async (targetPhone: string) => {
    if (!bridgeUrl || !targetPhone.trim()) return;
    setPairing(true);
    try {
      const { getLocalBridgeKey } = await import('../api/localBridge');
      const res = await fetch(`${bridgeUrl}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': getLocalBridgeKey() },
        body: JSON.stringify({ phone: targetPhone.trim(), role: 'dispatcher' })
      });
      const json = await res.json();
      if (json.code) setPairCode(json.code);
      else setError(json.error || 'לא הצלחנו להנפיק קוד');
    } catch {
      setError('הגשר לא הגיב לבקשת הקוד');
    } finally {
      setPairing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await check();
    };
    tick();
    const id = setInterval(tick, connected ? 20000 : 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [connected]);

  // Do not auto-request pairing codes. Repeated requestPairingCode()
  // closes the Baileys socket (408 → 401) and wipes the session.

  return (
    <div className="bg-[#1E293B] border border-white/5 rounded-3xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center">
      <div className="flex-1 space-y-2">
        <h3 className="text-white font-black text-lg flex items-center gap-2">
          <Smartphone size={20} className="text-emerald-400" />
          חיבור ווטסאפ מקומי
        </h3>
        {connected ? (
          <p className="text-emerald-400 font-bold text-sm">מחובר — הזמנות יישלחו לקבוצה ולהודעות פרטיות</p>
        ) : (
          <p className="text-slate-400 text-sm font-medium">
            הזן את הקוד בווטסאפ: מכשירים מקושרים → קישור עם מספר טלפון. מספיק חיבור אחד לקבוצה ולפרטי.
          </p>
        )}
        {error && !connected && <p className="text-amber-400 text-xs font-bold">{error}</p>}
        {!connected && (
          <form
            className="flex flex-col sm:flex-row gap-2 pt-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await requestPair(phone);
            }}
          >
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="טלפון התחנה (050...)"
              className="flex-1 bg-[#0F172A] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold"
            />
            <button type="submit" disabled={pairing} className="bg-emerald-600 text-white text-xs font-black px-4 py-2 rounded-xl">
              {pairing ? '...' : 'קבל קוד קישור'}
            </button>
          </form>
        )}
        {pairCode && !connected && (
          <p className="text-white text-4xl font-black tracking-[0.35em] pt-1" dir="ltr">
            {pairCode.replace(/[^A-Za-z0-9]/g, '').replace(/(.{4})/g, '$1-').replace(/-$/, '')}
          </p>
        )}
        {pairCode && !connected && (
          <p className="text-slate-500 text-xs font-bold">ווטסאפ → מכשירים מקושרים → קישור עם מספר טלפון → הזן את הקוד</p>
        )}
        {qrPage && !connected && (
          <a href={qrPage} target="_blank" rel="noreferrer" className="inline-block text-emerald-400 text-xs font-black underline">
            או פתח עמוד QR גדול לסריקה
          </a>
        )}
        <button
          type="button"
          onClick={check}
          className="mt-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          רענון סטטוס
        </button>
      </div>
      {!connected && qr && (
        <div className="bg-white p-3 rounded-2xl">
          <img src={qr} alt="QR ווטסאפ" className="w-40 h-40" />
        </div>
      )}
      {!connected && !qr && (
        <div className="w-40 h-40 rounded-2xl bg-[#0F172A] border border-white/10 flex items-center justify-center text-slate-600">
          <QrCode size={36} />
        </div>
      )}
    </div>
  );
};
