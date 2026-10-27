// Dependency-free so the worker and relay code can use it without pulling in app state.
import type { MessageKey } from './en.ts';

export type { MessageKey };
export type MessageParam = string | number | Message;

/**
 * Text to show the user, kept as a key rather than a finished string so it renders in whatever
 * language is active *when displayed*: an error on screen switches language with the rest of the UI.
 */
export interface Message {
  key: MessageKey;
  params?: Record<string, MessageParam>;
}

export const msg = (key: MessageKey, params?: Message['params']): Message => ({ key, params });

/** Any unknown error, shown verbatim. */
export const rawMessage = (text: string): Message => msg('raw', { message: text });

export class LocalizedError extends Error {
  constructor(
    readonly msg: Message,
    readonly details: string[] = [],
  ) {
    super(msg.key);
  }
}

export function toMessage(err: unknown): Message {
  if (err instanceof LocalizedError) return err.msg;
  return rawMessage(err instanceof Error ? err.message : String(err));
}
