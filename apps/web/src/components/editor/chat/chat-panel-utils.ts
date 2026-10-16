import { useChatStore } from '@/stores/chat-store';

export function downloadJson(fileName: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function waitForIdle(): Promise<void> {
  if (!useChatStore.getState().pending) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useChatStore.subscribe((state) => {
      if (!state.pending) {
        unsubscribe();
        resolve();
      }
    });
  });
}
