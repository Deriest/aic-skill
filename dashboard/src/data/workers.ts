import type { WorkerDef } from '../types';

export const WORKERS: WorkerDef[] = [
  // Leadership
  { id: 'dispatcher',    displayName: 'Hermes',     role: 'Dispatcher',           model: 'system',   skinColor: '#d4a574', shirtColor: '#dc143c', pantsColor: '#1a1a1a', hairColor: '#2a2a2a', name: 'DISPATCH',  section: 'Leadership', phase: 'Global' },
  { id: 'governor',      displayName: 'Rex',        role: 'Governor',             model: 'sprinter', skinColor: '#ffdbac', shirtColor: '#ffd700', pantsColor: '#2a2a2a', hairColor: '#1a1a1a', name: 'GOV',       section: 'Leadership', phase: 'Closeout' },

  // Product
  { id: 'pm',            displayName: 'Aria',       role: 'Product Manager',      model: 'thinker',  skinColor: '#ffcc99', shirtColor: '#3366cc', pantsColor: '#333366', hairColor: '#4a3728', name: 'PM',        section: 'Product', phase: 'Investigate' },
  { id: 'research',      displayName: 'Sage',       role: 'Research',             model: 'thinker',  skinColor: '#e6c8b0', shirtColor: '#228b22', pantsColor: '#1a1a2a', hairColor: '#1a1a1a', name: 'RESEARCH',  section: 'Product', phase: 'Investigate' },
  { id: 'designer',      displayName: 'Luna',       role: 'Designer',             model: 'crafter',  skinColor: '#d4a574', shirtColor: '#ff69b4', pantsColor: '#2a1a2a', hairColor: '#8b4513', name: 'DESIGNER',  section: 'Product', phase: 'Implementation' },
  { id: 'documentation', displayName: 'Echo',       role: 'Documentation Engineer',model: 'sprinter',skinColor: '#ffcc99', shirtColor: '#20b2aa', pantsColor: '#1a2a2a', hairColor: '#654321', name: 'DOCS',      section: 'Product', phase: 'Closeout' },

  // Engineering
  { id: 'architect',     displayName: 'Atlas',      role: 'Architect',            model: 'thinker',  skinColor: '#ffdbac', shirtColor: '#8b4513', pantsColor: '#2a2a2a', hairColor: '#654321', name: 'ARCH',      section: 'Engineering', phase: 'Planning' },
  { id: 'backend',       displayName: 'Hugo',       role: 'Backend Engineer',     model: 'crafter',  skinColor: '#d4a574', shirtColor: '#9932cc', pantsColor: '#1a1a1a', hairColor: '#1a1a1a', name: 'BACKEND',   section: 'Engineering', phase: 'Implementation' },
  { id: 'frontend',      displayName: 'Leo',        role: 'Frontend Engineer',    model: 'crafter',  skinColor: '#e6c8b0', shirtColor: '#00bfff', pantsColor: '#1a1a1a', hairColor: '#2a2a2a', name: 'FRONTEND',  section: 'Engineering', phase: 'Implementation' },
  { id: 'qa',            displayName: 'Eve',        role: 'QA Engineer',          model: 'sprinter', skinColor: '#e6c8b0', shirtColor: '#00ced1', pantsColor: '#1a2a1a', hairColor: '#654321', name: 'QA',        section: 'Engineering', phase: 'Verification' },
  { id: 'perf',          displayName: 'Pulse',      role: 'Performance Engineer', model: 'sprinter', skinColor: '#ffdbac', shirtColor: '#ff6347', pantsColor: '#2a1a1a', hairColor: '#8b4513', name: 'PERF',      section: 'Engineering', phase: 'Verification' },

  // Platform
  { id: 'data',          displayName: 'Nova',       role: 'Data Engineer',        model: 'crafter',  skinColor: '#e6c8b0', shirtColor: '#ff8c00', pantsColor: '#2a2a1a', hairColor: '#2a2a2a', name: 'DATA',      section: 'Platform', phase: 'Planning' },
  { id: 'integration',   displayName: 'Nexus',      role: 'Integration Engineer', model: 'crafter',  skinColor: '#d4a574', shirtColor: '#9370db', pantsColor: '#1a1a2a', hairColor: '#1a1a1a', name: 'INTEG',     section: 'Platform', phase: 'Planning' },
  { id: 'infra',         displayName: 'Flint',      role: 'Infrastructure Eng',   model: 'crafter',  skinColor: '#ffcc99', shirtColor: '#ff4500', pantsColor: '#2a2a1a', hairColor: '#8b4513', name: 'INFRA',     section: 'Platform', phase: 'Planning' },
  { id: 'security',      displayName: 'Sentinel',   role: 'Security Engineer',    model: 'crafter',  skinColor: '#e6c8b0', shirtColor: '#2f4f4f', pantsColor: '#1a1a1a', hairColor: '#2a2a2a', name: 'SEC',       section: 'Platform', phase: 'Planning' },
];

export const groupWorkersBySection = () => {
  const sections = ['Leadership', 'Product', 'Engineering', 'Platform'];
  const grouped = WORKERS.reduce((acc, w) => {
    if (!acc[w.section]) acc[w.section] = [];
    acc[w.section].push(w);
    return acc;
  }, {} as Record<string, WorkerDef[]>);
  return sections.map(s => [s, grouped[s] || []]) as [string, WorkerDef[]][];
};
