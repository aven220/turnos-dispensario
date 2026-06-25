import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedWindowPriorityIds, sortTicketsByWindowPriority } from './window-priority-order.js';

test('orderedWindowPriorityIds respeta sortOrder por ventanilla', () => {
  const window = {
    priorities: [
      { priorityId: 'pen', sortOrder: 1 },
      { priorityId: 'gen', sortOrder: 2 },
    ],
  };
  assert.deepEqual(orderedWindowPriorityIds(window), ['pen', 'gen']);
});

test('sortTicketsByWindowPriority ordena por cola de ventanilla', () => {
  const tickets = [
    { priorityId: 'gen', createdAt: new Date('2026-06-13T10:00:00Z') },
    { priorityId: 'pen', createdAt: new Date('2026-06-13T09:00:00Z') },
    { priorityId: 'gen', createdAt: new Date('2026-06-13T11:00:00Z') },
  ];
  const sorted = sortTicketsByWindowPriority(tickets, ['pen', 'gen']);
  assert.equal(sorted[0].priorityId, 'pen');
  assert.equal(sorted[1].priorityId, 'gen');
  assert.equal(sorted[2].priorityId, 'gen');
});
