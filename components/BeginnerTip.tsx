
import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { AppSettings } from '../types';

interface BeginnerTipProps {
  settings: AppSettings;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const BeginnerTip: React.FC<BeginnerTipProps> = ({ settings, title, children, className = '' }) => {
  const [visible, setVisible] = React.useState(true);

  if (!settings.beginnerMode || !visible) return null;

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-4 rounded-r-lg shadow-sm mb-4 relative animate-in fade-in slide-in-from-top-2 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-300 shrink-0 mt-0.5">
           <BookOpen className="w-4 h-4" />
        </div>
        <div className="flex-1">
           <h5 className="font-bold text-sm text-blue-800 dark:text-blue-100 mb-1">{title}</h5>
           <div className="text-xs text-blue-700 dark:text-blue-200 leading-relaxed">
              {children}
           </div>
        </div>
        <button 
           onClick={() => setVisible(false)} 
           className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 p-1"
           title="Ocultar esta dica"
        >
           <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default BeginnerTip;
