import React, { useEffect, useState } from 'react';
import { PassengerApp } from '../apps/PassengerApp';
import { DriverApp } from '../apps/DriverApp';
import { mountApp } from '../bootstrap';
import { RolePicker, RoleShell, type RideRole } from '../components/ui/RolePicker';

type Role = RideRole;

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

  return <RolePicker onSelect={setRole} />;
}

mountApp(RolePickerApp, false);
