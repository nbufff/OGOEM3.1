import React, { useMemo, useEffect } from 'react';
import { ScheduledTask, ScheduledWorkPackage } from '../types';
import { ChevronRight, ChevronDown, Package, LayoutList, AlertCircle } from 'lucide-react';

export type GanttTimeScale = 'Day' | 'Week' | 'Month';

interface Props {
  tasks: ScheduledTask[];
  wps: ScheduledWorkPackage[];
  projectDuration: number;
  projectStartDate: Date;
  // Controlled State Props
  viewMode: GanttTimeScale;
  onViewModeChange: (mode: GanttTimeScale) => void;
  expandedWPIds: Set<string>;
  onToggleWP: (wpId: string) => void;
}

interface ViewConfig {
  pxPerDay: number;
  tickLabel: (date: Date, index: number) => string;
  subLabel: (date: Date, index: number) => string;
  stepDays: number; // Approximate step for generating ticks
}

const HEADER_HEIGHT = 60; 
const ROW_HEIGHT = 44;

const VIEW_SETTINGS: Record<GanttTimeScale, ViewConfig> = {
  Day: {
    pxPerDay: 40,
    tickLabel: (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    subLabel: (date, i) => `${i}`, // Day Index
    stepDays: 1
  },
  Week: {
    pxPerDay: 12, // ~84px per week
    tickLabel: (date) => `W${getWeekNumber(date)}`,
    subLabel: (date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    stepDays: 7
  },
  Month: {
    pxPerDay: 3, // ~90px per month
    tickLabel: (date) => date.toLocaleDateString(undefined, { month: 'long' }),
    subLabel: (date) => date.getFullYear().toString(),
    stepDays: 30
  }
};

// Helper to get week number
function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper to format date range
const formatDateRange = (start: Date, end: Date) => {
    if (!start || !end) return '';
    const s = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${s} - ${e}`;
};

const GanttChart: React.FC<Props> = ({ 
    tasks, 
    wps, 
    projectDuration, 
    projectStartDate,
    viewMode,
    onViewModeChange,
    expandedWPIds,
    onToggleWP
}) => {
  // Responsive Left Column Width
  const [leftColWidth, setLeftColWidth] = React.useState(280);

  useEffect(() => {
    const handleResize = () => {
        setLeftColWidth(window.innerWidth < 768 ? 140 : 280);
    };
    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentView = VIEW_SETTINGS[viewMode];

  // Build the flat list of rows based on expansion state
  const visibleRows = useMemo(() => {
    const rows: Array<{
      id: string;
      type: 'WP' | 'TASK';
      data: ScheduledWorkPackage | ScheduledTask;
      expanded?: boolean;
    }> = [];
    
    wps.forEach(wp => {
      const isExpanded = expandedWPIds.has(wp.id);
      rows.push({
        id: wp.id,
        type: 'WP',
        data: wp,
        expanded: isExpanded
      });

      if (isExpanded) {
        const wpTasks = tasks
            .filter(t => t.workPackageId === wp.id)
            .sort((a, b) => a.earlyStart - b.earlyStart);
        
        wpTasks.forEach(task => {
          rows.push({
            id: task.id,
            type: 'TASK',
            data: task
          });
        });
      }
    });

    return rows;
  }, [wps, tasks, expandedWPIds]);

  // Generate Timeline Ticks
  const timelineTicks = useMemo(() => {
    const ticks: Array<{ date: Date; left: number; label: string; subLabel: string }> = [];
    const totalDays = projectDuration + (viewMode === 'Day' ? 10 : 60); // Add buffer
    const start = new Date(projectStartDate);

    if (viewMode === 'Day') {
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            ticks.push({
                date,
                left: i * currentView.pxPerDay,
                label: currentView.tickLabel(date, i),
                subLabel: currentView.subLabel(date, i)
            });
        }
    } else if (viewMode === 'Week') {
        for (let i = 0; i < totalDays; i += 7) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            ticks.push({
                date,
                left: i * currentView.pxPerDay,
                label: currentView.tickLabel(date, i),
                subLabel: currentView.subLabel(date, i)
            });
        }
    } else if (viewMode === 'Month') {
         const end = new Date(start);
         end.setDate(end.getDate() + totalDays);

         let iterDate = new Date(start);
         iterDate.setDate(1); // Start at beginning of the start month
         
         while (iterDate < end) {
             const timeDiff = iterDate.getTime() - start.getTime();
             const dayDiff = timeDiff / (1000 * 3600 * 24);
             
             if (dayDiff >= -30) {
                 ticks.push({
                     date: new Date(iterDate),
                     left: dayDiff * currentView.pxPerDay,
                     label: currentView.tickLabel(iterDate, 0),
                     subLabel: currentView.subLabel(iterDate, 0)
                 });
             }
             iterDate.setMonth(iterDate.getMonth() + 1);
         }
    }

    return ticks;
  }, [projectDuration, projectStartDate, viewMode, currentView]);

  const chartWidth = Math.max(800, (projectDuration + (viewMode === 'Month' ? 60 : 20)) * currentView.pxPerDay);
  const totalContentHeight = visibleRows.length * ROW_HEIGHT + HEADER_HEIGHT;

  const dependencyLines = useMemo(() => {
    const lines: React.ReactElement[] = [];
    const idToRowIndex = new Map<string, number>();
    visibleRows.forEach((row, index) => {
        if (row.type === 'TASK') idToRowIndex.set(row.id, index);
    });

    tasks.forEach((task) => {
      const targetIndex = idToRowIndex.get(task.id);
      if (targetIndex === undefined) return;

      const taskY = targetIndex * ROW_HEIGHT + HEADER_HEIGHT + (ROW_HEIGHT / 2);

      task.dependencies.forEach(dep => {
        const sourceIndex = idToRowIndex.get(dep.sourceId);
        if (sourceIndex === undefined) return;

        const sourceTask = tasks.find(t => t.id === dep.sourceId);
        if (!sourceTask) return;

        const sourceY = sourceIndex * ROW_HEIGHT + HEADER_HEIGHT + (ROW_HEIGHT / 2);

        // Coordinates based on pxPerDay
        let startX = 0;
        let endX = 0;
        
        switch (dep.type) {
            case 'FS':
                startX = sourceTask.earlyFinish * currentView.pxPerDay;
                endX = task.earlyStart * currentView.pxPerDay;
                break;
            case 'SS':
                startX = sourceTask.earlyStart * currentView.pxPerDay;
                endX = task.earlyStart * currentView.pxPerDay;
                break;
            case 'FF':
                startX = sourceTask.earlyFinish * currentView.pxPerDay;
                endX = task.earlyFinish * currentView.pxPerDay;
                break;
            case 'SF':
                startX = sourceTask.earlyStart * currentView.pxPerDay;
                endX = task.earlyFinish * currentView.pxPerDay;
                break;
        }

        const isCriticalLink = sourceTask.isCritical && task.isCritical;
        const color = isCriticalLink ? '#ef4444' : '#cbd5e1';
        const width = isCriticalLink ? 2 : 1.5;

        const isBackward = endX < startX + 10;
        
        let pathData = '';
        if (!isBackward) {
             pathData = `M ${startX} ${sourceY} 
                        C ${startX + 20} ${sourceY}, 
                          ${endX - 20} ${taskY}, 
                          ${endX} ${taskY}`;
        } else {
             const loopX = startX + 20;
             pathData = `M ${startX} ${sourceY} 
                        L ${loopX} ${sourceY} 
                        L ${loopX} ${sourceY + (taskY > sourceY ? 10 : -10)}
                        C ${loopX} ${taskY}, ${startX} ${taskY}, ${endX} ${taskY}`;
        }

        lines.push(
          <path
            key={`${dep.sourceId}-${task.id}`}
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth={width}
            markerEnd={`url(#arrowhead-${isCriticalLink ? 'critical' : 'normal'})`}
          />
        );
      });
    });
    return lines;
  }, [visibleRows, tasks, currentView.pxPerDay]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-auto relative scroll-smooth">
            
            {/* ID added here for PDF export to capture full scrollable content */}
            <div id="gantt-content-area" style={{ width: leftColWidth + chartWidth, height: totalContentHeight }} className="relative bg-white">
                
                {/* --- Sticky Header Row --- */}
                <div 
                    className="sticky top-0 z-40 flex bg-slate-50 border-b border-slate-200 shadow-sm"
                    style={{ height: HEADER_HEIGHT }}
                >
                    {/* Top Left Corner with View Controls */}
                    <div 
                        className="sticky left-0 z-50 bg-slate-50 border-r border-slate-200 flex flex-col justify-center px-2 md:px-4"
                        style={{ width: leftColWidth }}
                    >
                         <div className="flex bg-slate-200/50 p-1 rounded-lg self-start max-w-full overflow-x-auto scrollbar-hide no-print">
                             {(['Day', 'Week', 'Month'] as GanttTimeScale[]).map((mode) => (
                                 <button
                                     key={mode}
                                     onClick={() => onViewModeChange(mode)}
                                     className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-semibold rounded-md transition-all ${
                                         viewMode === mode 
                                         ? 'bg-white text-blue-600 shadow-sm' 
                                         : 'text-slate-500 hover:text-slate-700'
                                     }`}
                                 >
                                     {mode}
                                 </button>
                             ))}
                         </div>
                         <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2 truncate">Work Packages / Tasks</span>
                    </div>
                    
                    {/* Timeline Header */}
                    <div className="relative flex-1 bg-white">
                        {timelineTicks.map((tick, i) => {
                            const isWeekend = tick.date.getDay() === 0 || tick.date.getDay() === 6;
                            const showWeekendBg = viewMode === 'Day' && isWeekend;
                            
                            return (
                                <div
                                    key={i}
                                    className={`absolute top-0 bottom-0 border-l border-slate-100 flex flex-col justify-end pb-2 pl-1.5 ${showWeekendBg ? 'bg-slate-50/50' : ''}`}
                                    style={{ left: tick.left, minWidth: 40 }} 
                                >
                                    <span className="font-bold text-slate-700 text-xs leading-none whitespace-nowrap">
                                        {tick.label}
                                    </span>
                                    <span className="font-mono text-slate-400 text-[10px] leading-none mt-0.5 whitespace-nowrap">
                                        {tick.subLabel}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* --- Grid Background Lines (Full Height) --- */}
                <div 
                    className="absolute bottom-0 left-0 right-0 pointer-events-none"
                    style={{ top: HEADER_HEIGHT }}
                >
                     <div className="relative h-full" style={{ marginLeft: leftColWidth }}>
                        {timelineTicks.map((tick, i) => (
                            <div
                                key={i}
                                className="absolute top-0 bottom-0 border-l border-slate-100/70"
                                style={{ left: tick.left }}
                            />
                        ))}
                     </div>
                </div>

                {/* --- Dependency SVG Overlay --- */}
                <svg 
                    className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
                    style={{ paddingLeft: leftColWidth }}
                >
                    <defs>
                        <marker id="arrowhead-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#cbd5e1" />
                        </marker>
                        <marker id="arrowhead-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                        </marker>
                    </defs>
                    {dependencyLines}
                </svg>

                {/* --- Data Rows --- */}
                {visibleRows.map((row, index) => {
                    const top = index * ROW_HEIGHT + HEADER_HEIGHT;
                    const isWP = row.type === 'WP';
                    const data = row.data;
                    
                    let startDay = 0;
                    let duration = data.duration;
                    
                    if (isWP) {
                        const wpTasks = tasks.filter(t => t.workPackageId === row.id);
                        if (wpTasks.length > 0) {
                            startDay = Math.min(...wpTasks.map(t => t.earlyStart));
                            const endDay = Math.max(...wpTasks.map(t => t.earlyFinish));
                            duration = endDay - startDay;
                        } else {
                            startDay = 0;
                            duration = 0;
                        }
                    } else {
                        startDay = (data as ScheduledTask).earlyStart;
                    }

                    const barLeft = startDay * currentView.pxPerDay;
                    const barWidth = Math.max(duration * currentView.pxPerDay, 2);

                    const dateRange = formatDateRange(data.startDate, data.endDate);

                    return (
                        <div 
                            key={`${row.type}-${row.id}`} 
                            className={`absolute left-0 right-0 flex border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isWP ? 'bg-slate-50/30' : ''}`}
                            style={{ top, height: ROW_HEIGHT }}
                        >
                            {/* Sticky Left Column */}
                            <div 
                                className="sticky left-0 z-30 flex items-center border-r border-slate-200 bg-white px-2 md:px-4 shrink-0 overflow-hidden"
                                style={{ width: leftColWidth, paddingLeft: isWP ? (leftColWidth < 200 ? 8 : 16) : (leftColWidth < 200 ? 24 : 40) }}
                            >
                                {isWP ? (
                                    <button 
                                        onClick={() => onToggleWP(row.id)}
                                        className="flex items-center gap-2 text-slate-700 font-semibold text-sm hover:text-blue-600 focus:outline-none w-full text-left"
                                    >
                                        <div title="Toggle tasks" className="shrink-0">
                                            {row.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                        <Package size={16} className="text-slate-400 shrink-0 hidden md:block" />
                                        <span className="truncate">{data.name}</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-600 text-sm w-full">
                                        <LayoutList size={14} className="text-slate-400 shrink-0 hidden md:block" />
                                        <span className="truncate" title={data.name}>{data.name}</span>
                                        {(data as ScheduledTask).isCritical && (
                                            <div title="Critical Task" className="ml-auto shrink-0 text-red-500 flex">
                                                <AlertCircle size={12} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bar Area */}
                            <div className="relative flex-1 z-20">
                                {duration > 0 && (
                                    <div
                                        className={`absolute h-6 top-1/2 -translate-y-1/2 rounded shadow-sm border border-white/20 flex items-center justify-center overflow-hidden select-none group cursor-pointer
                                            ${isWP 
                                                ? 'bg-slate-400 rounded-md' 
                                                : (data as ScheduledTask).isCritical ? 'bg-red-500' : 'bg-blue-500'
                                            }
                                        `}
                                        style={{ left: barLeft, width: barWidth }}
                                        title={`${data.name}\nDuration: ${duration} days\n${dateRange}`}
                                    >
                                        {/* Show duration label if width allows */}
                                        {barWidth > 20 && (
                                            <span className="text-[10px] text-white font-medium px-1 drop-shadow-md truncate">
                                                {duration}d
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
};

export default GanttChart;