import { Task, WorkPackage, ScheduledTask, ScheduledWorkPackage, ProjectStats } from '../types';

// Helper to add days to a date
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Calculate network schedule (Forward and Backward Pass)
export const calculateSchedule = (
  tasks: Task[],
  workPackages: WorkPackage[],
  projectStartDate: Date
): {
  scheduledTasks: ScheduledTask[];
  scheduledWPs: ScheduledWorkPackage[];
  stats: ProjectStats;
} => {
  const scheduledTaskMap = new Map<string, ScheduledTask>();

  // 1. Initialize Scheduled Tasks with base data
  // We initialize everything to 0 to ensure clean recalculation
  tasks.forEach((t) => {
    scheduledTaskMap.set(t.id, {
      ...t,
      earlyStart: 0,
      earlyFinish: t.duration, // Initial EF is just duration
      lateStart: 0,
      lateFinish: 0,
      slack: 0,
      isCritical: false,
      startDate: projectStartDate,
      endDate: addDays(projectStartDate, t.duration),
    });
  });

  // 2. Forward Pass (Calculate Early Start & Early Finish)
  let changed = true;
  let iterations = 0;
  // Safety break for cycles (e.g. A->B->A)
  const MAX_ITERATIONS = tasks.length * 2 + 50; 

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    tasks.forEach((task) => {
      const st = scheduledTaskMap.get(task.id)!;
      let newES = 0;

      // Calculate implied Start based on all dependencies (Predecessors)
      task.dependencies.forEach((dep) => {
        const pred = scheduledTaskMap.get(dep.sourceId);
        // If predecessor doesn't exist (e.g. deleted), ignore dependency
        if (!pred) return;

        let impliedES = 0;
        
        switch (dep.type) {
          case 'FS': // Finish-to-Start: Task starts after Pred finishes
            impliedES = pred.earlyFinish;
            break;
          case 'SS': // Start-to-Start: Task starts after Pred starts
            impliedES = pred.earlyStart;
            break;
          case 'FF': // Finish-to-Finish: Task finishes after Pred finishes => ES >= PredEF - Duration
            impliedES = pred.earlyFinish - task.duration;
            break;
          case 'SF': // Start-to-Finish: Task finishes after Pred starts => ES >= PredES - Duration
            impliedES = pred.earlyStart - task.duration;
            break;
        }
        
        if (impliedES > newES) {
          newES = impliedES;
        }
      });

      // Ensure non-negative start
      newES = Math.max(0, newES);
      const newEF = newES + task.duration;

      if (st.earlyStart !== newES || st.earlyFinish !== newEF) {
        st.earlyStart = newES;
        st.earlyFinish = newEF;
        changed = true;
      }
    });
  }

  if (iterations >= MAX_ITERATIONS) {
    console.warn("Scheduler reached max iterations. Possible circular dependency detected.");
  }

  // Project Duration is the max EF of all tasks
  const projectDuration = Math.max(0, ...Array.from(scheduledTaskMap.values()).map((t) => t.earlyFinish));

  // 3. Backward Pass (Calculate Late Start & Late Finish)
  // Initialize LF to Project Duration for all tasks initially
  tasks.forEach((t) => {
    const st = scheduledTaskMap.get(t.id)!;
    st.lateFinish = projectDuration;
    st.lateStart = projectDuration - st.duration;
  });

  changed = true;
  iterations = 0;
  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;
    
    tasks.forEach((task) => {
      const st = scheduledTaskMap.get(task.id)!;
      let newLF = projectDuration;

      // Check all tasks that depend on this task (Successors) to constrain LF
      tasks.forEach((successor) => {
        successor.dependencies.forEach((dep) => {
          if (dep.sourceId === task.id) {
            const succ = scheduledTaskMap.get(successor.id)!;
            let impliedLF = projectDuration;

            switch (dep.type) {
              case 'FS': // Succ Start >= Task Finish => Task Finish <= Succ Start
                impliedLF = succ.lateStart;
                break;
              case 'SS': // Succ Start >= Task Start => Task Start <= Succ Start
                // LS constraint propagates to LF: LF = LS + Dur <= SuccStart + Dur
                impliedLF = succ.lateStart + task.duration;
                break;
              case 'FF': // Succ Finish >= Task Finish => Task Finish <= Succ Finish
                impliedLF = succ.lateFinish;
                break;
              case 'SF': // Succ Finish >= Task Start => Task Start <= Succ Finish
                // LS constraint: LS <= SuccFinish. LF = LS + Dur <= SuccFinish + Dur
                impliedLF = succ.lateFinish + task.duration;
                break;
            }

            if (impliedLF < newLF) {
              newLF = impliedLF;
            }
          }
        });
      });

      const newLS = newLF - task.duration;

      if (st.lateFinish !== newLF || st.lateStart !== newLS) {
        st.lateFinish = newLF;
        st.lateStart = newLS;
        changed = true;
      }
    });
  }

  // 4. Finalize Tasks and Calculate Critical Path
  const finalScheduledTasks: ScheduledTask[] = [];
  tasks.forEach((t) => {
    const st = scheduledTaskMap.get(t.id)!;
    st.slack = st.lateStart - st.earlyStart;
    // Critical if slack is 0 (or very close to it)
    st.isCritical = st.slack <= 0; 
    
    // Convert relative days to Date objects
    st.startDate = addDays(projectStartDate, st.earlyStart);
    st.endDate = addDays(projectStartDate, st.earlyFinish);
    
    finalScheduledTasks.push(st);
  });

  // 5. Aggregate Work Package Stats
  // Work Package Duration = Time from the earliest task start to the latest task finish within the package.
  const scheduledWPs: ScheduledWorkPackage[] = workPackages.map((wp) => {
    const wpTasks = finalScheduledTasks.filter((t) => t.workPackageId === wp.id);
    
    if (wpTasks.length === 0) {
      return {
        ...wp,
        startDate: projectStartDate,
        endDate: projectStartDate,
        duration: 0,
      };
    }
    
    const minStart = Math.min(...wpTasks.map(t => t.earlyStart));
    const maxFinish = Math.max(...wpTasks.map(t => t.earlyFinish));
    
    return {
      ...wp,
      startDate: addDays(projectStartDate, minStart),
      endDate: addDays(projectStartDate, maxFinish),
      duration: maxFinish - minStart,
    };
  });

  return {
    scheduledTasks: finalScheduledTasks,
    scheduledWPs,
    stats: {
      duration: projectDuration,
      startDate: projectStartDate,
      endDate: addDays(projectStartDate, projectDuration),
      criticalPathLength: projectDuration
    }
  };
};