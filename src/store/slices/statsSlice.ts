import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DashboardStats } from '../../types';

interface StatsState {
  data: DashboardStats | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: StatsState = {
  data: null,
  isLoading: false,
  error: null,
};

const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    setStatsData(state, action: PayloadAction<DashboardStats>) {
      state.data = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setStatsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setStatsError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setStatsData, setStatsLoading, setStatsError } = statsSlice.actions;
export default statsSlice.reducer;
