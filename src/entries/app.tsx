import React, { useEffect, useState } from 'react';
import { PassengerApp } from '../apps/PassengerApp';
import { DriverApp } from '../apps/DriverApp';
import { mountApp } from '../bootstrap';
import { Button, Card } from '../components/ui';

type Role = 'passenger' | 'driver';

function readInitialRole(): Role | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('role');
  if (fromQuery === 'passenger' || fromQuery === 'driver') return fromQuery;
  const hash = window.location.hash.toLowerCase();
  if (hash.includes('driver') || hash.startsWith('#/portal') || hash.includes('accept-ride') || hash.includes('complete-ride')) {
    return 'driver';
  }
  if (hash.includes('passenger') || hash.includes('/order') || hash.includes('track-order')) {
    return 'passenger';
  }
  const saved = localStorage.getItem('taxipro_role');
  if (saved === 'passenger' || saved === 'driver') return saved;
  return null;
}

function RoleShell({ role, onSwitch, children }: { role: Role; onSwitch: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      <div className="sticky top-0 z-[200] flex items-center justify-between gap-3 px-3 py-2 bg-slate-950/95 text-white border-b border-slate-800 backdrop-blur">
        <div className="text-sm font-bold">
          אפליקציית נסיעה · {role === 'passenger' ? 'נוסע' : 'נהג'}
        </div>
        <button
          type="button"
          className="text-xs font-bold text-amber-300 underline underline-offset-2"
          onClick={onSwitch}
        >
          החלף תפקיד
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
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

  const clearRole = () => {
    localStorage.removeItem('taxipro_role');
    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    window.history.replaceState({}, '', url.toString());
    setRole(null);
  };

  if (role === 'passenger') {
    return (
      <RoleShell role="passenger" onSwitch={clearRole}>
        <PassengerApp />
      </RoleShell>
    );
  }
  if (role === 'driver') {
    return (
      <RoleShell role="driver" onSwitch={clearRole}>
        <DriverApp />
      </RoleShell>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-950 text-white p-6" dir="rtl">
      <Card variant="dark" padding="lg" className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight">אפליקציית נסיעה</h1>
          <p className="text-slate-400 text-sm">בחרו תפקיד כדי להמשיך. אפשר להחליף בכל רגע.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button variant="accent" size="lg" className="w-full" onClick={() => setRole("passenger")}>
            נוסע — הזמנה ומעקב
          </Button>
          <Button
            className="w-full py-4 text-lg"
            variant="secondary"
            onClick={() => setRole('driver')}
          >
            נהג — תור נסיעות ופורטל
          </Button>
        </div>
      </Card>
    </div>
  );
}

mountApp(RolePickerApp, false);
