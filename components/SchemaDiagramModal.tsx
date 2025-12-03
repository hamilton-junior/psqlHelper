import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema } from '../types';
import { X, ZoomIn, ZoomOut, Move, Maximize, MousePointer2, Loader2, Search } from 'lucide-react';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

const TABLE_WIDTH = 200;
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 24;

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [initializing, setInitializing] = useState(true);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Initial Auto-Layout (Async to prevent blocking UI on large schemas)
  useEffect(() => {
    // Small timeout to allow UI to render 'Loading' state first
    const timer = setTimeout(() => {
      const newPositions: Record<string, NodePosition> = {};
      const count = schema.tables.length;
      
      // Calculate optimized grid
      const cols = Math.ceil(Math.sqrt(count));
      const spacingX = 300; // Wider spacing
      const spacingY = 400; // Taller spacing for columns

      schema.tables.forEach((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        newPositions[table.name] = {
          x: col * spacingX + 50,
          y: row * spacingY + 50
        };
      });
      setPositions(newPositions);
      setInitializing(false);
    }, 100);
    return () => clearTimeout(timer);
  }, [schema]);

  // Update container size on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // --- SEARCH FOCUS LOGIC ---
  useEffect(() => {
    if (!searchTerm.trim() || initializing || containerSize.w === 0) return;

    const term = searchTerm.toLowerCase();
    const matchingTables = schema.tables.filter(t => 
      t.name.toLowerCase().includes(term) || 
      t.columns.some(c => c.name.toLowerCase().includes(term))
    );

    if (matchingTables.length === 0) return;

    // Calculate Bounding Box of matches
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    matchingTables.forEach(t => {
      const pos = positions[t.name];
      if (pos) {
        minX = Math.min(minX, pos.x);
        maxX = Math.max(maxX, pos.x);
        minY = Math.min(minY, pos.y);
        maxY = Math.max(maxY, pos.y);
      }
    });

    // Add table dimensions to max values
    maxX += TABLE_WIDTH;
    // Estimate height
    const estHeight = 300; 
    maxY += estHeight;

    if (minX === Infinity) return;

    // Calculate center of the bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate required width/height
    const reqWidth = maxX - minX + 100; // buffer
    const reqHeight = maxY - minY + 100;

    // Determine scale to fit
    const scaleX = containerSize.w / reqWidth;
    const scaleY = containerSize.h / reqHeight;
    const newScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.2); // Clamp scale

    // Calculate Pan to center the box
    // formula: pan = (screenCenter) - (worldCenter * scale)
    const newPanX = (containerSize.w / 2) - (centerX * newScale);
    const newPanY = (containerSize.h / 2) - (centerY * newScale);

    // Apply animation effect via state updates
    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });

  }, [searchTerm, positions, containerSize, initializing, schema.tables]);


  // --- VIRTUALIZATION LOGIC ---
  
  // Calculate visible area in "world space"
  const visibleBounds = useMemo(() => {
    if (containerSize.w === 0) return null;
    
    // Invert the transform to find the world coordinates of the viewport
    const xMin = -pan.x / scale;
    const yMin = -pan.y / scale;
    const xMax = (-pan.x + containerSize.w) / scale;
    const yMax = (-pan.y + containerSize.h) / scale;
    
    // Add buffer to render slightly outside screen (smoother panning)
    const buffer = 500 / scale; // Scale buffer so it covers more area when zoomed out
    
    return {
       xMin: xMin - buffer,
       yMin: yMin - buffer,
       xMax: xMax + buffer,
       yMax: yMax + buffer
    };
  }, [pan, scale, containerSize]);

  // Level Of Detail (LOD)
  const lodLevel = useMemo(() => {
    if (scale < 0.3) return 'low';    // Just boxes
    if (scale < 0.6) return 'medium'; // Header only
    return 'high';                    // Full detail
  }, [scale]);

  // Check if a table matches search
  const isMatch = useCallback((tableName: string, columns: any[]) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return tableName.toLowerCase().includes(term) || columns.some(c => c.name.toLowerCase().includes(term));
  }, [searchTerm]);

  // Filter visible tables
  const visibleTables = useMemo(() => {
     if (!visibleBounds || initializing) return [];

     return schema.tables.filter(t => {
        const pos = positions[t.name];
        if (!pos) return false;
        
        // Always render if it matches search, even if slightly off screen (to allow pan to work correctly visually)
        if (searchTerm && isMatch(t.name, t.columns)) {
           return true;
        }

        // Approx height based on LOD to optimize cull check
        const height = lodLevel === 'high' 
           ? HEADER_HEIGHT + (t.columns.length * ROW_HEIGHT) 
           : HEADER_HEIGHT;

        // AABB Intersection Test
        return (
           pos.x + TABLE_WIDTH > visibleBounds.xMin &&
           pos.x < visibleBounds.xMax &&
           pos.y + height > visibleBounds.yMin &&
           pos.y < visibleBounds.yMax
        );
     });
  }, [positions, visibleBounds, initializing, lodLevel, schema.tables, searchTerm, isMatch]);


  // --- INTERACTION HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    // Only left click drags
    if (e.button !== 0) return;

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) {
      setDraggedNode(tableName);
    } else {
      setIsDraggingCanvas(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Calculate delta
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (draggedNode) {
      setPositions(prev => ({
        ...prev,
        [draggedNode]: {
          x: prev[draggedNode].x + dx / scale,
          y: prev[draggedNode].y + dy / scale
        }
      }));
    } else if (isDraggingCanvas) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    setDraggedNode(null);
    setIsDraggingCanvas(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const zoomSensitivity = 0.001;
    // Limit zoom between 0.05x (view all) and 2x (detail)
    const newScale = Math.min(Math.max(0.05, scale - e.deltaY * zoomSensitivity), 2);
    setScale(newScale);
  };

  // Generate Connections (Only for visible tables to save performance)
  const connections = useMemo(() => {
    const lines: React.ReactElement[] = [];
    
    // We iterate over visible tables to draw their outgoing connections
    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;

      const tableMatches = isMatch(table.name, table.columns);

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const [targetTable, targetCol] = col.references.split('.');
          const endPos = positions[targetTable];
          
          // Optimization: If target is not loaded/exists, skip
          if (!endPos) return;

          // Check opacity for connection
          const targetTableDef = schema.tables.find(t => t.name === targetTable);
          const targetMatches = targetTableDef ? isMatch(targetTable, targetTableDef.columns) : true;
          
          // If search is active, dim line unless BOTH ends match
          const isDimmed = searchTerm && (!tableMatches || !targetMatches);
          const opacity = isDimmed ? 0.05 : (lodLevel === 'low' ? 0.3 : 0.6);
          const strokeColor = isDimmed ? "#94a3b8" : "#6366f1";

          // Start Point
          const startX = startPos.x + TABLE_WIDTH;
          // In Low/Med LOD, all lines originate/terminate at center/header to look cleaner
          const startY = lodLevel === 'high' 
             ? startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
             : startPos.y + (HEADER_HEIGHT / 2);
          
          // End Point
          const targetColIndex = targetTableDef?.columns.findIndex(c => c.name === targetCol) ?? 0;
          
          const endX = endPos.x;
          const endY = lodLevel === 'high'
             ? endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
             : endPos.y + (HEADER_HEIGHT / 2);

          // Bezier Curve Logic
          const dist = Math.abs(endX - startX);
          const controlOffset = Math.max(dist * 0.5, 50);
          const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
          
          // Optimization: Simple lines for Low LOD
          const simplifiedPath = `M ${startX} ${startY} L ${endX} ${endY}`;

          lines.push(
            <g key={`${table.name}-${col.name}`} className="pointer-events-none transition-opacity duration-300">
               <path 
                  d={lodLevel === 'low' ? simplifiedPath : pathD} 
                  stroke={strokeColor} 
                  strokeWidth={lodLevel === 'low' ? 4 : 2} 
                  fill="none" 
                  opacity={opacity} 
                  markerEnd={(!isDimmed && lodLevel === 'high') ? "url(#arrowhead)" : undefined}
               />
               {lodLevel === 'high' && !isDimmed && (
                 <>
                   <circle cx={startX} cy={startY} r="3" fill={strokeColor} />
                   <circle cx={endX} cy={endY} r="3" fill={strokeColor} />
                 </>
               )}
            </g>
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, schema.tables, searchTerm, isMatch]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {/* Loading Overlay */}
        {initializing && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Organizando {schema.tables.length} tabelas...</p>
           </div>
        )}

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.05))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Maximize className="w-5 h-5" /></button>
           </div>
           
           {/* Search Input */}
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar tabela..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full placeholder-slate-400"
              />
              {searchTerm && (
                 <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
              )}
           </div>

           <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                 <MousePointer2 className="w-3 h-3" />
                 <span>Controles</span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                 <p>• Arraste o fundo para mover</p>
                 <p>• Scroll para zoom</p>
                 <p>• Tabelas visíveis: {visibleTables.length}</p>
                 <p className="capitalize">• Detalhe: {lodLevel}</p>
              </div>
           </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 rounded-lg shadow-md transition-colors border border-slate-200 dark:border-slate-700">
           <X className="w-6 h-6" />
        </button>

        {/* Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden cursor-move bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]"
          onMouseDown={(e) => handleMouseDown(e)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div 
             style={{ 
               transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
               transformOrigin: '0 0',
               width: '100%',
               height: '100%',
               // Hardware acceleration hint
               willChange: 'transform'
             }}
             className="relative w-full h-full transition-transform duration-500 ease-out"
          >
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                  </marker>
               </defs>
               {connections}
             </svg>

             {/* Virtualized Nodes */}
             {visibleTables.map(table => {
                const pos = positions[table.name] || {x: 0, y: 0};
                const matches = isMatch(table.name, table.columns);
                const isDimmed = searchTerm && !matches;

                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                         // Only apply shadow/borders if scale is reasonable to save paint performance on low LOD
                         boxShadow: lodLevel === 'low' ? 'none' : undefined,
                         opacity: isDimmed ? 0.2 : 1,
                      }}
                      className={`absolute bg-white dark:bg-slate-800 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 z-10 
                         ${lodLevel === 'low' ? 'border border-slate-400 dark:border-slate-600' : 'shadow-xl border-2 border-slate-200 dark:border-slate-700'}
                         ${matches && searchTerm ? 'ring-4 ring-indigo-500/30 border-indigo-500 dark:border-indigo-400 scale-105 z-20' : ''}
                      `}
                   >
                      {/* Node Header - Adapts to LOD */}
                      <div className={`
                         flex items-center justify-between rounded-t-md overflow-hidden transition-colors
                         ${lodLevel === 'low' ? 'h-full justify-center text-center p-2 bg-indigo-100 dark:bg-indigo-900/50' : 'h-10 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-3'}
                         ${matches && searchTerm ? 'bg-indigo-100 dark:bg-indigo-900' : ''}
                      `}>
                         <span 
                           className={`font-bold text-slate-700 dark:text-slate-200 truncate ${lodLevel === 'low' ? 'text-[10px] whitespace-normal' : 'text-xs'}`} 
                           title={table.name}
                         >
                            {table.name}
                         </span>
                         {lodLevel !== 'low' && (
                            <span className="text-[9px] text-slate-400 uppercase">{table.schema}</span>
                         )}
                      </div>
                      
                      {/* Columns - Only visible in High LOD */}
                      {lodLevel === 'high' && (
                         <div className="py-1">
                            {table.columns.map(col => (
                               <div key={col.name} className={`px-3 py-1 flex items-center justify-between text-[10px] hover:bg-slate-50 dark:hover:bg-slate-700/50 ${searchTerm && col.name.toLowerCase().includes(searchTerm.toLowerCase()) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
                                  <div className="flex items-center gap-1.5 overflow-hidden">
                                     {col.isPrimaryKey && <span className="text-amber-500 font-bold text-[8px]">PK</span>}
                                     {col.isForeignKey && <span className="text-blue-500 font-bold text-[8px]">FK</span>}
                                     <span className={`truncate ${col.isPrimaryKey ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {col.name}
                                     </span>
                                  </div>
                                  <span className="text-slate-400 font-mono text-[9px]">{col.type.split('(')[0]}</span>
                               </div>
                            ))}
                         </div>
                      )}

                      {/* Medium LOD Summary */}
                      {lodLevel === 'medium' && (
                         <div className="px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 flex justify-between">
                            <span>{table.columns.length} columns</span>
                            {table.columns.some(c => c.isPrimaryKey) && <span className="text-amber-500 font-bold">PK</span>}
                         </div>
                      )}
                   </div>
                );
             })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchemaDiagramModal;