/**
 * What the backend served, per RTK Query endpoint name, for the lists it bounds.
 *
 * The backend caps the lists that grow with the life of a farm (sales, invoices, stock
 * movements…) and reports `total` / `truncated` in the response `meta`. Endpoints unwrap the
 * envelope with `transformResponse: r => r.data`, so `meta` would be lost — and a screen would
 * show the 500 newest rows as if they were the whole history.
 *
 * It is recorded here rather than carried alongside the rows: the lists get filtered and re-sliced
 * all over the UI, and a count smuggled onto the array would be dropped by the first `.filter()`.
 *
 * Not persisted: it describes one answer from the server, and a stale notice after an app restart
 * would be worse than none.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export interface ListWindow {
  total: number;
  size: number;
}

type ListWindowState = Record<string, ListWindow>;

const listWindowSlice = createSlice({
  name: 'listWindow',
  initialState: {} as ListWindowState,
  reducers: {
    listWindowServed: (
      state,
      action: PayloadAction<{ endpoint: string; truncated: boolean; total: number; size: number }>,
    ) => {
      const { endpoint, truncated, total, size } = action.payload;
      if (truncated) {
        state[endpoint] = { total, size };
      } else {
        delete state[endpoint];
      }
    },
  },
});

export const { listWindowServed } = listWindowSlice.actions;
export const listWindowReducer = listWindowSlice.reducer;

export function selectListWindow(endpoint: string) {
  return (state: RootState): ListWindow | undefined => state.listWindow[endpoint];
}
