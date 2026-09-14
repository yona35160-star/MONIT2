import React from 'react';
import { AdminApp } from './apps/AdminApp';
import { DriverApp } from './apps/DriverApp';
import { PassengerApp } from './apps/PassengerApp';

/** Single entry that delegates to the same shells used by admin/driver/passenger.html */
const App: React.FC = () => {
  const mode = import.meta.env.MODE;
  if (mode === 'admin') return <AdminApp />;
  if (mode === 'driver') return <DriverApp />;
  return <PassengerApp />;
};

export default App;
