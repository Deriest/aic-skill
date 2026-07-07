import { get } from './client';
import type { AuditEntry } from '../types';

export function getAudit() {
  return get<AuditEntry[]>('/api/audit');
}
