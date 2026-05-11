import React, { useEffect, useState, useCallback } from 'react';
import { Task } from '../types';

interface Props {
  tasks: Task[];
  containerRef: React.RefObject<HTMLDivElement>;
}

const BoardDependencyLines: React.FC<Props> = ({ tasks, containerRef }) => {
  const [paths, setPaths] = useState<React.ReactElement[]>([]);
  const [, setTick] = useState(0); // For forcing re-render

  const calculatePaths = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPaths: React.ReactElement[] = [];

    tasks.forEach(task => {
      const taskEl = document.getElementById(`task-card-${task.id}`);
      if (!taskEl) return;

      const taskRect = taskEl.getBoundingClientRect();
      // Target Point (Left Center of current task)
      const targetX = taskRect.left - containerRect.left;
      const targetY = taskRect.top - containerRect.top + taskRect.height / 2;

      // Skip if task is hidden (e.g. scrolled out of view completely in a way we don't want to draw?)
      // For now we draw even if out of view, the SVG is clipped by container usually.
      
      task.dependencies.forEach(dep => {
        const sourceEl = document.getElementById(`task-card-${dep.sourceId}`);
        if (!sourceEl) return;

        const sourceRect = sourceEl.getBoundingClientRect();
        
        // Source Point (Right Center of predecessor task)
        const sourceX = sourceRect.right - containerRect.left;
        const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;

        const isSameColumn = Math.abs(sourceX - targetX) < 50; // Approximation

        // Draw Logic
        let d = '';
        if (targetX > sourceX + 20) {
            // Standard Forward Dependency
            const control1X = sourceX + 30;
            const control2X = targetX - 30;
            d = `M ${sourceX} ${sourceY} C ${control1X} ${sourceY}, ${control2X} ${targetY}, ${targetX} ${targetY}`;
        } else {
            // Backward or Same Column Dependency (Loop around)
            const loopOut = 30;
            d = `M ${sourceX} ${sourceY} 
                 C ${sourceX + loopOut} ${sourceY}, ${sourceX + loopOut} ${sourceY + (targetY > sourceY ? 30 : -30)}, ${sourceX + loopOut} ${sourceY + (targetY - sourceY) / 2}
                 S ${targetX - loopOut} ${targetY}, ${targetX} ${targetY}`;
        }

        // Check if task is roughly visible to optimize or style
        // If the task is inside a scroll container and is clipped, we might want to fade the line?
        // For simplicity, we just draw.

        newPaths.push(
          <path
            key={`${dep.sourceId}-${task.id}`}
            d={d}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            markerEnd="url(#board-arrow)"
            className="transition-all duration-300"
          />
        );
      });
    });

    setPaths(newPaths);
  }, [tasks, containerRef]);

  useEffect(() => {
    // Initial calculation
    // Timeout allows DOM to settle after render
    const t = setTimeout(calculatePaths, 100);
    
    const handleResize = () => calculatePaths();
    window.addEventListener('resize', handleResize);

    // Listen for scroll on all task containers
    const scrollContainers = document.querySelectorAll('.task-scroll-container');
    const onScroll = () => requestAnimationFrame(calculatePaths);
    
    scrollContainers.forEach(el => el.addEventListener('scroll', onScroll));
    // Also listen to main board scroll
    if (containerRef.current) {
        containerRef.current.addEventListener('scroll', onScroll);
    }

    return () => {
        clearTimeout(t);
        window.removeEventListener('resize', handleResize);
        scrollContainers.forEach(el => el.removeEventListener('scroll', onScroll));
        if (containerRef.current) {
            containerRef.current.removeEventListener('scroll', onScroll);
        }
    };
  }, [calculatePaths, tasks, containerRef, tasks.length]); // Re-run when task count changes

  // Polling to catch layout shifts (e.g. expansion of cards)
  useEffect(() => {
      const interval = setInterval(calculatePaths, 1000);
      return () => clearInterval(interval);
  }, [calculatePaths]);

  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
      <defs>
        <marker id="board-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
      </defs>
      {paths}
    </svg>
  );
};

export default BoardDependencyLines;