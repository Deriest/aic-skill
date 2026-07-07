import { post } from './client';

export function startTask(title: string, type: string, id: string, priority = 0) {
  return post('/api/task-start', { title, type, id, priority });
}

export function enqueueTask(title: string, type: string, id: string, priority = 0) {
  return post('/api/task-enqueue', { title, type, id, priority });
}

export function cancelTask(id?: string) {
  return post('/api/task-cancel', { id });
}

export function completeTask() {
  return post('/api/task-complete');
}
