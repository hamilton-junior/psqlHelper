
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, MousePointer2, Loader2, Search } from 'lucide-react';

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
const COL_SPACING = 300;
const ROW_SPACING_GAP = 80;

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null); // New hover state
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  // Search State
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 1. Debounce Search Input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 400); // 400ms delay to prevent freezing
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 2. Layout Calculation Engine (Dynamic Height)
  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      
      // Calculate optimized grid
      const cols = Math.ceil(Math.sqrt(count));
      
      // Track the max height for each row to determine Y offset of next row
      const rowMaxHeights: number[] = [];
      
      // First pass: Group into visual rows and find max height per row
      tablesToLayout.forEach((table, index) => {
        const row = Math.floor(index / cols);
        const tableHeight = HEADER_HEIGHT + (table.columns.length * ROW_HEIGHT);
        
        if (!rowMaxHeights[row]) rowMaxHeights[row] = 0;
        if (tableHeight > rowMaxHeights[row]) rowMaxHeights[row] = tableHeight;
      });

      // Second pass: Position them using the calculated row heights
      tablesToLayout.forEach((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        // Calculate Y based on previous rows' heights
        let currentY = 50;
        for (let r = 0; r < row; r++) {
           currentY += rowMaxHeights[r] + ROW_SPACING_GAP;
        }

        newPositions[table.name] = {
          x: col * COL_SPACING + 50,
          y: currentY
        };
      });
      return newPositions;
  }, []);

  // 3. Effect: Recalculate Layout when Search Changes or Schema Loads
  useEffect(() => {
    setIsLayoutReady(false);
    
    // Defer slightly to allow UI to show loading state if needed
    const timer = setTimeout(() => {
      let tablesToRender = schema.tables;

      // Filter if searching
      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => 
          t.name.toLowerCase().includes(term) || 
          t.columns.some(c => c.name.toLowerCase().includes(term))
        );
      }

      // Run Layout Algorithm
      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      
      // Auto-fit / Reset View
      if (debouncedTerm.trim()) {
         // Focus on the cluster
         setPan({ x: 50, y: 50 }); // Reset pan
         setScale(1); // Reset zoom
      }
      
      setIsLayoutReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [debouncedTerm, schema.tables, calculateLayout]);


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


  // --- VIRTUALIZATION LOGIC ---
  
  // Calculate visible area in "world space"
  const visibleBounds = useMemo(() => {
    if (containerSize.w === 0) return null;
    
    // Invert the transform to find the world coordinates of the viewport
    const xMin = -pan.x / scale;
    const yMin = -pan.y / scale;
    const xMax = (-pan.x + containerSize.w) / scale;
    const yMax = (-pan.y + containerSize.h) / scale;
    
    // Add buffer
    const buffer = 500 / scale;
    
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

  // Filter visible tables
  const visibleTables = useMemo(() => {
     if (!isLayoutReady) return [];

     // If searching, show all matches (virtualization disabled for filtered set to avoid glitch)
     if (debouncedTerm.trim()) {
        return schema.tables.filter(t => !!positions[t.name]);
     }

     const tablesWithName = schema.tables.filter(t => !!positions[t.name]);
     if (!visibleBounds) return tablesWithName;

     return tablesWithName.filter(t => {
        const pos = positions[t.name];
        if (!pos) return false;
        
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
  }, [positions, visibleBounds, isLayoutReady, lodLevel, schema.tables, debouncedTerm]);


  // --- INTERACTION HANDLERS ---

  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) {
      setDraggedNode(tableName);
    } else {
      setIsDraggingCanvas(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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
    const newScale = Math.min(Math.max(0.05, scale - e.deltaY * zoomSensitivity), 2);
    setScale(newScale);
  };

  // Generate Connections
  const connections = useMemo(() => {
    const lines: React.ReactElement[] = [];
    
    // We iterate over visible tables to draw their outgoing connections
    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const [targetTable, targetCol] = col.references.split('.');
          
          // CRITICAL: Only draw if target is also in the current layout/positions
          const endPos = positions[targetTable];
          if (!endPos) return;

          const opacity = lodLevel === 'low' ? 0.3 : 0.6;
          const strokeColor = "#6366f1";

          const startX = startPos.x + TABLE_WIDTH;
          const startY = lodLevel === 'high' 
             ? startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
             : startPos.y + (HEADER_HEIGHT / 2);
          
          const targetTableDef = schema.tables.find(t => t.name === targetTable);
          const targetColIndex = targetTableDef?.columns.findIndex(c => c.name === targetCol) ?? 0;
          
          const endX = endPos.x;
          const endY = lodLevel === 'high'
             ? endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2)
             : endPos.y + (HEADER_HEIGHT / 2);

          const dist = Math.abs(endX - startX);
          const controlOffset = Math.max(dist * 0.5, 50);
          const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
          const simplifiedPath = `M ${startX} ${startY} L ${endX} ${endY}`;

          lines.push(
            <g key={`${table.name}-${col.name}`} className="pointer-events-none transition-opacity duration-300">
               <path 
                  d={lodLevel === 'low' ? simplifiedPath : pathD} 
                  stroke={strokeColor} 
                  strokeWidth={lodLevel === 'low' ? 4 : 2} 
                  fill="none" 
                  opacity={opacity} 
                  markerEnd={(lodLevel === 'high') ? "url(#arrowhead)" : undefined}
               />
               {lodLevel === 'high' && (
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
  }, [visibleTables, positions, lodLevel, schema.tables]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {/* Loading Overlay */}
        {!isLayoutReady && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Organizando visualização...</p>
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
              <Search className={`w-4 h-4 ${inputValue !== debouncedTerm ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
              <input 
                type="text" 
                placeholder="Buscar e isolar tabela..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full placeholder-slate-400"
              />
              {inputValue && (
                 <button onClick={() => setInputValue('')} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
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
                 {debouncedTerm && <p className="text-indigo-400 font-bold">• Resultados Isolados</p>}
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
               willChange: 'transform'
             }}
             className="relative w-full h-full transition-transform duration-300 ease-out"
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
                const pos = positions[table.name];
                if (!pos) return null; // Safety check
                
                const isHovered = hoveredNode === table.name;
                
                // Determine display LOD
                // If hovered and zoomed out, force 'high' detail
                const shouldMagnify = isHovered && lodLevel !== 'high';
                const displayLOD = shouldMagnify ? 'high' : lodLevel;
                
                // Calculate magnification scale to counteract global zoom out
                // We clamp it so it doesn't get ridiculously huge
                // Formula: 1/scale attempts to restore 1:1 view. We multiply to make it even bigger/smaller.
                // Cap between 1.5x (minimum pop) and 6.0x (max explosion)
                const hoverScale = shouldMagnify 
                   ? Math.min(Math.max(1 / scale, 1.5), 6.0) 
                   : 1;
                
                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      onMouseEnter={() => setHoveredNode(table.name)}
                      onMouseLeave={() => setHoveredNode(null)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px) scale(${hoverScale})`,
                         transformOrigin: 'top left', // Scale from top-left keeps it anchored somewhat predictable
                         width: TABLE_WIDTH,
                         boxShadow: lodLevel === 'low' ? 'none' : undefined,
                         zIndex: isHovered ? 100 : 10, // Bring to front on hover
                      }}
                      className={`absolute bg-white dark:bg-slate-800 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-200 ease-out 
                         ${lodLevel === 'low' && !shouldMagnify ? 'border border-slate-400 dark:border-slate-600' : 'shadow-xl border-2 border-slate-200 dark:border-slate-700'}
                      `}
                   >
                      {/* Node Header */}
                      <div className={`
                         flex items-center justify-between rounded-t-md overflow-hidden transition-colors
                         ${displayLOD === 'low' ? 'h-full justify-center text-center p-2 bg-indigo-100 dark:bg-indigo-900/50' : 'h-10 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-3'}
                         ${debouncedTerm ? 'bg-indigo-100 dark:bg-indigo-900' : ''}
                      `}>
                         <span 
                           className={`font-bold text-slate-700 dark:text-slate-200 truncate ${displayLOD === 'low' ? 'text-[10px] whitespace-normal' : 'text-xs'}`} 
                           title={table.name}
                         >
                            {table.name}
                         </span>
                         {displayLOD !== 'low' && (
                            <span className="text-[9px] text-slate-400 uppercase">{table.schema}</span>
                         )}
                      </div>
                      
                      {/* Columns */}
                      {displayLOD === 'high' && (
                         <div className="py-1">
                            {table.columns.map(col => (
                               <div key={col.name} className={`px-3 py-1 flex items-center justify-between text-[10px] hover:bg-slate-50 dark:hover:bg-slate-700/50 ${debouncedTerm && col.name.toLowerCase().includes(debouncedTerm.toLowerCase()) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
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
                      {displayLOD === 'medium' && (
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
