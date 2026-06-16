"use client";

import { toggleLaunchTask } from "./actions";

interface Task {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
}

interface Group {
  name: string;
  tasks: Task[];
}

/**
 * Interactive launch checklist. Each checkbox submits the toggle server action
 * on change (no save button); the page re-renders with updated progress.
 */
export function LaunchChecklist({
  storeId,
  groups,
  progress,
}: {
  storeId: string;
  groups: Group[];
  progress: { done: number; total: number; pct: number };
}) {
  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            Launch progress
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {progress.done}/{progress.total} · {progress.pct}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.name}>
            <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {group.name}
            </h2>
            <ul className="space-y-2">
              {group.tasks.map((task) => (
                <li
                  key={task.id}
                  className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <form action={toggleLaunchTask}>
                    <input type="hidden" name="storeId" value={storeId} />
                    <input type="hidden" name="taskId" value={task.id} />
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        name="done"
                        defaultChecked={task.done}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 accent-green-600 dark:border-zinc-700"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-sm font-medium ${
                            task.done
                              ? "text-zinc-400 line-through dark:text-zinc-500"
                              : "text-black dark:text-zinc-50"
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                            {task.description}
                          </span>
                        )}
                      </span>
                    </label>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
