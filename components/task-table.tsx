"use client";

import * as React from "react";

export type Task = {
  name: string;
  detail: string;
  files: string;
  lastActivity: string;
  status: string;
};

const PAGE_SIZE_OPTIONS = [5, 10, 25, 100];

function StatusPill({ status }: { status: string }) {
  const color =
    status === "Completed"
      ? "text-emerald-700 bg-emerald-100 border-emerald-200"
      : status === "Queued"
      ? "text-slate-500 bg-slate-100 border-slate-200"
      : "text-amber-700 bg-amber-100 border-amber-200";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${color}`}
    >
      {status}
    </span>
  );
}

export function TaskTable({ tasks }: { tasks: Task[] }) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_OPTIONS[0]);
  const totalPages = Math.max(1, Math.ceil(tasks.length / pageSize));
  const start = (page - 1) * pageSize;
  const currentTasks = tasks.slice(start, start + pageSize);

  const handlePage = (next: boolean) => {
    setPage((value) =>
      next ? Math.min(totalPages, value + 1) : Math.max(1, value - 1)
    );
  };

  return (
    <>
      <div className="mt-6 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-transparent text-left text-xs uppercase tracking-[0.3em] text-slate-500">
            <tr>
              <th className="px-6 py-3">Task Name</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Files Uploaded</th>
              <th className="px-6 py-3">Last Activity</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {currentTasks.map((task) => (
              <tr key={task.name + task.lastActivity}>
                <td className="px-6 py-5">
                  <p className="text-base font-semibold text-slate-900">
                    {task.name}
                  </p>
                  <p className="text-xs text-slate-500">{task.detail}</p>
                </td>
                <td className="px-6 py-5">
                  <StatusPill status={task.status} />
                </td>
                <td className="px-6 py-5 text-slate-600">{task.files}</td>
                <td className="px-6 py-5 text-slate-600">{task.lastActivity}</td>
                <td className="px-6 py-5 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                      View Details
                    </button>
                    <button className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                      Actions
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/70 pt-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs font-semibold text-slate-500">
            Rows per page:
          </label>
          <select
            id="page-size"
            className="rounded-2xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs font-semibold">
          Showing {start + 1} –{" "}
          {Math.min(start + pageSize, tasks.length)} of {tasks.length} tasks
        </p>

        <div className="flex items-center gap-2">
          <button
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold transition hover:bg-slate-50"
            disabled={page === 1}
            onClick={() => handlePage(false)}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="text-xs font-semibold">
            Page {page} of {totalPages}
          </span>
          <button
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold transition hover:bg-slate-50"
            disabled={page === totalPages}
            onClick={() => handlePage(true)}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
