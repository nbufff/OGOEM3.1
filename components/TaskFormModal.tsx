import React, { useState, useEffect } from 'react';
import { Task, Dependency, DependencyType } from '../types';
import { X, Link2, Trash2, Plus, Calendar } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  initialTask?: Partial<Task> & { _scheduledStartDate?: Date };
  allTasks: Task[]; // For selecting predecessors
  workPackageId: string;
  projectStartDate: Date;
}

const toInputDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const TaskFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialTask, allTasks, workPackageId, projectStartDate }) => {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(1);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [newDepId, setNewDepId] = useState<string>('');
  const [newDepType, setNewDepType] = useState<DependencyType>('FS');
  
  // Date Logic
  const [constraintDate, setConstraintDate] = useState<Date | undefined>(undefined);
  // Visual dates for inputs
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setName(initialTask.name || '');
        setDuration(initialTask.duration || 1);
        setDependencies(initialTask.dependencies ? [...initialTask.dependencies] : []);
        setConstraintDate(initialTask.constraintDate);
        
        // Populate inputs
        // If constraint exists, use it. If not, use calculated start date (passed via _scheduledStartDate) or project start
        const start = initialTask.constraintDate || initialTask._scheduledStartDate || projectStartDate;
        setStartDateStr(toInputDate(start));
        
        // Calculate End Date based on Start + Duration
        const end = new Date(start);
        end.setDate(end.getDate() + (initialTask.duration || 1));
        setEndDateStr(toInputDate(end));

      } else {
        // New Task
        setName('');
        setDuration(1);
        setDependencies([]);
        setConstraintDate(undefined);
        setStartDateStr(toInputDate(projectStartDate));
        
        const end = new Date(projectStartDate);
        end.setDate(end.getDate() + 1);
        setEndDateStr(toInputDate(end));
      }
      setNewDepId('');
      setNewDepType('FS');
    }
  }, [isOpen, initialTask, projectStartDate]);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setStartDateStr(val);
      
      if (val) {
          const [y, m, d] = val.split('-').map(Number);
          const newStart = new Date(y, m - 1, d);
          setConstraintDate(newStart);
          
          // Recalc End Date
          const newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + duration);
          setEndDateStr(toInputDate(newEnd));
      }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setEndDateStr(val);

      if (val && startDateStr) {
          const [yE, mE, dE] = val.split('-').map(Number);
          const [yS, mS, dS] = startDateStr.split('-').map(Number);
          
          const start = new Date(yS, mS - 1, dS);
          const end = new Date(yE, mE - 1, dE);
          
          const diffTime = end.getTime() - start.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays > 0) {
              setDuration(diffDays);
          }
      }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newDur = parseInt(e.target.value) || 1;
      setDuration(newDur);
      
      if (startDateStr) {
          const [y, m, d] = startDateStr.split('-').map(Number);
          const start = new Date(y, m - 1, d);
          const end = new Date(start);
          end.setDate(end.getDate() + newDur);
          setEndDateStr(toInputDate(end));
      }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialTask?.id,
      name,
      duration,
      dependencies,
      workPackageId: initialTask?.workPackageId || workPackageId,
      constraintDate: constraintDate
    });
    onClose();
  };

  const addDependency = () => {
    if (newDepId && !dependencies.some(d => d.sourceId === newDepId)) {
        setDependencies([...dependencies, { sourceId: newDepId, type: newDepType }]);
        setNewDepId('');
        setNewDepType('FS');
    }
  };

  const removeDependency = (sourceId: string) => {
    setDependencies(dependencies.filter(d => d.sourceId !== sourceId));
  };

  const availableTasks = allTasks
    .filter(t => t.id !== initialTask?.id && !dependencies.some(d => d.sourceId === t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">
            {initialTask?.id ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Task Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="e.g. Design Database"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <div className="relative">
                    <input
                        type="date"
                        value={startDateStr}
                        onChange={handleStartDateChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pl-9"
                    />
                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                {constraintDate && <span className="text-[10px] text-orange-600 font-medium ml-1">Constraint Set</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <div className="relative">
                    <input
                        type="date"
                        value={endDateStr}
                        onChange={handleEndDateChange}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pl-9"
                    />
                     <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
            <input
              type="number"
              min="1"
              required
              value={duration}
              onChange={handleDurationChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Link2 size={16} />
              Dependencies
            </label>
            
            <div className="space-y-2 mb-3">
               {dependencies.map(dep => {
                   const taskName = allTasks.find(t => t.id === dep.sourceId)?.name || 'Unknown';
                   return (
                       <div key={dep.sourceId} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                           <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                               <span className="font-medium text-slate-700 truncate">{taskName}</span>
                               <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono shrink-0">
                                   {dep.type}
                               </span>
                           </div>
                           <button type="button" onClick={() => removeDependency(dep.sourceId)} className="text-slate-400 hover:text-red-500 shrink-0">
                               <Trash2 size={14} />
                           </button>
                       </div>
                   )
               })}
               {dependencies.length === 0 && (
                   <div className="text-xs text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded">No dependencies set.</div>
               )}
            </div>

            <div className="flex gap-2 w-full max-w-full">
                <select 
                    value={newDepId} 
                    onChange={e => setNewDepId(e.target.value)}
                    className="flex-1 w-0 min-w-0 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 truncate"
                >
                    <option value="">Select Task to depend on...</option>
                    {availableTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <select 
                    value={newDepType} 
                    onChange={e => setNewDepType(e.target.value as DependencyType)}
                    className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500 shrink-0"
                >
                    <option value="FS">FS</option>
                    <option value="SS">SS</option>
                    <option value="FF">FF</option>
                    <option value="SF">SF</option>
                </select>
                <button 
                    type="button" 
                    onClick={addDependency}
                    disabled={!newDepId}
                    className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                    <Plus size={16} />
                </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Start constraints override standard dependencies (Start No Earlier Than).
            </p>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskFormModal;