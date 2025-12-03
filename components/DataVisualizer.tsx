import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, AlertCircle, Settings2, CheckSquare, Square } from 'lucide-react';

interface DataVisualizerProps {
  data: any[];
}

type ChartType = 'bar' | 'line' | 'area';

const DataVisualizer: React.FC<DataVisualizerProps> = ({ data }) => {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [configOpen, setConfigOpen] = useState(false);

  // State for user configuration
  const [selectedXAxis, setSelectedXAxis] = useState<string>('');
  const [selectedYKeys, setSelectedYKeys] = useState<string[]>([]);

  // 1. Process Data (Ensure numbers are numbers) & Extract Keys
  const { processedData, allKeys, potentialNumberKeys } = useMemo(() => {
    if (!data || data.length === 0) return { processedData: [], allKeys: [], potentialNumberKeys: [] };
    
    // Normalize data: try to parse numeric strings as floats
    const cleanData = data.map(row => {
       const newRow: any = { ...row };
       Object.keys(newRow).forEach(key => {
          const val = newRow[key];
          // Check if looks like number
          if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
             newRow[key] = Number(val);
          }
       });
       return newRow;
    });

    const firstRow = cleanData[0];
    const keys = Object.keys(firstRow);
    
    // Find keys that are actually numbers in at least ONE row
    let numKeys = keys.filter(k => {
       const hasNumber = cleanData.some(row => {
          const val = row[k];
          return typeof val === 'number';
       });
       return hasNumber && k !== 'id' && !k.endsWith('_id');
    });

    // Fallback: If no strict metrics found, allow IDs to be charted (e.g. counting)
    if (numKeys.length === 0) {
       numKeys = keys.filter(k => {
          const hasNumber = cleanData.some(row => typeof row[k] === 'number');
          return hasNumber;
       });
    }

    return { processedData: cleanData, allKeys: keys, potentialNumberKeys: numKeys };
  }, [data]);

  // 2. Initialize Defaults (Heuristics) - Only when data changes significantly
  useEffect(() => {
    if (allKeys.length === 0) return;

    // Default X: Name, Date, or first string
    const defaultX = allKeys.find(k => {
       const kLower = k.toLowerCase();
       return kLower.includes('name') || kLower.includes('date') || kLower.includes('time') || kLower.includes('country');
    }) || allKeys.find(k => typeof processedData[0][k] === 'string') || allKeys[0];

    setSelectedXAxis(defaultX);

    // Default Y: All numeric keys found (limit to 3 to avoid clutter)
    if (potentialNumberKeys.length > 0) {
       setSelectedYKeys(potentialNumberKeys.slice(0, 3));
    } else {
       setSelectedYKeys([]);
    }

  }, [processedData, allKeys, potentialNumberKeys]);

  // Toggle Y Axis Key
  const toggleYKey = (key: string) => {
    setSelectedYKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      return [...prev, key];
    });
  };

  if (!processedData || processedData.length === 0) return null;

  // Colors for multiline/multibar
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  const renderChart = () => {
     if (selectedYKeys.length === 0) {
        return (
           <div className="flex flex-col items-center justify-center h-full text-slate-400">
             <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
             <p className="text-sm">Selecione pelo menos uma coluna numérica (Eixo Y).</p>
           </div>
        );
     }

     const commonProps = {
        data: processedData,
        margin: { top: 10, right: 30, left: 0, bottom: 0 }
     };

     switch (chartType) {
        case 'line':
           return (
              <LineChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                 />
                 <Legend />
                 {selectedYKeys.map((key, index) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                 ))}
              </LineChart>
           );
        case 'area':
           return (
              <AreaChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 <Legend />
                 {selectedYKeys.map((key, index) => (
                    <Area key={key} type="monotone" dataKey={key} stroke={colors[index % colors.length]} fill={colors[index % colors.length]} fillOpacity={0.3} />
                 ))}
              </AreaChart>
           );
        case 'bar':
        default:
           return (
              <BarChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                 <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: 'transparent'}} />
                 <Legend />
                 {selectedYKeys.map((key, index) => (
                    <Bar key={key} dataKey={key} fill={colors[index % colors.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
                 ))}
              </BarChart>
           );
     }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
       {/* Configuration Bar */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
          
          <div className="flex items-center gap-3">
             <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 shadow-sm border border-slate-200 dark:border-slate-700">
                <button onClick={() => setChartType('bar')} className={`p-1.5 rounded transition-colors ${chartType === 'bar' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-400'}`} title="Gráfico de Barras"><BarChart3 className="w-4 h-4" /></button>
                <button onClick={() => setChartType('line')} className={`p-1.5 rounded transition-colors ${chartType === 'line' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-400'}`} title="Gráfico de Linha"><LineChartIcon className="w-4 h-4" /></button>
                <button onClick={() => setChartType('area')} className={`p-1.5 rounded transition-colors ${chartType === 'area' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'text-slate-400'}`} title="Gráfico de Área"><AreaChartIcon className="w-4 h-4" /></button>
             </div>
             
             <button 
               onClick={() => setConfigOpen(!configOpen)}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${configOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
             >
                <Settings2 className="w-3.5 h-3.5" />
                Configurar Eixos
             </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-2">
             <span>Eixo X: <strong>{selectedXAxis}</strong></span>
             <span className="w-px h-3 bg-slate-300"></span>
             <span>Eixo Y: <strong>{selectedYKeys.join(', ') || 'Nenhum'}</strong></span>
          </div>
       </div>

       {/* Configuration Panel (Collapsible) */}
       {configOpen && (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm animate-in slide-in-from-top-2">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Eixo X (Categorias)</label>
                   <select 
                      value={selectedXAxis} 
                      onChange={(e) => setSelectedXAxis(e.target.value)}
                      className="w-full text-sm p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                   >
                      {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Eixo Y (Valores / Métricas)</label>
                   <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {potentialNumberKeys.length === 0 ? (
                         <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Nenhuma coluna numérica detectada</span>
                      ) : potentialNumberKeys.map(key => {
                         const isSelected = selectedYKeys.includes(key);
                         return (
                            <button 
                              key={key}
                              onClick={() => toggleYKey(key)}
                              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium border transition-all ${
                                 isSelected 
                                   ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' 
                                   : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400'
                              }`}
                            >
                               {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                               {key}
                            </button>
                         )
                      })}
                   </div>
                </div>
             </div>
          </div>
       )}

       <div className="flex-1 w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
             {renderChart()}
          </ResponsiveContainer>
       </div>
    </div>
  );
};

export default DataVisualizer;