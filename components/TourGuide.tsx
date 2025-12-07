
import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, MapPin } from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface TourGuideProps {
  steps: TourStep[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TourGuide: React.FC<TourGuideProps> = ({ steps, isOpen, onClose, onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [positionStyle, setPositionStyle] = useState<React.CSSProperties>({});
  
  const currentStep = steps[currentStepIndex];

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Recalculate on resize
      window.addEventListener('resize', updatePosition);
      return () => window.removeEventListener('resize', updatePosition);
    }
  }, [isOpen, currentStepIndex]);

  const updatePosition = () => {
    const element = document.getElementById(currentStep.targetId);
    if (element) {
      const rect = element.getBoundingClientRect();
      const padding = 10;
      
      // Calculate spotlight position logic would go here if we were doing SVG masking
      // For simple popover placement:
      let top = 0;
      let left = 0;
      
      const popoverWidth = 300;
      const popoverHeight = 150; // approx

      switch (currentStep.position) {
        case 'right':
          top = rect.top + (rect.height / 2) - (popoverHeight / 2);
          left = rect.right + padding;
          break;
        case 'left':
          top = rect.top + (rect.height / 2) - (popoverHeight / 2);
          left = rect.left - popoverWidth - padding;
          break;
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + (rect.width / 2) - (popoverWidth / 2);
          break;
        case 'top':
          top = rect.top - popoverHeight - padding;
          left = rect.left + (rect.width / 2) - (popoverWidth / 2);
          break;
      }

      // Boundary checks (basic)
      if (left < 10) left = 10;
      if (top < 10) top = 10;

      setPositionStyle({ top, left });
      
      // Scroll into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with hole logic is complex in pure CSS, using simplified dimmed overlay for now */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px] pointer-events-auto" onClick={onClose} />
      
      {/* Highlight Ring around target */}
      {(() => {
         const el = document.getElementById(currentStep.targetId);
         if (!el) return null;
         const rect = el.getBoundingClientRect();
         return (
            <div 
               className="absolute border-2 border-indigo-400 rounded-lg shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] transition-all duration-300 ease-in-out pointer-events-none box-content"
               style={{
                  top: rect.top - 4,
                  left: rect.left - 4,
                  width: rect.width + 8,
                  height: rect.height + 8,
                  zIndex: 101
               }}
            />
         );
      })()}

      {/* Popover Card */}
      <div 
        className="absolute bg-white dark:bg-slate-800 p-5 rounded-xl shadow-2xl w-[320px] border border-slate-200 dark:border-slate-700 pointer-events-auto transition-all duration-300 z-[102]"
        style={positionStyle}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-4 h-4" /></button>
        
        <div className="flex items-center gap-2 mb-2">
           <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-4 h-4" />
           </div>
           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Passo {currentStepIndex + 1} de {steps.length}</span>
        </div>

        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{currentStep.title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {currentStep.content}
        </p>

        <div className="flex justify-between items-center pt-2">
           <div className="flex gap-1">
              {steps.map((_, idx) => (
                 <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentStepIndex ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              ))}
           </div>
           <div className="flex gap-2">
              <button 
                 onClick={handlePrev} 
                 disabled={currentStepIndex === 0}
                 className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
              >
                 <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                 onClick={handleNext}
                 className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg flex items-center gap-1 shadow-md transition-colors"
              >
                 {currentStepIndex === steps.length - 1 ? 'Concluir' : 'Próximo'} 
                 {currentStepIndex !== steps.length - 1 && <ChevronRight className="w-4 h-4" />}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TourGuide;
