import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface UiState {
  selectedFarmId: number | null;
  sidebarCollapsed: boolean;
}

const initialState: UiState = {
  selectedFarmId: null,
  sidebarCollapsed: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setSelectedFarmId: (state, action: PayloadAction<number | null>) => {
      state.selectedFarmId = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { setSelectedFarmId, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
