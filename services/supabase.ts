import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectData } from '../types';

let supabase: SupabaseClient | null = null;

export const initSupabase = (url: string, key: string) => {
  if (!url || !key) return;
  try {
    supabase = createClient(url, key);
  } catch (e: any) {
    console.error("Failed to init supabase", e.message || e);
  }
};

export const isSupabaseInitialized = () => !!supabase;

export const fetchCloudProjects = async (): Promise<ProjectData[]> => {
  if (!supabase) throw new Error("Cloud client not initialized");
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    // Create a custom error object that preserves the Supabase error code
    const wrappedError: any = new Error(`Supabase Error: ${error.message} (Code: ${error.code})`);
    wrappedError.code = error.code; // Attach code for programmatic checks
    throw wrappedError;
  }

  // Map database rows back to ProjectData
  return (data || []).map((row: any) => {
    // Ensure dates are converted back to Date objects
    const project = row.data as ProjectData;
    return {
        ...project,
        startDate: new Date(project.startDate),
        // Ensure nested dates in scheduled items are restored if needed
        workPackages: project.workPackages || [],
        tasks: (project.tasks || []).map((t: any) => ({ ...t }))
    };
  });
};

export const saveCloudProject = async (project: ProjectData) => {
  if (!supabase) return; // Silent fail if not connected

  const { error } = await supabase
    .from('projects')
    .upsert({ 
      id: project.id, 
      data: project, 
      updated_at: new Date().toISOString() 
    });

  if (error) {
    console.error("Failed to save to cloud:", error.message);
    const wrappedError: any = new Error(`Failed to save: ${error.message}`);
    wrappedError.code = error.code;
    throw wrappedError;
  }
};

export const deleteCloudProject = async (projectId: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) {
    const wrappedError: any = new Error(`Failed to delete: ${error.message}`);
    wrappedError.code = error.code;
    throw wrappedError;
  }
};