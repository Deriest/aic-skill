import { get } from './client';

// ponytail: API shape doesn't match AuditEntry type, using `any` until synced
export function getAudit() {
  return get<any[]>('/api/audit');
}
