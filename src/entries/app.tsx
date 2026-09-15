import React, { useEffect, useState } from 'react';
import { PassengerApp } from '../apps/PassengerApp';
import { DriverApp } from '../apps/DriverApp';
import { mountApp } from '../bootstrap';

type Role = 'passenger' | 'driver';

function readInitialRole(): Role | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('role');
  if (fromQuery === 'passenger' || fromQuery === 'driver') return fromQuery;
  const hash = window.location.hash.toLowerCase();
  if (hash.includes('driver')) return 'driver';
  if (hash.includes('passenger')) return 'passenger';
  const saved = localStorage.getItem('taxipro_role');
  if (saved === 'passenger' || saved === 'driver') return saved;
  return null;
}

function RolePickerApp() {
  const [role, setRole] = useState<Role | null>(() => readInitialRole());

  useEffect(() => {
    if (!role) return;
    localStorage.setItem('taxipro_role', role);
    const url = new URL(window.location.href);
    url.searchParams.set('role', role);
    window.history.replaceState({}, '', url.toString());
  }, [role]);

  if (role === 'passenger') return <PassengerApp />;
  if (role === 'driver') return <DriverApp />;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 text-white p-6"
      dir="rtl"
    >
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black">אפליקציית נסיעה</h1>
        <p className="text-slate-400">בחרו תפקיד כדי להמשיך</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <button
          type="button"
          className="flex-1 rounded-2xl bg-amber-400 text-slate-950 font-bold py-4 text-lg hover:bg-amber-300"
          onClick={() => setRole('passenger')}
        >
          נוסע
        </button>
        <button
          type="button"
          className="flex-1 rounded-2xl bg-slate-800 border border-slate-600 font-bold py-4 text-lg hover:bg-slate-700"
          onClick={() => setRole('driver')}
        >
          נהג
        </button>
      </div>
      <button
        type="button"
        className="text-sm text-slate-500 underline"
        onClick={() => {
          localStorage.removeItem('taxipro_role');
          setRole(null);
        }}
      >
        איפוס בחירה
      </button>
    </div>
  );
}

mountApp(RolePickerApp, false);
