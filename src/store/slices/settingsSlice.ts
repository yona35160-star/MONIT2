import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SystemSettings } from '../../types';

interface SettingsState {
  data: SystemSettings | null;
  isLoading: boolean;
}

const initialState: SettingsState = {
  data: null,
  isLoading: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettingsData(state, action: PayloadAction<SystemSettings | null | undefined>) {
      const payload = action.payload;
      state.data = payload && typeof payload === 'object' ? payload : ({} as SystemSettings);
      state.isLoading = false;
    },
    setSettingsLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setSettingsData, setSettingsLoading } = settingsSlice.actions;
export default settingsSlice.reducer;
