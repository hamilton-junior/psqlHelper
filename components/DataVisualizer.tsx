import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, AlertCircle, Settings2, CheckSquare, Square } from 'lucide-react';

interface DataVisualizerProps {
  data: any[];
  onDrillDown?: (col: string, val: any) => void;
}

type ChartType = 'bar' | 'line' | 'area';

const DataVisualizer: React.FC<DataVisualizerProps> = ({ data, onDrillDown }) => {
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

    // Extract ALL keys from ALL rows (handling sparse data)
    const allUniqueKeys = Array.from(new Set(cleanData.flatMap((row: any) => Object.keys(row)))) as string[];

    // Find keys that are actually numbers in at least ONE row
    let numKeys = allUniqueKeys.filter(k => {
       const hasNumber = cleanData.some(row => {
          const val = row[k];
          return typeof val === 'number';
       });
       return hasNumber && k !== 'id' && !k.endsWith('_id') && !k.endsWith('Id');
    });

    if (numKeys.length === 0) {
       numKeys = allUniqueKeys.filter(k => {
          const hasNumber = cleanData.some(row => typeof row[k] === 'number');
          return hasNumber;
       });
    }

    return { processedData: cleanData, allKeys: allUniqueKeys, potentialNumberKeys: numKeys };
  }, [data]);

  // 2. Initialize Defaults (Heuristics)
  useEffect(() => {
    if (allKeys.length === 0) return;

    const defaultX = allKeys.find(k => {
       const kLower = k.toLowerCase();
       return kLower.includes('name') || kLower.includes('date') || kLower.includes('time') || kLower.includes('country') || kLower.includes('category');
    }) || allKeys.find(k => {
        return processedData.some(row => typeof row[k] === 'string');
    }) || allKeys[0];

    setSelectedXAxis(defaultX);

    if (potentialNumberKeys.length > 0) {
       setSelectedYKeys(potentialNumberKeys.slice(0, 3));
    } else {
       setSelectedYKeys([]);
    }

  }, [processedData, allKeys, potentialNumberKeys]);

  const toggleYKey = (key: string) => {
    setSelectedYKeys(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      return [...prev, key];
    });
  };

  const handleChartClick = (dataPoint: any) => {
     if (onDrillDown && dataPoint && selectedXAxis) {
        const val = dataPoint[selectedXAxis];
        if (val !== undefined && val !== null) {
           onDrillDown(selectedXAxis, val);
        } else if (dataPoint.activeLabel) {
           onDrillDown(selectedXAxis, dataPoint.activeLabel);
        }
     }
  };

  if (!processedData || processedData.length === 0) return (
     <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
       <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
       <p className="text-sm">Sem dados para visualizar.</p>
     </div>
  );

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
        margin: { top: 10, right: 30, left: 0, bottom: 0 },
     };

     const tooltipStyle = { 
        borderRadius: '12px', 
        border: 'none', 
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
        color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#1e293b'
     };

     switch (chartType) {
        case 'line':
           return (
              <LineChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                 <Tooltip contentStyle={tooltipStyle} />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 {selectedYKeys.map((key, index) => (
                    <Line 
                       key={key} 
                       type="monotone" 
                       dataKey={key} 
                       stroke={colors[index % colors.length]} 
                       strokeWidth={3} 
                       dot={{ r: 4, strokeWidth: 2, fill: '#fff', onClick: (p: any) => handleChartClick(p.payload), cursor: 'pointer' }} 
                       activeDot={{ r: 6, strokeWidth: 0, onClick: (p: any) => handleChartClick(p.payload), cursor: 'pointer' }} 
                    />
                 ))}
              </LineChart>
           );
        case 'area':
           return (
              <AreaChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                 <Tooltip contentStyle={tooltipStyle} />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 {selectedYKeys.map((key, index) => (
                    <Area 
                        key={key} 
                        type="monotone" 
                        dataKey={key} 
                        stroke={colors[index % colors.length]} 
                        fill={colors[index % colors.length]} 
                        fillOpacity={0.15} 
                        strokeWidth={3}
                        activeDot={{ r: 6, strokeWidth: 0, onClick: (p: any) => handleChartClick(p.payload), cursor: 'pointer' }}
                    />
                 ))}
              </AreaChart>
           );
        case 'bar':
        default:
           return (
              <BarChart {...commonProps}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                 <XAxis dataKey={selectedXAxis} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                 <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                 {/* 
                    CURSOR SUAVE: 
                    Substituímos fill: transparent por um indigo muito leve (5% opacidade).
                    Isso destaca a coluna atual sem agredir os olhos.
                 */}
                 <Tooltip 
                    contentStyle={tooltipStyle} 
                    cursor={{ fill: 'rgba(99, 102, 241, 0.04)', radius: 8 }} 
                 />
                 <Legend wrapperStyle={{ paddingTop: '20px' }} />
                 {selectedYKeys.map((key, index) => (
                    <Bar 
                        key={key} 
                        dataKey={key} 
                        fill={colors[index % colors.length]} 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={50} 
                        onClick={(data) => handleChartClick(data)}
                        cursor="pointer"
                    />
                 ))}
              </BarChart>
           );
     }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
       {/* Configuration Bar */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
          
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

          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-800">
             <span>Eixo X: <strong className="text-indigo-600 dark:text-indigo-400 ml-1">{selectedXAxis}</strong></span>
             <span className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1"></span>
             <span>Eixo Y: <strong className="text-indigo-600 dark:text-indigo-400 ml-1">{selectedYKeys.join(', ') || 'Nenhum'}</strong></span>
          </div>
       </div>

       {/* Configuration Panel */}
       {configOpen && (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl animate-in slide-in-from-top-2 duration-300">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Eixo X (Categorias)</label>
                   <select 
                      value={selectedXAxis} 
                      onChange={(e) => setSelectedXAxis(e.target.value)}
                      className="w-full text-xs font-bold p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                   >
                      {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Eixo Y (Métricas)</label>
                   <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                      {potentialNumberKeys.length === 0 ? (
                         <span className="text-xs text-amber-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Nenhuma coluna numérica</span>
                      ) : potentialNumberKeys.map(key => {
                         const isSelected = selectedYKeys.includes(key);
                         return (
                            <button 
                              key={key}
                              onClick={() => toggleYKey(key)}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${
                                 isSelected 
                                   ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                   : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-700'
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

       <div className="flex-1 w-full min-h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
             {renderChart()}
          </ResponsiveContainer>
       </div>
    </div>
  );
};

export default DataVisualizer;