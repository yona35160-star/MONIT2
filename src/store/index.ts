import { configureStore } from '@reduxjs/toolkit';
import ordersReducer from './slices/ordersSlice';
import driversReducer from './slices/driversReducer';
import statsReducer from './slices/statsSlice';
import settingsReducer from './slices/settingsSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
    reducer: {
        orders: ordersReducer,
        drivers: driversReducer,
        stats: statsReducer,
        settings: settingsReducer,
        auth: authReducer,
    },
    devTools: process.env.NODE_ENV !== 'production',
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
