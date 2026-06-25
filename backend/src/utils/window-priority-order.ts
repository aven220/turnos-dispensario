import type { Prisma } from '@prisma/client';

type WindowWithPriorities = {
  priorities: Array<{ priorityId: string; sortOrder: number }>;
};

/** Prioridades de una ventanilla ordenadas por sortOrder (1 = atiende primero). */
export function orderedWindowPriorityIds(window: WindowWithPriorities): string[] {
  return [...window.priorities]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.priorityId.localeCompare(b.priorityId))
    .map((wp) => wp.priorityId);
}

export function sortTicketsByWindowPriority<T extends { priorityId: string; createdAt: Date }>(
  tickets: T[],
  priorityIds: string[]
): T[] {
  const orderMap = new Map(priorityIds.map((id, index) => [id, index]));
  return [...tickets].sort((a, b) => {
    const ao = orderMap.get(a.priorityId) ?? 9999;
    const bo = orderMap.get(b.priorityId) ?? 9999;
    if (ao !== bo) return ao - bo;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export const windowPriorityInclude = {
  priorities: {
    include: { priority: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} satisfies Prisma.WindowInclude;
