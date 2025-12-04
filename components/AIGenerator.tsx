import React, { useState } from 'react';
import { generateProjectPlan } from '../services/geminiService';
import { WorkPackage, Task } from '../types';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onPlanGenerated: (wps: WorkPackage[], tasks: Task[]) => void;
}

const AIGenerator: React.FC<Props> = ({ onPlanGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await generateProjectPlan(prompt);
      if (data) {
        onPlanGenerated(data.workPackages, data.tasks);
        setPrompt('');
      } else {
        setError("Failed to generate plan. Please try again or check your API Key.");
      }
    } catch (err) {
      setError("An error occurred during generation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg p-6 text-white mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-yellow-300" />
        <h2 className="text-xl font-bold">AI Project Planner</h2>
      </div>
      <p className="text-indigo-100 mb-4 text-sm max-w-2xl">
        Describe your project (e.g., "Build a React e-commerce website" or "Plan a wedding in 3 months"), and our AI will generate Work Packages, Tasks, and Dependencies automatically.
      </p>
      
      <div className="flex gap-2 relative">
        <input 
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What would you like to build?"
          className="flex-1 px-4 py-3 rounded-lg text-slate-800 focus:ring-2 focus:ring-yellow-300 outline-none shadow-inner"
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
        />
        <button 
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : 'Generate'}
        </button>
      </div>
      {error && <p className="text-red-200 text-xs mt-2 font-medium">{error}</p>}
    </div>
  );
};

export default AIGenerator;
