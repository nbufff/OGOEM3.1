import React, { useState, useEffect } from 'react';
import { X, Database, Check, AlertCircle, Copy } from 'lucide-react';
import { initSupabase, fetchCloudProjects } from '../services/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (url: string, key: string) => void;
  existingConfig: { url: string; key: string } | null;
}

const CloudConnectModal: React.FC<Props> = ({ isOpen, onClose, onConnected, existingConfig }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'credentials' | 'setup'>('credentials');

  useEffect(() => {
    if (isOpen) {
      if (existingConfig) {
        setUrl(existingConfig.url);
        setKey(existingConfig.key);
      }
      setStep('credentials');
      setError(null);
    }
  }, [isOpen, existingConfig]);

  if (!isOpen) return null;

  const handleTestConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Initialize temp client
      initSupabase(url, key);
      // Try to fetch (this will fail if table doesn't exist, which is fine, 
      // or if credentials are wrong)
      await fetchCloudProjects();
      
      // If successful (or at least connected), save
      onConnected(url, key);
      onClose();
    } catch (err: any) {
      console.error(err);
      
      // CHECK FOR MISSING TABLE ERROR (PGRST205)
      // We check err.code (set by our service) or fall back to message string check
      if (err.code === 'PGRST205' || (err.message && err.message.includes('PGRST205'))) {
        setStep('setup');
        return;
      }

      // Check for Authentication Errors
      if (err.code === 'PGRST301' || (err.message && err.message.includes('JWT'))) {
         setError("Invalid URL or API Key. Please check your Supabase settings.");
      } else {
         // If it's another error, display it
         setError(err.message || "Connection failed. Please check credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sqlSnippet = `
create table projects (
  id text primary key,
  data jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Turn off Row Level Security for simple public access with API Key
alter table projects disable row level security;
  `.trim();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSnippet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 p-1.5 rounded-lg">
                <Database className="text-indigo-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {step === 'credentials' ? 'Connect to Cloud' : 'Database Setup'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {step === 'credentials' ? (
            <form onSubmit={handleTestConnection} className="p-6 space-y-4 overflow-y-auto">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800 mb-4">
                    <p className="font-semibold mb-1">How to get these?</p>
                    <ol className="list-decimal list-inside space-y-1 opacity-90">
                        <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline hover:text-indigo-900">supabase.com</a></li>
                        <li>Go to <b>Project Settings</b> &gt; <b>API</b></li>
                        <li>Copy the <b>Project URL</b> and <b>anon / public Key</b></li>
                    </ol>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Project URL</label>
                    <input
                        type="url"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://xyz.supabase.co"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">API Key (anon/public)</label>
                    <input
                        type="password"
                        required
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2"
                    >
                        {isLoading ? 'Connecting...' : 'Connect & Sync'}
                    </button>
                </div>
            </form>
        ) : (
            <div className="p-6 space-y-4 overflow-y-auto">
                 <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 p-4 rounded-lg">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-amber-800">
                        <p className="font-bold">Missing Table</p>
                        <p>You are connected, but your database needs a "projects" table.</p>
                    </div>
                 </div>

                 <div>
                    <p className="text-sm text-slate-700 mb-2">Run this in your <b>Supabase SQL Editor</b>:</p>
                    <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-700">
                        <pre>{sqlSnippet}</pre>
                        <button 
                            type="button" 
                            onClick={copyToClipboard}
                            className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded transition-colors"
                            title="Copy SQL"
                        >
                            <Copy size={14} />
                        </button>
                    </div>
                 </div>

                 <button
                        onClick={handleTestConnection}
                        className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30"
                    >
                        I've run the SQL, Try Again
                 </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default CloudConnectModal;