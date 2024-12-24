import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';
import { useBookDataStore } from '@/store/bookDataStore';
import { SYNC_NOTES_INTERVAL_SEC } from '@/services/constants';

export const useNotesSync = (bookKey: string) => {
  const { user } = useAuth();
  const { syncedNotes, syncNotes, lastSyncedAtNotes } = useSync(bookKey);
  const { getConfig, setConfig } = useBookDataStore();

  const config = getConfig(bookKey);
  const bookHash = bookKey.split('-')[0]!;

  useEffect(() => {
    if (!config || !user) return;
    syncNotes([], bookHash, 'pull');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastSyncTime = useRef<number>(0);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!config || !user) return;
    const bookNotes = config.booknotes ?? [];
    const newNotes = bookNotes.filter(
      (note) => lastSyncedAtNotes < note.updatedAt || lastSyncedAtNotes < (note.deletedAt ?? 0),
    );
    newNotes.forEach((note) => {
      note.bookHash = bookHash;
    });
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTime.current;
    if (timeSinceLastSync > SYNC_NOTES_INTERVAL_SEC * 1000) {
      lastSyncTime.current = now;
      syncNotes(newNotes, bookHash, 'both');
    } else {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(
        () => {
          lastSyncTime.current = Date.now();
          syncNotes(newNotes, bookHash, 'both');
          syncTimeoutRef.current = null;
        },
        SYNC_NOTES_INTERVAL_SEC * 1000 - timeSinceLastSync,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (syncedNotes?.length && config) {
      const newNotes = syncedNotes.filter((note) => note.bookHash === bookHash);
      if (!newNotes.length) return;
      const oldNotes = config.booknotes ?? [];
      const mergedNotes = [
        ...oldNotes.filter((oldNote) => !newNotes.some((newNote) => newNote.id === oldNote.id)),
        ...newNotes,
      ];
      setConfig(bookKey, { ...config, booknotes: mergedNotes });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedNotes]);
};
