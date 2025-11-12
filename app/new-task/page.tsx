import Link from "next/link";

import { FileUpload } from "@/components/file-upload";

export default function NewTaskPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-8 rounded-3xl border border-slate-200 bg-white/90 p-8 shadow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Create task
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              New Task details
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>

        <form className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="task-name">
              Task name
            </label>
            <input
              id="task-name"
              type="text"
              placeholder="Monthly reconciliation"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="detail">
              Description
            </label>
            <textarea
              id="detail"
              placeholder="Describe the files and actions for this task"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              rows={4}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="source">
                Data source
              </label>
              <select
                id="source"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              >
                <option>Upload pack</option>
                <option>API ingestion</option>
                <option>Manual review</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              >
                <option>Processing</option>
                <option>Priority</option>
                <option>Background</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Files</p>
              <p className="text-xs text-slate-500">Drag and drop or click to upload supporting documents.</p>
            </div>
            <FileUpload maxFiles={10} maxFileSize={50 * 1024 * 1024} />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-2xl border border-slate-900 bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Save task
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
