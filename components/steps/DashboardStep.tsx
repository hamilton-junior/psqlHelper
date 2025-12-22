import React from 'react';
import { DashboardItem } from '../../types';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Calendar, LayoutGrid, X } from 'lucide-react';

interface DashboardStepProps {
  items: DashboardItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
}

const DashboardStep: React.FC<DashboardStepProps> = ({ items, onRemoveItem, onClearAll }) => {
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
          <LayoutGrid className="w-10 h-10 opacity-30" />
        </div>
        <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300 mb-2">Dashboard Vazio</h3>
        <p className="max-w-md text-center">
          Vá para a tela de <strong>Resultados</strong> e clique no ícone de alfinete (📌) nos gráficos para adicioná-los aqui.
        </p>
      </div>
    );
  }

  const renderChart = (item: DashboardItem) => {
     const commonProps = {
        data: item.data,
        margin: { top: 10, right: 30, left: 0, bottom: 0 }
     };

     const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

     switch(item.type) {
        case 'line':
           return (
              <LineChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={item.config.xAxis} stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <Tooltip />
                 {item.config.yKeys.map((k, i) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={colors[i%colors.length]} strokeWidth={2} dot={false} />
                 ))}
              </LineChart>
           );
        case 'area':
            return (
              <AreaChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={item.config.xAxis} stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <Tooltip />
                 {item.config.yKeys.map((k, i) => (
                    <Area key={k} type="monotone" dataKey={k} stroke={colors[i%colors.length]} fill={colors[i%colors.length]} fillOpacity={0.3} />
                 ))}
              </AreaChart>
           );
        default:
           return (
              <BarChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={item.config.xAxis} stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                 <Tooltip cursor={{fill: 'transparent'}} />
                 {item.config.yKeys.map((k, i) => (
                    <Bar key={k} dataKey={k} fill={colors[i%colors.length]} radius={[4, 4, 0, 0]} />
                 ))}
              </BarChart>
           );
     }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-indigo-600" />
            Meu Dashboard
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
             {items.length} indicadores monitorados
          </p>
        </div>
        <button 
           onClick={() => { if(confirm("Limpar todo o dashboard?")) onClearAll(); }}
           className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg"
        >
           <Trash2 className="w-4 h-4" /> Limpar Tudo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
         {items.map(item => (
            <div key={item.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[320px] group">
               <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                  <div>
                     <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.title}</h4>
                     <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleDateString()}
                     </div>
                  </div>
                  <button onClick={() => onRemoveItem(item.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                     <X className="w-4 h-4" />
                  </button>
               </div>
               <div className="flex-1 p-4 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                     {renderChart(item)}
                  </ResponsiveContainer>
               </div>
            </div>
         ))}
      </div>
    </div>
  );
};

export default DashboardStep;