"use client";

import type { Task } from "./columns";
import { columns } from "./columns";
import { DataTable } from "./data-table";

export { type Task } from "./columns";

export function TaskTable({ tasks }: { tasks: Task[] }) {
  return <DataTable columns={columns} data={tasks} />;
}
