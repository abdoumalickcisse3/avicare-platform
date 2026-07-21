/**
 * Selected-farm state — shared by the batch list (task 8) and every later
 * field screen (task 9+: entry screens all need to know which farm's unit
 * they're recording against).
 *
 * Deliberately its own tiny slice, not part of the auth session and not in
 * SecureStore (`@/auth/tokens`): the chosen farm is a convenience — skip
 * re-picking it after an app restart — never a secret. Persisted through
 * `redux-persist` (see `@/store/persist`), alongside the RTK Query cache.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

interface SelectionState {
  selectedFarmId: number | null;
}

const initialState: SelectionState = {
  selectedFarmId: null,
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    setSelectedFarmId(state, action: PayloadAction<number | null>) {
      state.selectedFarmId = action.payload;
    },
  },
});

export const { setSelectedFarmId } = selectionSlice.actions;
export const selectionReducer = selectionSlice.reducer;

export function selectSelectedFarmId(state: RootState): number | null {
  return state.selection.selectedFarmId;
}
