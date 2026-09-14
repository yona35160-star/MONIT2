import { CapacitorConfig } from '@capacitor/cli';

const target = process.env.CAPACITOR_TARGET || process.env.VITE_APP_TARGET || 'passenger';

const configs: Record<string, CapacitorConfig> = {
  passenger: {
    appId: 'com.taxipro.passenger',
    appName: 'TaxiPro',
    webDir: 'dist/passenger'
  },
  driver: {
    appId: 'com.taxipro.driver',
    appName: 'TaxiPro Driver',
    webDir: 'dist/driver'
  },
  admin: {
    appId: 'com.taxipro.admin',
    appName: 'TaxiPro Admin',
    webDir: 'dist/admin'
  }
};

const config: CapacitorConfig = configs[target] || configs.passenger;

export default config;
