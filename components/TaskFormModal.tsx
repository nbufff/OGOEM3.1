import React, { useState, useEffect } from 'react';
import { Task, Dependency, DependencyType } from '../types';
import { X, Link2, Trash2, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  initialTask?: Partial<Task>;
  allTasks: Task[]; // For selecting predecessors
  workPackageId: string;
}

const TaskFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialTask, allTasks, workPackageId }) => {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(1);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [newDepId, setNewDepId] = useState<string>('');
  const [newDepType, setNewDepType] = useState<DependencyType>('FS');

  useEffect(() => {
    if (isOpen) {
      if (initialTask) {
        setName(initialTask.name || '');
        setDuration(initialTask.duration || 1);
        // Ensure we copy the array to avoid mutating the prop directly
        setDependencies(initialTask.dependencies ? [...initialTask.dependencies] : []);
      } else {
        setName('');
        setDuration(1);
        setDependencies([]);
      }
      setNewDepId('');
      setNewDepType('FS');
    }
  }, [isOpen, initialTask]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialTask?.id,
      name,
      duration,
      dependencies,
      workPackageId: initialTask?.workPackageId || workPackageId
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

  // Filter out self and already selected dependencies, then sort alphabetically
  const availableTasks = allTasks
    .filter(t => t.id !== initialTask?.id && !dependencies.some(d => d.sourceId === t.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">
            {initialTask?.id ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
            <input
              type="number"
              min="1"
              required
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Link2 size={16} />
              Dependencies
            </label>
            
            {/* List of existing dependencies */}
            <div className="space-y-2 mb-3">
               {dependencies.map(dep => {
                   const taskName = allTasks.find(t => t.id === dep.sourceId)?.name || 'Unknown';
                   return (
                       <div key={dep.sourceId} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                           <div className="flex items-center gap-2">
                               <span className="font-medium text-slate-700">{taskName}</span>
                               <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                                   {dep.type}
                               </span>
                           </div>
                           <button type="button" onClick={() => removeDependency(dep.sourceId)} className="text-slate-400 hover:text-red-500">
                               <Trash2 size={14} />
                           </button>
                       </div>
                   )
               })}
               {dependencies.length === 0 && (
                   <div className="text-xs text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded">No dependencies set.</div>
               )}
            </div>

            {/* Add new dependency */}
            <div className="flex gap-2">
                <select 
                    value={newDepId} 
                    onChange={e => setNewDepId(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
                >
                    <option value="">Select Task to depend on...</option>
                    {availableTasks.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </select>
                <select 
                    value={newDepType} 
                    onChange={e => setNewDepType(e.target.value as DependencyType)}
                    className="w-20 text-sm border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:border-blue-500"
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
                    className="bg-blue-100 text-blue-700 p-2 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Plus size={16} />
                </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              FS: Finish-to-Start (Standard) | SS: Start-to-Start (Parallel)
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