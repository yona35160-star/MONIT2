import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAdminAuthenticated: boolean;
  isDriverAuthenticated: boolean;
  adminToken: string | null;
  adminExpiresAt: number | null;
  driverToken: string | null;
  driverId: string | null;
  scriptUrl: string;
}

const ADMIN_TOKEN_KEY = 'taxi_auth_token';
const DRIVER_TOKEN_KEY = 'taxi_driver_token';
const SCRIPT_URL_KEY = 'taxi_app_script_url';

const savedAdminToken = localStorage.getItem(ADMIN_TOKEN_KEY);
const savedDriverToken = localStorage.getItem(DRIVER_TOKEN_KEY);
const savedScriptUrl = localStorage.getItem(SCRIPT_URL_KEY) || import.meta.env.VITE_WEBAPP_URL || '';

const initialState: AuthState = {
  isAdminAuthenticated: !!savedAdminToken,
  isDriverAuthenticated: !!savedDriverToken,
  adminToken: savedAdminToken,
  adminExpiresAt: null,
  driverToken: savedDriverToken,
  driverId: localStorage.getItem('taxi_driver_id'),
  scriptUrl: savedScriptUrl,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAdminLogin(state, action: PayloadAction<{ token: string; expiresAt?: number }>) {
      state.isAdminAuthenticated = true;
      state.adminToken = action.payload.token;
      state.adminExpiresAt = action.payload.expiresAt ?? null;
      localStorage.setItem(ADMIN_TOKEN_KEY, action.payload.token);
    },
    setAdminLogout(state) {
      state.isAdminAuthenticated = false;
      state.adminToken = null;
      state.adminExpiresAt = null;
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    },
    setDriverLogin(state, action: PayloadAction<{ token: string; driverId?: string }>) {
      state.isDriverAuthenticated = true;
      state.driverToken = action.payload.token;
      state.driverId = action.payload.driverId ?? null;
      localStorage.setItem(DRIVER_TOKEN_KEY, action.payload.token);
      if (action.payload.driverId) {
        localStorage.setItem('taxi_driver_id', action.payload.driverId);
      }
    },
    setDriverLogout(state) {
      state.isDriverAuthenticated = false;
      state.driverToken = null;
      state.driverId = null;
      localStorage.removeItem(DRIVER_TOKEN_KEY);
      localStorage.removeItem('taxi_driver_id');
      localStorage.removeItem('driver_phone');
    },
    setScriptUrl(state, action: PayloadAction<string>) {
      state.scriptUrl = action.payload;
      localStorage.setItem(SCRIPT_URL_KEY, action.payload);
    },
  },
});

export const { setAdminLogin, setAdminLogout, setDriverLogin, setDriverLogout, setScriptUrl } = authSlice.actions;
export default authSlice.reducer;
