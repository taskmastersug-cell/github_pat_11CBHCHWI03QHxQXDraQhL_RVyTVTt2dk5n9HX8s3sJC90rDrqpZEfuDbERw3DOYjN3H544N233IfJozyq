import { create } from 'zustand';

type State = { nin: string | null };
type Actions = { setNin: (n: string) => void; reset: () => void };

export const useKycDraft = create<State & Actions>((set) => ({
  nin: null,
  setNin: (nin) => set({ nin }),
  reset: () => set({ nin: null }),
}));
