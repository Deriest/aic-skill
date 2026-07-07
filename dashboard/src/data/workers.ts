import type { WorkerDef } from '../types';

export const WORKERS: WorkerDef[] = [
  { id: 'pm',          name: 'PM',        role: 'Product Manager',    model: 'thinker',    skinColor: '#ffcc99', shirtColor: '#3366cc', pantsColor: '#333366', hairColor: '#4a3728', section: 'Product' },
  { id: 'researcher',  name: 'RESEARCH',  role: 'Researcher',         model: 'crafter',  skinColor: '#e6c8b0', shirtColor: '#228b22', pantsColor: '#1a1a2a', hairColor: '#1a1a1a', section: 'Product' },
  { id: 'designer',    name: 'DESIGNER',  role: 'Designer',           model: 'crafter',  skinColor: '#d4a574', shirtColor: '#ff69b4', pantsColor: '#2a1a2a', hairColor: '#8b4513', section: 'Product' },
  { id: 'architect',   name: 'ARCH',      role: 'Architect',          model: 'thinker',    skinColor: '#ffdbac', shirtColor: '#8b4513', pantsColor: '#2a2a2a', hairColor: '#654321', section: 'Engineering' },
  { id: 'frontend',    name: 'FRONTEND',  role: 'Frontend Engineer',  model: 'crafter',  skinColor: '#e6c8b0', shirtColor: '#00bfff', pantsColor: '#1a1a1a', hairColor: '#2a2a2a', section: 'Engineering' },
  { id: 'backend',     name: 'BACKEND',   role: 'Backend Engineer',   model: 'crafter',  skinColor: '#d4a574', shirtColor: '#9932cc', pantsColor: '#1a1a2a', hairColor: '#1a1a1a', section: 'Engineering' },
  { id: 'infra',       name: 'INFRA',     role: 'Infrastructure Eng', model: 'crafter',  skinColor: '#ffcc99', shirtColor: '#ff4500', pantsColor: '#2a2a1a', hairColor: '#8b4513', section: 'Engineering' },
  { id: 'qa',          name: 'QA',        role: 'QA Engineer',        model: 'sprinter',   skinColor: '#e6c8b0', shirtColor: '#00ced1', pantsColor: '#1a2a1a', hairColor: '#654321', section: 'Engineering' },
  { id: 'governor',    name: 'GOV',       role: 'Governor',           model: 'crafter',  skinColor: '#ffdbac', shirtColor: '#ffd700', pantsColor: '#2a2a2a', hairColor: '#1a1a1a', section: 'Governance' },
  { id: 'dispatcher',  name: 'DISPATCH',  role: 'Dispatcher',         model: 'session', skinColor: '#d4a574', shirtColor: '#dc143c', pantsColor: '#1a1a1a', hairColor: '#2a2a2a', section: 'Governance' },
];
