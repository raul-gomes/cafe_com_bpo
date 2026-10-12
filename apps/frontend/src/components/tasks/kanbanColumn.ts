import type { TaskResponse } from '../../schemas/tasks';

/**
 * Cards a kanban column shows: the column's phase plus its local search.
 *
 * Single source for what is on screen — the column renders this list, counts
 * it and hands it to the bulk actions, so "complete all" / "cancel all" never
 * touch a card hidden by the filters (AUD-004).
 *
 * @param tasks Tasks already filtered by mode, client and period.
 * @param columnId Phase id of the column.
 * @param getTaskStatus Maps a task to its column id.
 * @param query Text typed in the column search.
 * @returns The tasks of the column that match the search.
 */
export function columnVisibleTasks(
  tasks: TaskResponse[],
  columnId: string,
  getTaskStatus: (task: TaskResponse) => string,
  query: string | undefined,
): TaskResponse[] {
  const needle = (query || '').toLowerCase();
  return tasks
    .filter(task => getTaskStatus(task) === columnId)
    .filter(task => {
      if (!needle) return true;
      return task.title.toLowerCase().includes(needle) || (task.description || '').toLowerCase().includes(needle);
    });
}
