import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WorkPackage, Task, ProjectData, ViewMode, ScheduledTask } from './types';
import { calculateSchedule } from './utils/scheduler';
import WorkPackageCard from './components/WorkPackageCard';
import GanttChart, { GanttTimeScale } from './components/GanttChart';
import TaskFormModal from './components/TaskFormModal';
import WorkPackageModal from './components/WorkPackageModal';
import ProjectModal from './components/ProjectModal';
import ConfirmDialog from './components/ConfirmDialog';
import CloudConnectModal from './components/CloudConnectModal';
import { Plus, LayoutGrid, CalendarClock, Folder, Trash2, Box, Layers, Edit2, Download, Upload, Menu, PanelLeftClose, PanelLeftOpen, CloudOff, Cloud } from 'lucide-react';
import { MOCK_PROJECT } from './constants';
import { initSupabase, fetchCloudProjects, saveCloudProject, deleteCloudProject } from './services/supabase';

const toInputDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface CloudConfig {
  url: string;
  key: string;
}

// Default Credentials
const DEFAULT_CLOUD_URL = "https://lfyjfnazataniwvheuqp.supabase.co";
const DEFAULT_CLOUD_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmeWpmbmF6YXRhbml3dmhldXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDYyNTUsImV4cCI6MjA4MDMyMjI1NX0.sUJl_JXrfR0REykN0ko4qWvSkEORUvoIJQrJQRczROE";

