
import { Task, TaskTable } from "@/components/task-table";

const tasks: Task[] = [
  {
    name: "Processing",
    detail: "Batch check in progress",
    files: "3 / 5",
    lastActivity: "2 minutes ago",
    status: "Processing",
  },
  {
    name: "Monthly Reports Q3",
    detail: "Processing",
    files: "3 / 5",
    lastActivity: "2 minutes ago",
    status: "Processing",
  },
  {
    name: "Image Optimization Batch 1",
    detail: "Completed",
    files: "5 / 5",
    lastActivity: "1 hour ago",
    status: "Completed",
  },
  {
    name: "Image Optimization Batch 1",
    detail: "Queued on Staging",
    files: "5 / 5",
    lastActivity: "Queued",
    status: "Queued",
  },
  {
    name: "Vendor Reconciliation",
    detail: "Awaiting supplier review",
    files: "2 / 4",
    lastActivity: "5 minutes ago",
    status: "Processing",
  },
  {
    name: "Audit Prep",
    detail: "Final approvals pending",
    files: "4 / 4",
    lastActivity: "30 minutes ago",
    status: "Completed",
  },
  {
    name: "Inventory Sync",
    detail: "Queued for export",
    files: "1 / 1",
    lastActivity: "Queued",
    status: "Queued",
  },
  {
    name: "Compliance Upload",
    detail: "Processing receipts",
    files: "6 / 6",
    lastActivity: "10 minutes ago",
    status: "Processing",
  },
];

import Link from "next/link";

function TaskList() {
  return (
    <section className="w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
            Live queue
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            Processing Tasks
          </h2>
        </div>
        <Link
          href="/new-task"
          className="rounded-2xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Create New Task
        </Link>
      </div>

      <TaskTable tasks={tasks} />
    </section>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen w-full bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl px-6 py-10">
        <TaskList />
      </div>
    </main>
  );
}
