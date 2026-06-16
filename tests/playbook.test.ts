import { describe, it, expect } from "vitest";

import {
  computeProgress,
  groupTasks,
  LAUNCH_GROUPS,
  LAUNCH_TEMPLATE,
  templateTaskData,
} from "../lib/playbook/template";

describe("LAUNCH_TEMPLATE", () => {
  it("has unique keys and every item belongs to a known group", () => {
    const keys = LAUNCH_TEMPLATE.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const item of LAUNCH_TEMPLATE) {
      expect(LAUNCH_GROUPS).toContain(item.group as (typeof LAUNCH_GROUPS)[number]);
    }
  });
});

describe("templateTaskData", () => {
  it("produces one row per template item with sequential sortOrder and the storeId", () => {
    const rows = templateTaskData("store_1");
    expect(rows).toHaveLength(LAUNCH_TEMPLATE.length);
    expect(rows.every((r) => r.storeId === "store_1")).toBe(true);
    expect(rows.map((r) => r.sortOrder)).toEqual(
      LAUNCH_TEMPLATE.map((_, i) => i),
    );
    expect(rows[0].groupName).toBe(LAUNCH_TEMPLATE[0].group);
  });
});

describe("computeProgress", () => {
  it("handles empty, partial, and full completion", () => {
    expect(computeProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
    expect(computeProgress([{ done: true }, { done: false }, { done: false }, { done: false }])).toEqual({
      done: 1,
      total: 4,
      pct: 25,
    });
    expect(computeProgress([{ done: true }, { done: true }])).toEqual({
      done: 2,
      total: 2,
      pct: 100,
    });
  });
});

describe("groupTasks", () => {
  it("orders groups by LAUNCH_GROUPS and drops empty ones", () => {
    const tasks = [
      { groupName: "First products", title: "p" },
      { groupName: "Foundations", title: "f" },
      { groupName: "Foundations", title: "f2" },
    ];
    const grouped = groupTasks(tasks);
    expect(grouped.map((g) => g.name)).toEqual(["Foundations", "First products"]);
    expect(grouped[0].tasks).toHaveLength(2);
    expect(grouped.some((g) => g.name === "Tracking & ads")).toBe(false);
  });
});
