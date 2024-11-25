import { create } from 'zustand';
import { BookNote } from '@/types/book';
import { TextSelection } from '@/utils/sel';

interface NotebookState {
  notebookWidth: string;
  isNotebookVisible: boolean;
  isNotebookPinned: boolean;
  notebookNewAnnotation: TextSelection | null;
  notebookEditAnnotation: BookNote | null;
  toggleNotebook: () => void;
  toggleNotebookPin: () => void;
  setNotebookWidth: (width: string) => void;
  setNotebookVisible: (visible: boolean) => void;
  setNotebookPin: (pinned: boolean) => void;
  setNotebookNewAnnotation: (selection: TextSelection | null) => void;
  setNotebookEditAnnotation: (note: BookNote | null) => void;
}

export const useNotebookStore = create<NotebookState>((set) => ({
  notebookWidth: '',
  isNotebookVisible: false,
  isNotebookPinned: false,
  notebookNewAnnotation: null,
  notebookEditAnnotation: null,
  setNotebookWidth: (width: string) => set({ notebookWidth: width }),
  toggleNotebook: () => set((state) => ({ isNotebookVisible: !state.isNotebookVisible })),
  toggleNotebookPin: () => set((state) => ({ isNotebookPinned: !state.isNotebookPinned })),
  setNotebookVisible: (visible: boolean) => set({ isNotebookVisible: visible }),
  setNotebookPin: (pinned: boolean) => set({ isNotebookPinned: pinned }),
  setNotebookNewAnnotation: (selection: TextSelection | null) =>
    set({ notebookNewAnnotation: selection }),
  setNotebookEditAnnotation: (note: BookNote | null) => set({ notebookEditAnnotation: note }),
}));
