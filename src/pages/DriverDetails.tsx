
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sendToBackend, updateDriverLocation, getDriver } from '../api/adminApi';
import { Driver } from '../types';
import { MapPin, Navigation, User, Phone, Shield, ArrowRight, Loader2 } from 'lucide-react';

export const DriverDetails: React.FC = () => {
  const { driverId } = useParams<{ driverId: string }>();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (driverId) fetchDriver(driverId);
  }, [driverId]);

  const fetchDriver = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await getDriver(id);
      if (res.ok && res.data) {
        setDriver(res.data);
      } else {
        setDriver(null);
      }
    } catch (e) {
      console.error(e);
      setDriver(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('error');
      setErrorMsg('הדפדפן שלך לא תומך במיקום');
      return;
    }

    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          if (!driverId) return;

          const res = await updateDriverLocation(driverId, latitude, longitude);
          if (res.ok) {
            setLocStatus('success');
            setTimeout(() => setLocStatus('idle'), 3000);
          } else {
            setLocStatus('error');
            setErrorMsg(res.error || 'שגיאה בעדכון שרת');
          }
        } catch (e) {
          setLocStatus('error');
          setErrorMsg('שגיאת תקשורת');
        }
      },
      (error) => {
        setLocStatus('error');
        setErrorMsg('נא לאשר גישה למיקום');
        console.error(error);
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col p-4">
        <h2 className="text-xl font-bold text-gray-800">נהג לא נמצא</h2>
        <Link to="/" className="mt-4 text-blue-600">חזור לראשי</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <Link to="/" className="absolute right-4 top-4 text-slate-400 hover:text-white">
            <ArrowRight />
          </Link>
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 shadow-inner">
            {driver.driverName ? <span className="text-3xl font-bold">{driver.driverName.charAt(0)}</span> : <User size={40} />}
          </div>
          <h1 className="text-2xl font-bold text-center">{driver.driverName}</h1>
          <p className="text-center text-slate-400 text-sm mt-1">{driver.driverId}</p>
        </div>

        {/* Info Grid */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-gray-700 p-3 bg-gray-50 rounded-lg">
            <Phone className="text-blue-500" size={20} />
            <span className="font-mono text-lg">{driver.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700 p-3 bg-gray-50 rounded-lg">
            <Shield className="text-blue-500" size={20} />
            <span>{driver.licenseNumber}</span>
            <span>{driver.taxiPlateNumber}</span>
          </div>
          <div className="flex items-center gap-3 text-gray-700 p-3 bg-gray-50 rounded-lg">
            <MapPin className="text-blue-500" size={20} />
            <span>{driver.serviceArea}</span>
          </div>

          <hr className="border-gray-100 my-4" />

          {/* Location Action */}
          <div className="text-center">
            <h3 className="font-bold text-gray-800 mb-2">עדכון סטטוס ומיקום</h3>
            <p className="text-sm text-gray-500 mb-4">לחץ כדי לשלוח את המיקום הנוכחי שלך למרכז הבקרה</p>

            <button
              onClick={handleUpdateLocation}
              disabled={locStatus === 'loading'}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition shadow-md ${locStatus === 'success' ? 'bg-green-500 text-white hover:bg-green-600' :
                locStatus === 'error' ? 'bg-red-500 text-white hover:bg-red-600' :
                  'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {locStatus === 'loading' && <Loader2 className="animate-spin" />}
              {locStatus === 'success' && 'המיקום עודכן בהצלחה!'}
              {locStatus === 'error' && (errorMsg || 'שגיאה')}
              {locStatus === 'idle' && <><Navigation /> עדכן מיקום נוכחי</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
