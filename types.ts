export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  sourceId: string; // The task that controls the schedule
  type: DependencyType;
}

export interface Task {
  id: string;
  name: string;
  duration: number; // in days
  dependencies: Dependency[]; 
  workPackageId: string;
  constraintDate?: Date; // Manually selected start date (Start No Earlier Than)
}

export interface WorkPackage {
  id: string;
  name: string;
}

export interface ProjectData {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  workPackages: WorkPackage[];
  tasks: Task[];
}

export interface ScheduledTask extends Task {
  earlyStart: number; // Days from project start
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  startDate: Date;
  endDate: Date;
}

export interface ScheduledWorkPackage extends WorkPackage {
  startDate: Date;
  endDate: Date;
  duration: number;
}

export interface ProjectStats {
  duration: number;
  startDate: Date;
  endDate: Date;
  criticalPathLength: number;
}

export enum ViewMode {
  BOARD = 'BOARD',
  GANTT = 'GANTT'
}