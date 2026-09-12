import { describe, expect, it } from "vitest";
import {
  createHistory,
  pushHistory,
  redoHistory,
  TRACKER_HISTORY_LIMIT,
  undoHistory,
} from "./history";

describe("tracker history", () => {
  it("undoes and redoes complete action snapshots", () => {
    const withMove = pushHistory(createHistory<number>(), 1);
    const undone = undoHistory(withMove, 2);
    expect(undone.snapshot).toBe(1);
    expect(undone.history.past).toEqual([]);
    expect(undone.history.future).toEqual([2]);

    const redone = redoHistory(undone.history, 1);
    expect(redone.snapshot).toBe(2);
    expect(redone.history.past).toEqual([1]);
    expect(redone.history.future).toEqual([]);
  });

  it("clears redo on a new action and respects its bound", () => {
    const undone = undoHistory(pushHistory(createHistory<number>(), 1), 2).history;
    const replaced = pushHistory(undone, 3);
    expect(replaced.future).toEqual([]);

    const bounded = [1, 2, 3].reduce(
      (history, value) => pushHistory(history, value, 2),
      createHistory<number>(),
    );
    expect(bounded.past).toEqual([2, 3]);
    expect(TRACKER_HISTORY_LIMIT).toBe(50);
  });

  it("restores grouped positions, connections, and START atomically", () => {
    const before = {
      positions: { a: { x: 0, y: 0 }, b: { x: 20, y: 30 } },
      connections: ["connection-1"],
      startLocationId: "a",
    };
    const after = {
      positions: { a: { x: 8, y: 5 }, b: { x: 28, y: 35 } },
      connections: [] as string[],
      startLocationId: "b",
    };
    const undone = undoHistory(pushHistory(createHistory<typeof before>(), before), after);
    expect(undone.snapshot).toEqual(before);

    const redone = redoHistory(undone.history, before);
    expect(redone.snapshot).toEqual(after);
  });

  it("undoes and redoes persistent connection color metadata", () => {
    const before = { connection: { id: "connection-1", color: undefined as string | undefined } };
    const after = { connection: { id: "connection-1", color: "rose" } };

    const undone = undoHistory(pushHistory(createHistory<typeof before>(), before), after);
    expect(undone.snapshot?.connection).toEqual(before.connection);
    const redone = redoHistory(undone.history, before);
    expect(redone.snapshot?.connection).toEqual(after.connection);
  });
});