const App: React.FC = () => {
  // --- Cloud State ---
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(() => {
    const saved = localStorage.getItem('og-odm-cloud-config');
    // Use saved config if available, otherwise use default hardcoded credentials
    return saved ? JSON.parse(saved) : { url: DEFAULT_CLOUD_URL, key: DEFAULT_CLOUD_KEY };
  });
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);

  // --- Project State ---
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem('og-odm-active-project') || '';
  });

  // --- Gantt Chart Persistence ---
  const [ganttTimeScale, setGanttTimeScale] = useState<GanttTimeScale>(() => {
    const saved = localStorage.getItem('og-odm-gantt-scale');
    return (saved as GanttTimeScale) || 'Day';
  });

  const [ganttExpandedWPIds, setGanttExpandedWPIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('og-odm-gantt-expanded');
    if (saved) {
        try {
            return new Set(JSON.parse(saved));
        } catch { return new Set(); }
    }
    return new Set();
  });

  // Save Gantt Settings Handlers
  const handleGanttScaleChange = (mode: GanttTimeScale) => {
    setGanttTimeScale(mode);
    localStorage.setItem('og-odm-gantt-scale', mode);
  };

  const handleToggleGanttWP = (wpId: string) => {
    const newSet = new Set(ganttExpandedWPIds);
    if (newSet.has(wpId)) {
        newSet.delete(wpId);
    } else {
        newSet.add(wpId);
    }
    setGanttExpandedWPIds(newSet);
    localStorage.setItem('og-odm-gantt-expanded', JSON.stringify(Array.from(newSet)));
  };

  // --- Initialization Effect ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      
      // 1. Try Cloud
      if (cloudConfig) {
        try {
          initSupabase(cloudConfig.url, cloudConfig.key);
          const cloudProjects = await fetchCloudProjects();
          setProjects(cloudProjects);
          setIsCloudConnected(true);
        } catch (err: any) {
          // Log raw error object so browser console shows stack trace/message correctly
          // (JSON.stringify on Error returns '{}')
          console.error("Cloud connection failed on init:", err);
          setIsCloudConnected(false);
          // Fallback to local if cloud fails
          loadLocalProjects();
        }
      } else {
        // 2. Load Local
        loadLocalProjects();
      }
      setIsLoadingData(false);
    };

    loadData();
  }, [cloudConfig]); // Re-run if config changes (e.g. user connects)

  const loadLocalProjects = () => {
    try {
      const savedProjects = localStorage.getItem('og-odm-projects');
      if (savedProjects) {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const restored = parsed.map((p: any) => ({
            ...p,
            startDate: new Date(p.startDate),
            tasks: (p.tasks || []).map((t: any) => ({
                ...t,
                constraintDate: t.constraintDate ? new Date(t.constraintDate) : undefined
            }))
          }));
          setProjects(restored);
        } else {
           setProjects([MOCK_PROJECT]);
        }
      } else {
         setProjects([MOCK_PROJECT]);
      }
    } catch (error) {
      console.error("Failed to load local projects:", error);
      setProjects([MOCK_PROJECT]);
    }
  };

  // --- Persistence Handlers ---

  // When projects change, save them to the correct source
  const saveProjectsToSource = async (updatedProjects: ProjectData[], changedProject?: ProjectData) => {
    setProjects(updatedProjects);
    
    // Save Active ID logic handled by effect below
    
    if (isCloudConnected && changedProject) {
      // Cloud Mode: Save specific project to DB
      try {
        await saveCloudProject(changedProject);
      } catch (err) {
        console.error("Failed to auto-save to cloud", err);
      }
    } else if (!isCloudConnected) {
      // Local Mode: Save all to LocalStorage
      localStorage.setItem('og-odm-projects', JSON.stringify(updatedProjects));
    }
  };

  // If a project is deleted
  const deleteProjectFromSource = async (projectId: string, updatedProjects: ProjectData[]) => {
    setProjects(updatedProjects);
    
    if (isCloudConnected) {
      try {
        await deleteCloudProject(projectId);
      } catch (err) {
        console.error("Failed to delete from cloud", err);
      }
    } else {
      localStorage.setItem('og-odm-projects', JSON.stringify(updatedProjects));
    }
  };

  useEffect(() => {
    localStorage.setItem('og-odm-active-project', activeProjectId);
  }, [activeProjectId]);

  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.BOARD);
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Desktop Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isWPModalOpen, setIsWPModalOpen] = useState(false);
  
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectData | null>(null);

  const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(null);
  
  // Rename Project State (Inline Sidebar)
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameProjectValue, setRenameProjectValue] = useState('');
  
  const [editingTask, setEditingTask] = useState<Partial<Task> | undefined>(undefined);
  const [targetWpId, setTargetWpId] = useState<string>('');
  
  // File Import Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived State
  const activeProject = useMemo(() => 
    projects.find(p => p.id === activeProjectId) || projects[0], 
    [projects, activeProjectId]
  );
  
  // Update active ID if current one is invalid after load
  useEffect(() => {
      if (projects.length > 0 && !projects.find(p => p.id === activeProjectId)) {
          setActiveProjectId(projects[0].id);
      }
  }, [projects, activeProjectId]);

  // Calculate Schedule for Active Project
  const { scheduledTasks, scheduledWPs, stats } = useMemo(() => {
    if (!activeProject) return { scheduledTasks: [], scheduledWPs: [], stats: { duration: 0, startDate: new Date(), endDate: new Date(), criticalPathLength: 0 } };
    return calculateSchedule(activeProject.tasks, activeProject.workPackages, activeProject.startDate);
  }, [activeProject]);

  // --- Date Change Handlers ---
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value || !activeProject) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    const newStart = new Date(y, m - 1, d);
    
    // Calculate shift delta (difference in ms)
    const oldStart = new Date(activeProject.startDate);
    const deltaMs = newStart.getTime() - oldStart.getTime();

    // Shift all task constraints by the same delta to preserve relative structure/duration
    const updatedTasks = activeProject.tasks.map(t => {
      if (t.constraintDate) {
        return {
          ...t,
          constraintDate: new Date(t.constraintDate.getTime() + deltaMs)
        };
      }
      return t;
    });

    const updated = { ...activeProject, startDate: newStart, tasks: updatedTasks };
    const updatedList = projects.map(p => p.id === activeProject.id ? updated : p);
    saveProjectsToSource(updatedList, updated);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value || !activeProject) return;
    const [y, m, d] = e.target.value.split('-').map(Number);
    const newEnd = new Date(y, m - 1, d);
    
    const durationInDays = stats.duration;
    // Calculate new start date based on desired end date and current duration
    const newStart = new Date(newEnd);
    newStart.setDate(newStart.getDate() - durationInDays);

    // Calculate shift delta
    const oldStart = new Date(activeProject.startDate);
    const deltaMs = newStart.getTime() - oldStart.getTime();

    // Shift all task constraints
    const updatedTasks = activeProject.tasks.map(t => {
      if (t.constraintDate) {
        return {
          ...t,
          constraintDate: new Date(t.constraintDate.getTime() + deltaMs)
        };
      }
      return t;
    });

    const updated = { ...activeProject, startDate: newStart, tasks: updatedTasks };
    const updatedList = projects.map(p => p.id === activeProject.id ? updated : p);
    saveProjectsToSource(updatedList, updated);
  };

  // --- Cloud Handlers ---

  const handleCloudConnect = (url: string, key: string) => {
    const config = { url, key };
    setCloudConfig(config);
    localStorage.setItem('og-odm-cloud-config', JSON.stringify(config));
    // The useEffect [cloudConfig] will trigger reload
  };

  const handleDisconnectCloud = () => {
      if (window.confirm("Disconnect from Cloud? You will switch back to local storage projects.")) {
          setCloudConfig(null);
          setIsCloudConnected(false);
          localStorage.removeItem('og-odm-cloud-config');
          // State will revert to local in useEffect
      }
  };

  // --- Project Handlers ---

  const handleOpenCreateProject = () => {
    setEditingProject(null);
    setIsProjectModalOpen(true);
    setIsMobileMenuOpen(false);
  };

  const handleOpenEditProject = (project: ProjectData) => {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (title: string, description: string, startDate: Date) => {
    if (editingProject) {
      // Edit Mode
      const updated = { ...editingProject, title, description, startDate };
      const updatedList = projects.map(p => p.id === editingProject.id ? updated : p);
      saveProjectsToSource(updatedList, updated);
    } else {
      // Create Mode
      const newProject: ProjectData = {
        id: `proj-${Date.now()}`,
        title,
        description,
        startDate: startDate,
        workPackages: [],
        tasks: []
      };
      const updatedList = [...projects, newProject];
      saveProjectsToSource(updatedList, newProject);
      setActiveProjectId(newProject.id);
    }
  };

  const requestDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setProjectToDeleteId(projectId);
  };

  const confirmDeleteProject = () => {
    if (!projectToDeleteId) return;
    const updatedList = projects.filter(p => p.id !== projectToDeleteId);
    
    deleteProjectFromSource(projectToDeleteId, updatedList);

    if (activeProjectId === projectToDeleteId) {
        setActiveProjectId(updatedList.length > 0 ? updatedList[0].id : '');
    }
    setProjectToDeleteId(null);
  };

  // Update Helper
  const updateActiveProject = (updater: (project: ProjectData) => ProjectData) => {
    if (!activeProject) return;
    const updated = updater(activeProject);
    const updatedList = projects.map(p => p.id === activeProject.id ? updated : p);
    saveProjectsToSource(updatedList, updated);
  };

  // --- Import / Export Handlers ---

  const handleExportProject = () => {
    if (!activeProject) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeProject));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${activeProject.title.replace(/\s+/g, '_')}_export.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
        fileInputRef.current.value = ''; 
        fileInputRef.current.click();
        setIsMobileMenuOpen(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            
            // Handle Bulk Import (Backup Array)
            if (Array.isArray(json)) {
                if (json.length === 0) {
                    alert("Backup file is empty.");
                    return;
                }
                const confirmMsg = `Found ${json.length} projects in backup.\n\nThis will merge/update projects. Existing projects with same IDs will be updated. New ones will be added.\n\nContinue?`;
                if (!window.confirm(confirmMsg)) return;

                const restoredProjects: ProjectData[] = json.map((p: any) => ({
                    ...p,
                    startDate: new Date(p.startDate)
                }));

                // Merge Logic
                let merged = [...projects];
                for (const imported of restoredProjects) {
                    const idx = merged.findIndex(p => p.id === imported.id);
                    if (idx >= 0) {
                        merged[idx] = imported;
                        // Save each individual project if in cloud mode
                        if (isCloudConnected) await saveCloudProject(imported);
                    } else {
                        merged.push(imported);
                        if (isCloudConnected) await saveCloudProject(imported);
                    }
                }
                
                // If local mode, save all at once
                if (!isCloudConnected) {
                    localStorage.setItem('og-odm-projects', JSON.stringify(merged));
                }
                
                setProjects(merged);
                alert("Restoration complete!");
                return;
            }

            // Handle Single Project Import
            if (!json.id || !json.title || !Array.isArray(json.tasks)) {
                alert("Invalid project file format.");
                return;
            }

            const rawId = json.id;
            const existing = projects.find(p => p.id === rawId);
            let finalProject: ProjectData;
            
            if (existing) {
                const shouldOverwrite = window.confirm(`Project "${existing.title}" exists.\nOK to Overwrite (Update).\nCancel to Create Copy.`);
                if (shouldOverwrite) {
                    finalProject = { ...json, startDate: new Date(json.startDate) };
                    const updatedList = projects.map(p => p.id === rawId ? finalProject : p);
                    saveProjectsToSource(updatedList, finalProject);
                } else {
                    finalProject = { ...json, id: `proj-${Date.now()}`, title: `${json.title} (Copy)`, startDate: new Date(json.startDate) };
                    const updatedList = [...projects, finalProject];
                    saveProjectsToSource(updatedList, finalProject);
                }
            } else {
                finalProject = { ...json, startDate: new Date(json.startDate) };
                const updatedList = [...projects, finalProject];
                saveProjectsToSource(updatedList, finalProject);
            }

            setActiveProjectId(finalProject.id);

        } catch (err) {
            console.error(err);
            alert("Failed to parse file.");
        }
    };
    reader.readAsText(file);
  };

  // --- Project Rename Handlers (Sidebar Inline) ---

  const startRenamingProject = (project: ProjectData) => {
    setRenamingProjectId(project.id);
    setRenameProjectValue(project.title);
  };

  const saveProjectRename = () => {
    if (renamingProjectId && renameProjectValue.trim()) {
      const updatedList = projects.map(p => p.id === renamingProjectId ? { ...p, title: renameProjectValue.trim() } : p);
      const changed = updatedList.find(p => p.id === renamingProjectId);
      saveProjectsToSource(updatedList, changed);
    }
    setRenamingProjectId(null);
    setRenameProjectValue('');
  };

  const cancelProjectRename = () => {
    setRenamingProjectId(null);
    setRenameProjectValue('');
  };

  // --- Task Handlers ---

  const handleAddTask = (wpId: string) => {
    setEditingTask(undefined);
    setTargetWpId(wpId);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: ScheduledTask) => {
    if (!activeProject) return;
    const rawTask = activeProject.tasks.find(t => t.id === task.id);
    if (rawTask) {
        // Pass the scheduled start date as the default constraint if none exists
        const taskWithDate = {
            ...rawTask,
            // We pass the scheduled start date from the 'task' param (which is ScheduledTask)
            // so the modal can populate the date picker even if constraintDate is undefined
            _scheduledStartDate: task.startDate 
        };
        setEditingTask(taskWithDate);
        setTargetWpId(rawTask.workPackageId);
        setIsTaskModalOpen(true);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    updateActiveProject(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId).map(t => ({
          ...t,
          dependencies: t.dependencies.filter(d => d.sourceId !== taskId)
      }))
    }));
  };

  const handleSaveTask = (taskData: Partial<Task>) => {
    updateActiveProject(prev => {
      let newTasks = [...prev.tasks];
      if (taskData.id) {
        newTasks = newTasks.map(t => t.id === taskData.id ? { ...t, ...taskData } as Task : t);
      } else {
        const newTask: Task = {
          id: `t-${Date.now()}`,
          name: taskData.name || 'New Task',
          duration: taskData.duration || 1,
          dependencies: taskData.dependencies || [],
          workPackageId: targetWpId,
          constraintDate: taskData.constraintDate
        };
        newTasks.push(newTask);
      }
      return { ...prev, tasks: newTasks };
    });
  };

  const handleMoveTask = (taskId: string, newWpId: string) => {
    updateActiveProject(prev => {
        const task = prev.tasks.find(t => t.id === taskId);
        if (!task || task.workPackageId === newWpId) return prev;
        return {
            ...prev,
            tasks: prev.tasks.map(t => t.id === taskId ? { ...t, workPackageId: newWpId } : t)
        };
    });
  };

  // --- Work Package Handlers ---

  const handleAddWP = () => {
    setIsWPModalOpen(true);
  };

  const handleSaveWP = (name: string) => {
    updateActiveProject(prev => ({
      ...prev,
      workPackages: [...prev.workPackages, { id: `wp-${Date.now()}`, name }]
    }));
  };

  const handleRenameWP = (wpId: string, newName: string) => {
    updateActiveProject(prev => ({
      ...prev,
      workPackages: prev.workPackages.map(wp => wp.id === wpId ? { ...wp, name: newName } : wp)
    }));
  };

  const handleDeleteWP = (wpId: string) => {
    if (!activeProject) return;
    const hasTasks = activeProject.tasks.some(t => t.workPackageId === wpId);
    if (hasTasks) {
        if (!window.confirm("Delete Work Package and all its tasks?")) return;
    }
    updateActiveProject(prev => ({
      ...prev,
      workPackages: prev.workPackages.filter(wp => wp.id !== wpId),
      tasks: prev.tasks.filter(t => t.workPackageId !== wpId).map(t => ({
          ...t,
          dependencies: t.dependencies.filter(dep => {
              const depTask = prev.tasks.find(dt => dt.id === dep.sourceId);
              return depTask && depTask.workPackageId !== wpId;
          })
      }))
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans overflow-hidden">
      
      {/* Mobile Menu Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 flex flex-col h-screen 
        transition-all duration-300 ease-in-out shadow-xl md:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        w-64
        md:translate-x-0 md:static md:shrink-0
        ${isSidebarOpen ? 'md:w-64' : 'md:w-0 md:border-r-0 md:overflow-hidden'}
      `}>
        <div className="w-64 flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <img 
                  src="https://1000logos.net/wp-content/uploads/2016/10/Bosch-Logo.png" 
                  alt="Bosch" 
                  className="h-6 w-auto object-contain"
                />
                <span className="font-bold text-slate-800 text-lg tracking-tight leading-none">OG ODM Projects</span>
            </div>

            <div className="p-4 space-y-2">
                <button 
                    onClick={handleOpenCreateProject}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                    <Plus size={16} /> New Project
                </button>
                <button 
                    onClick={handleImportClick}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                >
                    <Upload size={16} /> Import Project
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4">
                <div className="flex justify-between items-center px-3 mb-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">My Projects</h3>
                    {isCloudConnected && <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">CLOUD</span>}
                </div>
                
                {isLoadingData ? (
                    <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Loading...</div>
                ) : (
                    <ul className="space-y-1">
                        {projects.map(project => (
                            <li key={project.id} className="flex items-center gap-0.5 rounded-lg transition-colors pr-1 hover:bg-slate-50">
                                {renamingProjectId === project.id ? (
                                    <div className="flex-1 flex items-center gap-3 px-3 py-2.5">
                                        <Folder size={16} className="shrink-0 text-blue-600" />
                                        <input 
                                            autoFocus
                                            value={renameProjectValue}
                                            onChange={(e) => setRenameProjectValue(e.target.value)}
                                            onBlur={saveProjectRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveProjectRename();
                                                if (e.key === 'Escape') cancelProjectRename();
                                            }}
                                            className="flex-1 min-w-0 text-sm font-medium border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setActiveProjectId(project.id); setIsMobileMenuOpen(false); }}
                                        onDoubleClick={() => startRenamingProject(project)}
                                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 text-sm text-left overflow-hidden rounded-l-lg outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset group ${
                                            activeProjectId === project.id 
                                            ? 'bg-blue-50 text-blue-700 font-medium' 
                                            : 'text-slate-600'
                                        }`}
                                    >
                                        <Folder size={16} className={`shrink-0 ${activeProjectId === project.id ? 'fill-blue-200 text-blue-600' : 'text-slate-400'}`} />
                                        <span className="truncate">{project.title}</span>
                                    </button>
                                )}
                                {renamingProjectId !== project.id && (
                                    <button 
                                        onClick={(e) => requestDeleteProject(e, project.id)}
                                        className="p-2 shrink-0 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-r-lg transition-colors outline-none focus:ring-2 focus:ring-red-500 z-10"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </li>
                        ))}
                        {projects.length === 0 && (
                            <li className="px-4 py-8 text-center text-sm text-slate-400 italic">No projects found.</li>
                        )}
                    </ul>
                )}
            </div>

            {/* Storage Settings */}
            <div className={`p-4 border-t border-slate-100 ${isCloudConnected ? 'bg-indigo-50/50' : 'bg-slate-50/50'}`}>
                {isCloudConnected ? (
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center gap-2 text-xs text-indigo-700 font-medium">
                            <Cloud size={14} className="shrink-0" />
                            <span>Cloud Connected</span>
                         </div>
                         <button 
                            onClick={handleDisconnectCloud}
                            className="text-xs text-indigo-500 hover:text-indigo-700 underline text-left"
                         >
                            Disconnect / Switch to Local
                         </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                            <CloudOff size={14} className="mt-0.5 shrink-0 text-slate-400" />
                            <div>
                                <span className="font-semibold text-slate-600 block mb-0.5">Local Storage</span>
                                <p className="leading-tight opacity-75">Data stays on this device.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsCloudModalOpen(true)}
                            className="w-full py-1.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 rounded text-xs font-medium transition-colors shadow-sm"
                        >
                            Connect Cloud
                        </button>
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full bg-slate-50/50">
        {!activeProject ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden absolute top-4 left-4 p-2 bg-white rounded-lg shadow-sm border border-slate-200 text-slate-600"><Menu size={24} /></button>
            <Box size={48} className="mb-4 opacity-50" />
            <p>Select or create a project.</p>
          </div>
        ) : (
          <>
            <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10 shadow-sm">
               <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
                  <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
                  <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="hidden md:block p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-lg mr-2">
                     {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                  </button>
                  <div className="min-w-0">
                      <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 truncate">
                        <span className="truncate">{activeProject.title}</span>
                        <div className="flex shrink-0">
                            <button onClick={() => handleOpenEditProject(activeProject)} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100"><Edit2 size={16} /></button>
                            <button onClick={handleExportProject} className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-100"><Download size={16} /></button>
                        </div>
                      </h1>
                      <p className="text-slate-500 text-xs md:text-sm truncate">{activeProject.description || "No description provided."}</p>
                  </div>
               </div>
               
               <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6">
                  <div className="flex bg-slate-100 p-1 rounded-lg self-start md:self-auto">
                      <button onClick={() => setViewMode(ViewMode.BOARD)} className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${viewMode === ViewMode.BOARD ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} /> Board</button>
                      <button onClick={() => setViewMode(ViewMode.GANTT)} className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 ${viewMode === ViewMode.GANTT ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Layers size={16} /> Gantt</button>
                  </div>

                  <div className="flex gap-2 md:gap-4 text-sm text-slate-600 overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group shrink-0">
                          <CalendarClock size={16} className="text-blue-500 shrink-0"/>
                          <div className="relative"><input type="date" value={toInputDate(stats.startDate)} onChange={handleStartDateChange} className="bg-transparent border-0 p-0 text-slate-700 font-medium text-sm w-[8.5rem] focus:ring-0 cursor-pointer rounded px-1 outline-none"/></div>
                          <span className="text-slate-400 mx-1">-</span>
                          <div className="relative"><input type="date" value={toInputDate(stats.endDate)} onChange={handleEndDateChange} className="bg-transparent border-0 p-0 text-slate-700 font-medium text-sm w-[8.5rem] focus:ring-0 cursor-pointer rounded px-1 outline-none"/></div>
                          <span className="text-slate-500 border-l border-slate-200 pl-2 ml-1 whitespace-nowrap hidden sm:inline">{stats.duration}d</span>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 shrink-0">
                          <LayoutGrid size={16} className="text-red-500 shrink-0"/>
                          <span className="whitespace-nowrap">Crit: {stats.criticalPathLength}d</span>
                      </div>
                  </div>
               </div>
            </header>

            <div className="flex-1 overflow-hidden relative">
               {viewMode === ViewMode.BOARD ? (
                 <div className="h-full overflow-x-auto overflow-y-hidden p-4 md:p-6 snap-x snap-mandatory">
                    <div className="flex h-full gap-4 md:gap-6 relative">
                       {scheduledWPs.map(wp => (
                          <div key={wp.id} className="w-[85vw] md:w-80 shrink-0 h-full flex flex-col z-10 snap-center">
                             <WorkPackageCard 
                                wp={wp}
                                tasks={scheduledTasks.filter(t => t.workPackageId === wp.id)}
                                onAddTask={handleAddTask}
                                onDeleteTask={handleDeleteTask}
                                onEditTask={handleEditTask}
                                onDeleteWP={handleDeleteWP}
                                onMoveTask={handleMoveTask}
                                onRenameWP={handleRenameWP}
                                allTasks={activeProject.tasks}
                             />
                          </div>
                       ))}
                       <div className="w-[85vw] md:w-80 shrink-0 h-full snap-center pb-8 md:pb-0">
                          <button onClick={handleAddWP} className="w-full h-full border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/50 transition-all gap-2 group min-h-[200px]">
                             <div className="p-3 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow"><Plus size={24} /></div>
                             <span className="font-medium">Add Work Package</span>
                          </button>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="h-full p-2 md:p-6 overflow-hidden">
                    <GanttChart 
                        tasks={scheduledTasks} 
                        wps={scheduledWPs} 
                        projectDuration={stats.duration} 
                        projectStartDate={stats.startDate}
                        viewMode={ganttTimeScale}
                        onViewModeChange={handleGanttScaleChange}
                        expandedWPIds={ganttExpandedWPIds}
                        onToggleWP={handleToggleGanttWP}
                    />
                 </div>
               )}
            </div>
          </>
        )}
      </main>

      <TaskFormModal 
        isOpen={isTaskModalOpen} 
        onClose={() => setIsTaskModalOpen(false)} 
        onSave={handleSaveTask} 
        initialTask={editingTask} 
        allTasks={activeProject?.tasks || []} 
        workPackageId={targetWpId} 
        projectStartDate={stats.startDate} // Pass project start for date calcs
      />
      <WorkPackageModal isOpen={isWPModalOpen} onClose={() => setIsWPModalOpen(false)} onSave={handleSaveWP} />
      <ProjectModal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onSave={handleSaveProject} initialData={editingProject} />
      <ConfirmDialog isOpen={!!projectToDeleteId} title="Delete Project?" message="This action cannot be undone. The project and all its tasks will be permanently removed." onConfirm={confirmDeleteProject} onCancel={() => setProjectToDeleteId(null)} isDangerous={true} confirmText="Delete Project" />
      <CloudConnectModal isOpen={isCloudModalOpen} onClose={() => setIsCloudModalOpen(false)} onConnected={handleCloudConnect} existingConfig={cloudConfig} />
      <input type="file" ref={fileInputRef} className="hidden" accept=".json,application/json" onChange={handleFileUpload} />
    </div>
  );
};

export default App;