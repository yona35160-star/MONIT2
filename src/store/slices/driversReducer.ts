import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Driver } from '../../types';

interface DriversState {
  activeDrivers: Driver[];
  isLoading: boolean;
  error: string | null;
}

const initialState: DriversState = {
  activeDrivers: [],
  isLoading: false,
  error: null,
};

const driversSlice = createSlice({
  name: 'drivers',
  initialState,
  reducers: {
    setActiveDrivers(state, action: PayloadAction<Driver[]>) {
      state.activeDrivers = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setDriversLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setDriversError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setActiveDrivers, setDriversLoading, setDriversError } = driversSlice.actions;
export default driversSlice.reducer;
