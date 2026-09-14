import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Order } from '../../types';

interface OrdersState {
  activeOrders: Order[];
  historicalOrders: Order[];
  isLoading: boolean;
  error: string | null;
}

const initialState: OrdersState = {
  activeOrders: [],
  historicalOrders: [],
  isLoading: false,
  error: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrdersLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setOrdersError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isLoading = false;
    },
    setActiveOrders(state, action: PayloadAction<Order[]>) {
      state.activeOrders = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    setHistoricalOrders(state, action: PayloadAction<Order[]>) {
      state.historicalOrders = action.payload;
    },
    updateActiveOrder(state, action: PayloadAction<Partial<Order> & { orderId: string }>) {
      const idx = state.activeOrders.findIndex(o => o.orderId === action.payload.orderId);
      if (idx !== -1) {
        state.activeOrders[idx] = { ...state.activeOrders[idx], ...action.payload };
      }
    },
  },
});

export const { setOrdersLoading, setOrdersError, setActiveOrders, setHistoricalOrders, updateActiveOrder } = ordersSlice.actions;
export default ordersSlice.reducer;
