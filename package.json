import { ProjectData } from './types';

export const COLORS = {
  primary: '#3b82f6', // blue-500
  critical: '#ef4444', // red-500
  success: '#22c55e', // green-500
  slate: '#64748b', // slate-500
};

export const MOCK_PROJECT: ProjectData = {
  id: 'proj-1',
  title: "New Software Launch",
  description: "End-to-end development and deployment plan",
  startDate: new Date(), // Today
  workPackages: [
    { id: 'wp-1', name: 'Planning' },
    { id: 'wp-2', name: 'Execution' }
  ],
  tasks: [
    { id: 't-1', name: 'Define Scope', duration: 2, dependencies: [], workPackageId: 'wp-1' },
    { id: 't-2', name: 'Resource Allocation', duration: 3, dependencies: [{ sourceId: 't-1', type: 'FS' }], workPackageId: 'wp-1' },
    { id: 't-3', name: 'Development', duration: 5, dependencies: [{ sourceId: 't-2', type: 'FS' }], workPackageId: 'wp-2' },
  ]
};