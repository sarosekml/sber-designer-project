/**
 * Chat store constants (0136 R12 — extracted from chat-store.ts so the store
 * and its helpers can share them without importing each other).
 */
import type { ChatMessage } from './chat-store-types';

export const GLOBAL_ASSISTANT_SCREEN_ID = '__global__';
export const STORYBOOK_ASSISTANT_SCREEN_ID = '__storybook__';
export const DESIGN_SYSTEM_ASSISTANT_SCREEN_ID = '__design-system__';

export const SEED: ChatMessage[] = [
  {
    id: 'seed-welcome',
    role: 'assistant',
    content:
      'Hi! Let’s design something cool together. Tell me what you’d like to build — I can read files, list components, edit code with structured patches, and switch the editor mode.',
    contextEligible: false,
  },
];

let counter = 0;
export const nextId = (prefix = 'm') => `${prefix}-${Date.now()}-${counter++}`;
