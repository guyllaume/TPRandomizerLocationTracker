export const TRACKER_HISTORY_LIMIT = 50;

export interface HistoryState<T> {
  past: T[];
  future: T[];
}

export interface HistoryTransition<T> {
  history: HistoryState<T>;
  snapshot?: T;
}

export function createHistory<T>(): HistoryState<T> {
  return { past: [], future: [] };
}

export function pushHistory<T>(
  history: HistoryState<T>,
  current: T,
  limit = TRACKER_HISTORY_LIMIT,
): HistoryState<T> {
  return {
    past: [...history.past, current].slice(-limit),
    future: [],
  };
}

export function undoHistory<T>(
  history: HistoryState<T>,
  current: T,
): HistoryTransition<T> {
  const snapshot = history.past.at(-1);
  if (snapshot === undefined) return { history };
  return {
    snapshot,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current],
    },
  };
}

export function redoHistory<T>(
  history: HistoryState<T>,
  current: T,
): HistoryTransition<T> {
  const snapshot = history.future.at(-1);
  if (snapshot === undefined) return { history };
  return {
    snapshot,
    history: {
      past: [...history.past, current],
      future: history.future.slice(0, -1),
    },
  };
}
