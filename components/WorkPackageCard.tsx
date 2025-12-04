import React, { useState, useRef, useEffect } from 'react';
import { ScheduledTask, ScheduledWorkPackage, Task } from '../types';
import { Clock, Calendar, MoveRight, Trash2 } from 'lucide-react';

interface Props {
  wp: ScheduledWorkPackage;
  tasks: ScheduledTask[];
  onAddTask: (wpId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: ScheduledTask) => void;
  onDeleteWP: (wpId: string) => void;
  onMoveTask: (taskId: string, newWpId: string) => void;
  onRenameWP: (wpId: string, newName: string) => void;
  allTasks: Task[]; // For predecessor lookup
}

const WorkPackageCard: React.FC<Props> = ({ wp, tasks, onAddTask, onDeleteTask, onEditTask, onDeleteWP, onMoveTask, onRenameWP, allTasks }) => {
  const [isOver, setIsOver] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(wp.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.target as HTMLElement;
    setTimeout(() => {
        target.classList.add('opacity-50');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.classList.remove('opacity-50');
    setIsOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.dataTransfer.dropEffect = 'move';
    if (!isOver) setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onMoveTask(taskId, wp.id);
    }
  };

  const startRenaming = () => {
    setRenameValue(wp.name);
    setIsRenaming(true);
  };

  const saveRename = () => {
    if (renameValue.trim() && renameValue !== wp.name) {
        onRenameWP(wp.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          saveRename();
      } else if (e.key === 'Escape') {
          setIsRenaming(false);
          setRenameValue(wp.name);
      }
  };

  return (
    <div 
      className={`
        rounded-xl shadow-sm border overflow-hidden flex flex-col h-full transition-all snap-center
        ${isOver 
            ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200 shadow-md transform scale-[1.01]' 
            : 'bg-white border-slate-200 hover:shadow-md'
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className={`p-4 border-b group/header relative shrink-0 z-20 ${isOver ? 'bg-blue-100/50 border-blue-200' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex justify-between items-start mb-2 pr-6 min-h-[28px]">
          {isRenaming ? (
            <input 
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={saveRename}
                onKeyDown={handleRenameKeyDown}
                className="w-full text-lg font-semibold text-slate-800 bg-white border border-blue-300 rounded px-1 -ml-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : (
            <h3 
                className="font-semibold text-slate-800 text-lg truncate cursor-text hover:bg-slate-100 px-1 -ml-1 rounded transition-colors select-none" 
                title="Double click to rename"
                onDoubleClick={startRenaming}
            >
                {wp.name}
            </h3>
          )}
          <span className="text-xs font-mono bg-slate-200 text-slate-600 px-2 py-0.5 rounded whitespace-nowrap ml-2">
            {wp.duration}d
          </span>
        </div>
        
        <button 
          onClick={() => onDeleteWP(wp.id)}
          className="absolute top-4 right-2 p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all md:opacity-0 md:group-hover/header:opacity-100"
          title="Delete Work Package"
        >
          <Trash2 size={16} />
        </button>

        <div className="flex items-center text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-1">
             <Calendar size={12} />
             {wp.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
          </div>
          <MoveRight size={12} />
          <div className="flex items-center gap-1">
             {wp.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="p-4 flex-1 flex flex-col gap-3 min-h-[100px] overflow-y-auto task-scroll-container z-10 relative">
        {tasks.map((task) => (
          <div 
            key={task.id}
            id={`task-card-${task.id}`}
            draggable
            onDragStart={(e) => handleDragStart(e, task.id)}
            onDragEnd={handleDragEnd}
            className={`
              relative p-3 rounded-lg border text-sm transition-all shadow-sm
              cursor-grab active:cursor-grabbing group select-none
              ${task.isCritical ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-white hover:border-blue-300'}
            `}
            onClick={() => onEditTask(task)}
          >
            {task.isCritical && (
              <div className="absolute -left-[1px] top-0 bottom-0 w-1 bg-red-500 rounded-l-lg" title="Critical Path" />
            )}
            
            <div className="flex justify-between items-start mb-2 gap-2">
              <span className="font-medium text-slate-700 leading-snug break-words">{task.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                className="md:opacity-0 md:group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-0.5 hover:bg-red-50 rounded shrink-0"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5" title="Start Date - End Date">
                  <Calendar size={12} className="text-slate-400" />
                  <span>
                     {task.startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {task.endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100" title="Duration">
                  <Clock size={12} className="text-slate-400" />
                  <span>{task.duration}d</span>
                </div>
              </div>
              
              {task.dependencies.length > 0 && (
                <div className="flex justify-end items-center gap-2 pt-1 border-t border-slate-50/50">
                  <span className="text-[10px] text-slate-400">Dep:</span>
                  <div className="flex -space-x-1">
                    {task.dependencies.map(dep => {
                      const predName = allTasks.find(t => t.id === dep.sourceId)?.name || '?';
                       return (
                        <span key={`${dep.sourceId}-${dep.type}`} className="w-5 h-5 rounded-full bg-blue-100 border border-white text-[9px] flex items-center justify-center text-blue-700 font-bold cursor-help shadow-sm" title={`Depends on: ${predName} (${dep.type})`}>
                          {dep.type.substring(0,1)}
                        </span>
                       )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {tasks.length === 0 && (
          <div className={`text-center py-6 text-sm italic border-2 border-dashed rounded-lg transition-colors ${isOver ? 'border-blue-300 text-blue-500 bg-blue-50/50' : 'border-slate-100 text-slate-400'}`}>
            {isOver ? 'Drop task here' : 'No tasks yet'}
          </div>
        )}
      </div>
      
      {/* Footer Actions */}
      <div className={`p-3 border-t bg-slate-50/50 shrink-0 z-20 ${isOver ? 'border-blue-200' : 'border-slate-100'}`}>
        <button 
          onClick={() => onAddTask(wp.id)}
          className="w-full py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md transition-colors border border-dashed border-blue-200 hover:border-blue-300"
        >
          + Add Task
        </button>
      </div>
    </div>
  );
};

export default WorkPackageCard;