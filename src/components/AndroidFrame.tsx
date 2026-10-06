import React from 'react';
import { Wifi, Battery, Signal, ArrowLeft, MoreVertical, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AndroidFrameProps {
  children: React.ReactNode;
  activeTitle?: string;
  onBack?: () => void;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({
  children,
  activeTitle = 'NoteCircle',
  onBack
}) => {
  const { toggleAndroidPreview } = useAuth();
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="py-6 px-4 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-slate-900/10">
      
      {/* Top Banner explaining Android Preview Mode */}
      <div className="mb-4 flex items-center gap-3 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 shadow-xs text-xs text-stone-700 dark:text-stone-300">
        <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span>
          <strong>Android Companion Mode</strong>: Simulating Pixel 8 Pro viewport (390×844px) & native ergonomics.
        </span>
        <button
          onClick={toggleAndroidPreview}
          className="text-amber-700 dark:text-amber-400 font-semibold hover:underline ml-2"
        >
          Exit to Fullscreen
        </button>
      </div>

      {/* Android Device Shell */}
      <div className="w-[390px] h-[820px] bg-white dark:bg-stone-900 rounded-[44px] shadow-2xl border-[10px] border-stone-900 dark:border-stone-800 flex flex-col overflow-hidden relative ring-1 ring-stone-900/20">
        
        {/* Android Punch Hole Camera */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-stone-950 rounded-full z-50 pointer-events-none" />

        {/* Android Status Bar */}
        <div className="h-8 bg-stone-50 dark:bg-stone-850 border-b border-stone-150 dark:border-stone-800 px-6 flex items-center justify-between text-[11px] font-semibold text-stone-800 dark:text-stone-200 select-none shrink-0 z-40">
          <span>{currentTime}</span>
          <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-400">
            <Signal className="w-3 h-3" />
            <Wifi className="w-3 h-3" />
            <Battery className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Android App Bar */}
        <div className="h-12 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 px-4 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 -ml-1 text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{activeTitle}</span>
          </div>
          <div className="flex items-center gap-1 text-stone-500">
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 font-bold px-1.5 py-0.5 rounded-md">
              Android Native
            </span>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto bg-[#FAF8F5] dark:bg-[#131211]">
          {children}
        </div>

        {/* Android Bottom Gesture Navigation Bar */}
        <div className="h-5 bg-white dark:bg-stone-900 flex items-center justify-center shrink-0 border-t border-stone-100 dark:border-stone-800">
          <div className="w-28 h-1 bg-slate-300 rounded-full" />
        </div>
      </div>
    </div>
  );
};
