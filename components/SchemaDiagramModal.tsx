
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, MousePointer2, Loader2, Search, Activity, HelpCircle, Key, Link, Target, CornerDownRight, Copy, Eye, Table as TableIcon, Download, Map as MapIcon } from 'lucide-react';
import html2canvas from 'html2canvas';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface HoveredColumnState {
  table: string;
  col: string;
  isPk: boolean;
  ref?: string;
}

interface SelectedRelationship {
  source: string;
  target: string;
  colName: string;
  targetColName: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  tableName: string;
}

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 42; 
const ROW_HEIGHT = 28;    
const COL_SPACING = 300;
const ROW_SPACING_GAP = 60;

// --- Minimap Component ---
const Minimap = ({ 
   positions, 
   visibleTables, 
   containerSize, 
   pan, 
   scale,
   tables 
}: { 
   positions: Record<string, NodePosition>, 
   visibleTables: Table[], 
   containerSize: {w: number, h: number}, 
   pan: {x: number, y: number},
   scale: number,
   tables: Table[]
}) => {
   // Calculate bounding box of the entire diagram
   const bounds = useMemo(() => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      if (visibleTables.length === 0) return { minX: 0, minY: 0, w: 100, h: 100 };
      
      visibleTables.forEach(t => {
         const p = positions[t.name];
         if (p) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + TABLE_WIDTH);
            maxY = Math.max(maxY, p.y + (t.columns.length * ROW_HEIGHT) + HEADER_HEIGHT);
         }
      });
      // Add padding
      return { minX: minX - 100, minY: minY - 100, w: (maxX - minX) + 200, h: (maxY - minY) + 200 };
   }, [positions, visibleTables]);

   if (visibleTables.length === 0) return null;

   const mapWidth = 200;
   const mapScale = mapWidth / bounds.w;
   const mapHeight = bounds.h * mapScale;

   // Calculate Viewport Rect
   // The viewport is defined by: pan.x/y and containerSize, inversely scaled by 'scale'
   const viewportX = (-pan.x / scale - bounds.minX) * mapScale;
   const viewportY = (-pan.y / scale - bounds.minY) * mapScale;
   const viewportW = (containerSize.w / scale) * mapScale;
   const viewportH = (containerSize.h / scale) * mapScale;

   return (
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl overflow-hidden z-[60] backdrop-blur transition-opacity duration-200 hover:opacity-100 opacity-80">
         <div className="relative bg-slate-50 dark:bg-slate-900" style={{ width: mapWidth, height: mapHeight }}>
            {visibleTables.map(t => {
               const p = positions[t.name];
               if (!p) return null;
               // Map coordinates
               const mx = (p.x - bounds.minX) * mapScale;
               const my = (p.y - bounds.minY) * mapScale;
               const mw = TABLE_WIDTH * mapScale;
               const mh = ((t.columns.length * ROW_HEIGHT) + HEADER_HEIGHT) * mapScale;
               
               return (
                  <div 
                     key={t.name}
                     className="absolute bg-indigo-200 dark:bg-indigo-700/50 rounded-sm"
                     style={{ left: mx, top: my, width: mw, height: mh }}
                  />
               );
            })}
            {/* Viewport Indicator */}
            <div 
               className="absolute border-2 border-red-500 bg-red-500/10 cursor-move"
               style={{ 
                  left: viewportX, 
                  top: viewportY, 
                  width: Math.min(viewportW, mapWidth), 
                  height: Math.min(viewportH, mapHeight) 
               }}
            />
         </div>
         <div className="px-2 py-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1">
             <MapIcon className="w-3 h-3" /> Minimap
         </div>
      </div>
   );
};

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  
  // Interaction States
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<SelectedRelationship | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  // Interaction Performance State
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeout = useRef<any>(null);
  
  // Search State
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // 1. Debounce Search Input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 400); 
    return () => clearTimeout(timer);
  }, [inputValue]);

  // 2. Interaction Throttler
  const triggerInteraction = useCallback(() => {
     if (!isInteracting) setIsInteracting(true);
     if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
     interactionTimeout.current = setTimeout(() => {
        setIsInteracting(false);
     }, 150);
  }, [isInteracting]);

  // 3. Pre-calculate Relationship Graph
  const relationshipGraph = useMemo(() => {
    const adj: Record<string, Set<string>> = {};
    schema.tables.forEach(t => {
       if (!adj[t.name]) adj[t.name] = new Set();
       t.columns.forEach(c => {
          if (c.isForeignKey && c.references) {
             const parts = c.references.split('.'); 
             const targetTable = parts.length === 3 ? parts[1] : parts[0];
             
             if (!adj[t.name]) adj[t.name] = new Set();
             if (!adj[targetTable]) adj[targetTable] = new Set();
             
             adj[t.name].add(targetTable);
             adj[targetTable].add(t.name);
          }
       });
    });
    return adj;
  }, [schema.tables]);

  // 4. Layout Calculation Engine
  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      const rowMaxHeights: number[] = [];
      
      tablesToLayout.forEach((table, index) => {
        const row = Math.floor(index / cols);
        // Estimate height
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 15) * ROW_HEIGHT); 
        
        if (!rowMaxHeights[row]) rowMaxHeights[row] = 0;
        if (tableHeight > rowMaxHeights[row]) rowMaxHeights[row] = tableHeight;
      });

      tablesToLayout.forEach((table, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

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

  useEffect(() => {
    setIsLayoutReady(false);
    const timer = setTimeout(() => {
      let tablesToRender = schema.tables;

      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => 
          t.name.toLowerCase().includes(term) || 
          t.columns.some(c => c.name.toLowerCase().includes(term))
        );
      }

      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      
      if (debouncedTerm.trim()) {
         setPan({ x: 50, y: 50 });
         setScale(1);
      }
      
      setIsLayoutReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [debouncedTerm, schema.tables, calculateLayout]);

  // Update container size
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

  const lodLevel = useMemo(() => {
    if (isInteracting) {
        if (scale < 0.4) return 'low';    
        if (scale < 0.8) return 'medium'; 
        return 'high';                    
    }
    if (scale < 0.35) return 'low';       
    if (scale < 0.5) return 'medium';     
    return 'high';                        
  }, [scale, isInteracting]);

  const visibleTables = useMemo(() => {
     if (!isLayoutReady) return [];
     if (debouncedTerm.trim()) return schema.tables.filter(t => !!positions[t.name]);
     return schema.tables.filter(t => !!positions[t.name]);
  }, [positions, isLayoutReady, schema.tables, debouncedTerm]);

  // --- INTERACTION HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    // Left click only
    if (e.button !== 0) return;
    
    // Close context menu if clicking elsewhere
    setContextMenu(null);
    
    // Clear selected relationship if clicking empty space
    if (!tableName) {
       setSelectedRelationship(null);
    }

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) setDraggedNode(tableName);
    else setIsDraggingCanvas(true);
  };
  
  const handleContextMenu = (e: React.MouseEvent, tableName: string) => {
     e.preventDefault();
     e.stopPropagation();
     // Set menu position
     setContextMenu({
        x: e.clientX,
        y: e.clientY,
        tableName
     });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas && !draggedNode) return;
    
    triggerInteraction(); 
    
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
    setContextMenu(null);
    triggerInteraction();
    const zoomSensitivity = 0.001;
    const newScale = Math.min(Math.max(0.05, scale - e.deltaY * zoomSensitivity), 2);
    setScale(newScale);
  };
  
  const handleContextMenuAction = (action: 'copy' | 'focus' | 'reset') => {
     if (!contextMenu) return;
     
     if (action === 'copy') {
        navigator.clipboard.writeText(contextMenu.tableName);
     } else if (action === 'focus') {
        const pos = positions[contextMenu.tableName];
        if (pos && containerRef.current) {
           const centerX = containerRef.current.clientWidth / 2;
           const centerY = containerRef.current.clientHeight / 2;
           setPan({
              x: centerX - (pos.x * 1.5) - (TABLE_WIDTH / 2),
              y: centerY - (pos.y * 1.5) - (100)
           });
           setScale(1.5);
        }
     } else if (action === 'reset') {
        if (inputValue === contextMenu.tableName) setInputValue('');
     }
     setContextMenu(null);
  };

  const handleExportImage = async () => {
     if (!containerRef.current) return;
     try {
        // Reset transform temporarily for capture if needed, or just capture visible
        // Capture visible is easiest.
        const canvas = await html2canvas(containerRef.current, {
           backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f1f5f9',
           ignoreElements: (element) => element.classList.contains('minimap-ignore')
        });
        const link = document.createElement('a');
        link.download = `schema_diagram_${schema.name}.png`;
        link.href = canvas.toDataURL();
        link.click();
     } catch (e) {
        console.error("Export failed", e);
        alert("Falha ao exportar imagem.");
     }
  };

  // --- SMART PATH CALCULATION ---
  const getSmartPath = (
    start: {x: number, y: number}, 
    end: {x: number, y: number}
  ) => {
    const isTargetRight = end.x > start.x + TABLE_WIDTH;
    const isTargetLeft = end.x + TABLE_WIDTH < start.x;
    
    // Anchors
    let startX: number, endX: number;
    let cp1x: number, cp2x: number;
    
    // Default curve strength
    const distX = Math.abs(end.x - start.x);
    let curve = Math.max(distX * 0.4, 80);

    if (isTargetRight) {
       startX = start.x + TABLE_WIDTH;
       endX = end.x;
       cp1x = startX + curve;
       cp2x = endX - curve;
    } else if (isTargetLeft) {
       startX = start.x;
       endX = end.x + TABLE_WIDTH;
       cp1x = startX - curve;
       cp2x = endX + curve;
    } else {
       if (end.x > start.x) {
          startX = start.x + TABLE_WIDTH;
          endX = end.x + TABLE_WIDTH;
          curve = 60 + (Math.abs(end.y - start.y) * 0.1); 
          cp1x = startX + curve;
          cp2x = endX + curve;
       } else {
          startX = start.x;
          endX = end.x;
          curve = 60 + (Math.abs(end.y - start.y) * 0.1);
          cp1x = startX - curve;
          cp2x = endX - curve;
       }
    }
    
    return `M ${startX} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${endX} ${end.y}`;
  };

  // --- RENDER CONNECTIONS ---
  const connections = useMemo(() => {
    if (isInteracting && visibleTables.length > 50) return []; 
    // If selecting a relationship, show it!
    if (visibleTables.length > 200 && !hoveredNode && !hoveredColumn && !selectedRelationship) return []; 

    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => t.name));

    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;
      
      // Filter logic for focus mode
      if (selectedRelationship) {
         // If a relationship is selected, ONLY show lines related to the two involved tables
         const isRelated = table.name === selectedRelationship.source || table.name === selectedRelationship.target;
         if (!isRelated) return;
      } else if (hoveredNode) {
         const isRelated = table.name === hoveredNode || relationshipGraph[hoveredNode]?.has(table.name);
         if (!isRelated) return;
      }

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          const targetTable = parts.length === 3 ? parts[1] : parts[0];
          const targetColName = parts.length === 3 ? parts[2] : parts[1];
          
          if (!visibleSet.has(targetTable) && !hoveredNode && !selectedRelationship) return;

          // Relationship Filter Logic
          if (selectedRelationship) {
             const matchesSelected = (table.name === selectedRelationship.source && col.name === selectedRelationship.colName) && targetTable === selectedRelationship.target;
             if (!matchesSelected) return;
          } else if (hoveredNode) {
             const isLineRelevant = table.name === hoveredNode || targetTable === hoveredNode;
             if (!isLineRelevant) return;
          }

          let isHighlighted = false;
          if (selectedRelationship) {
             isHighlighted = true; // If we made it here in selected mode, it IS the selected line
          } else if (hoveredColumn) {
             if (hoveredColumn.isPk && hoveredColumn.table === targetTable && hoveredColumn.col === targetColName) {
                isHighlighted = true;
             } else if (!hoveredColumn.isPk && hoveredColumn.table === table.name && hoveredColumn.col === col.name) {
                isHighlighted = true;
             } else {
                return;
             }
          }

          const endPos = positions[targetTable];
          if (!endPos) return;

          const targetTableObj = schema.tables.find(t => t.name === targetTable);
          let targetColIndex = 0;
          if (targetTableObj) {
             targetColIndex = targetTableObj.columns.findIndex(c => c.name === targetColName);
             if (targetColIndex === -1) targetColIndex = 0;
          }

          const sourceAnchorY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          
          let targetAnchorY = endPos.y + (HEADER_HEIGHT / 2);
          if (lodLevel === 'high' || hoveredNode || selectedRelationship) {
              targetAnchorY = endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          }

          const pathD = getSmartPath(
             {x: startPos.x, y: sourceAnchorY}, 
             {x: endPos.x, y: targetAnchorY}
          );
          
          // Color Logic
          let strokeColor = "#94a3b8";
          let strokeWidth = 1.5;
          let opacity = 0.35;

          if (isHighlighted || selectedRelationship) {
             strokeColor = "#f59e0b"; // Amber
             strokeWidth = 3;
             opacity = 1;
          } else if (hoveredNode) {
             strokeColor = "#6366f1"; // Indigo
             strokeWidth = 2;
             opacity = 0.8;
          }

          const relKey = `${table.name}-${col.name}-${targetTable}`;

          lines.push(
            <g key={relKey}>
               {/* Invisible Hitbox for easier clicking */}
               <path 
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={15}
                  fill="none"
                  className="cursor-pointer hover:stroke-indigo-500/10 pointer-events-auto"
                  onClick={(e) => {
                     e.stopPropagation();
                     if (selectedRelationship && selectedRelationship.source === table.name && selectedRelationship.colName === col.name) {
                        setSelectedRelationship(null); // Toggle off
                     } else {
                        setSelectedRelationship({
                           source: table.name,
                           colName: col.name,
                           target: targetTable,
                           targetColName: targetColName
                        });
                     }
                  }}
               >
                  <title>Click to focus relationship</title>
               </path>
               {/* Visible Path */}
               <path 
                  d={pathD} 
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth} 
                  fill="none" 
                  opacity={opacity} 
                  className="pointer-events-none transition-all duration-300"
                  markerEnd={(isHighlighted || hoveredNode || selectedRelationship) ? "url(#arrowhead)" : undefined}
               />
            </g>
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, schema.tables, hoveredNode, hoveredColumn, relationshipGraph, selectedRelationship]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {!isLayoutReady && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Organizando visualização...</p>
           </div>
        )}

        {/* Toolbar */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none minimap-ignore">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1 pointer-events-auto">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Zoom In"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.05))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Zoom Out"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); setSelectedRelationship(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Resetar Visualização"><Maximize className="w-5 h-5" /></button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
              <button onClick={handleExportImage} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Exportar como Imagem"><Download className="w-5 h-5" /></button>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-64 pointer-events-auto">
              <Search className={`w-4 h-4 ${inputValue !== debouncedTerm ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
              <input 
                type="text" 
                placeholder="Buscar tabela..." 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full placeholder-slate-400"
              />
              {inputValue && (
                 <button onClick={() => setInputValue('')} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
              )}
           </div>

           <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 pointer-events-auto">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                 {isInteracting ? <Activity className="w-3 h-3 text-amber-500 animate-pulse" /> : <MousePointer2 className="w-3 h-3" />}
                 <span>Estatísticas</span>
              </div>
              <div className="text-[10px] text-slate-400 space-y-1">
                 <p>• Visíveis: {visibleTables.length}</p>
                 <p className="capitalize">• Detalhe: {lodLevel}</p>
                 <p>• Zoom: {(scale * 100).toFixed(0)}%</p>
                 {selectedRelationship && <p className="text-amber-500 font-bold">• Foco em Relacionamento</p>}
              </div>
           </div>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 rounded-lg shadow-md transition-colors border border-slate-200 dark:border-slate-700 minimap-ignore">
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
             }}
             className={`relative w-full h-full ${isInteracting ? '' : 'transition-transform duration-200 ease-out'}`}
          >
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={selectedRelationship || hoveredColumn ? "#f59e0b" : "#6366f1"} />
                  </marker>
               </defs>
               {connections}
             </svg>

             {visibleTables.map(table => {
                const pos = positions[table.name];
                if (!pos) return null;
                
                const isTableHovered = hoveredNode === table.name;
                const isRelated = !hoveredNode || hoveredNode === table.name || relationshipGraph[hoveredNode]?.has(table.name);
                const displayLOD = isTableHovered || selectedRelationship ? 'high' : lodLevel;
                
                // Opacity Logic
                let opacity = 1;
                if (selectedRelationship) {
                   // Focus Mode: Only selected source/target are fully visible
                   const isSelected = table.name === selectedRelationship.source || table.name === selectedRelationship.target;
                   opacity = isSelected ? 1 : 0.05;
                } else {
                   // Standard Hover Mode
                   opacity = isRelated ? 1 : 0.2;
                   
                   // Hover Column specific dimming
                   if (hoveredColumn) {
                      const isSource = hoveredColumn.table === table.name;
                      let isTarget = false;
                      if (hoveredColumn.isPk) {
                         isTarget = table.columns.some(c => c.references?.includes(hoveredColumn.table));
                      } else {
                         const refParts = hoveredColumn.ref?.split('.') || [];
                         const targetTable = refParts.length === 3 ? refParts[1] : refParts[0];
                         isTarget = table.name === targetTable;
                      }
                      if (!isSource && !isTarget) opacity = 0.1;
                      else opacity = 1;
                   }
                }

                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      onMouseEnter={() => !isInteracting && setHoveredNode(table.name)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onContextMenu={(e) => handleContextMenu(e, table.name)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                         opacity,
                         zIndex: isTableHovered || opacity === 1 ? 50 : 10,
                         pointerEvents: opacity < 0.2 ? 'none' : 'auto'
                      }}
                      className={`absolute rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200
                         ${lodLevel === 'low' && !isTableHovered && !selectedRelationship ? 'bg-indigo-200 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 h-10 flex items-center justify-center' : 'bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700'}
                         ${isTableHovered || (selectedRelationship && opacity === 1) ? 'border-indigo-500 ring-2 ring-indigo-500 shadow-xl scale-105' : ''}
                      `}
                   >
                      {lodLevel === 'low' && !isTableHovered && !selectedRelationship ? (
                         <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate px-2">{table.name}</span>
                      ) : (
                         <>
                            <div className={`
                               flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 h-[42px]
                               ${debouncedTerm ? 'bg-indigo-50 dark:bg-indigo-900/50' : 'bg-slate-50 dark:bg-slate-900/50'}
                            `}>
                               <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={table.name}>{table.name}</span>
                               <span className="text-[9px] text-slate-400">{table.schema}</span>
                            </div>
                            
                            {displayLOD === 'high' && (
                               <div className="py-1">
                                  {table.columns.slice(0, 15).map(col => {
                                     let colBgClass = 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
                                     let colTextClass = 'text-slate-600 dark:text-slate-400';
                                     let showBadge = false;
                                     
                                     // Highlight Logic for Selected Relationship
                                     if (selectedRelationship) {
                                        if (table.name === selectedRelationship.source && col.name === selectedRelationship.colName) {
                                            colBgClass = 'bg-emerald-100 dark:bg-emerald-900/40';
                                            colTextClass = 'text-emerald-800 dark:text-emerald-200 font-bold';
                                            showBadge = true;
                                        } else if (table.name === selectedRelationship.target && col.name === selectedRelationship.targetColName) {
                                            colBgClass = 'bg-amber-100 dark:bg-amber-900/40';
                                            colTextClass = 'text-amber-800 dark:text-amber-200 font-bold';
                                            showBadge = true;
                                        }
                                     } else if (hoveredColumn) {
                                        if (hoveredColumn.table === table.name && hoveredColumn.col === col.name) {
                                           colBgClass = 'bg-yellow-100 dark:bg-yellow-900/30';
                                           colTextClass = 'text-slate-900 dark:text-white font-bold';
                                        } else if (hoveredColumn.isPk && col.isForeignKey && col.references?.includes(hoveredColumn.table)) {
                                           colBgClass = 'bg-emerald-100 dark:bg-emerald-900/30';
                                           colTextClass = 'text-emerald-800 dark:text-emerald-200 font-bold';
                                           showBadge = true;
                                        } else if (!hoveredColumn.isPk && hoveredColumn.ref && col.isPrimaryKey) {
                                           const refParts = hoveredColumn.ref.split('.');
                                           const targetTable = refParts.length === 3 ? refParts[1] : refParts[0];
                                           if (targetTable === table.name) {
                                              colBgClass = 'bg-amber-100 dark:bg-amber-900/30';
                                              colTextClass = 'text-amber-800 dark:text-amber-200 font-bold';
                                              showBadge = true;
                                           }
                                        }
                                     }

                                     return (
                                       <div 
                                          key={col.name} 
                                          className={`px-3 flex items-center justify-between text-[11px] cursor-pointer transition-colors h-[28px] ${colBgClass}`}
                                          onMouseEnter={(e) => {
                                             if (selectedRelationship) return;
                                             e.stopPropagation();
                                             setHoveredColumn({ table: table.name, col: col.name, isPk: !!col.isPrimaryKey, ref: col.references });
                                          }}
                                          onMouseLeave={() => setHoveredColumn(null)}
                                       >
                                          <div className={`flex items-center gap-1.5 overflow-hidden ${colTextClass}`}>
                                             {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0" />}
                                             {col.isForeignKey && <Link className="w-3 h-3 text-blue-500 shrink-0" />}
                                             <span className="truncate">{col.name}</span>
                                          </div>
                                          {showBadge ? (
                                             <span className="flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide">
                                                {(col.isPrimaryKey || (selectedRelationship && table.name === selectedRelationship.target)) ? <Target className="w-2.5 h-2.5" /> : <CornerDownRight className="w-2.5 h-2.5" />}
                                             </span>
                                          ) : (
                                             <span className="text-slate-300 font-mono text-[9px]">{col.type.split('(')[0]}</span>
                                          )}
                                       </div>
                                     );
                                  })}
                                  {table.columns.length > 15 && <div className="px-3 py-1 text-[9px] text-slate-400 italic">...mais {table.columns.length - 15}</div>}
                               </div>
                            )}

                            {displayLOD === 'medium' && (
                               <div className="px-3 py-2 text-[10px] text-slate-400 flex justify-between">
                                  <span>{table.columns.length} cols</span>
                                  {table.columns.some(c => c.isPrimaryKey) && <span className="text-amber-500 flex items-center gap-0.5"><Key className="w-2.5 h-2.5" /> PK</span>}
                               </div>
                            )}
                         </>
                      )}
                   </div>
                );
             })}
          </div>
        </div>
        
        {/* Context Menu */}
        {contextMenu && (
           <div 
              style={{ top: contextMenu.y, left: contextMenu.x }}
              className="fixed z-[80] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[150px] animate-in fade-in zoom-in-95 duration-100 origin-top-left"
              onClick={(e) => e.stopPropagation()}
           >
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/50 mb-1">
                 <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{contextMenu.tableName}</span>
              </div>
              <button onClick={() => handleContextMenuAction('focus')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                 <Eye className="w-3 h-3 text-indigo-500" /> Focar nesta tabela
              </button>
              <button onClick={() => handleContextMenuAction('copy')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                 <Copy className="w-3 h-3 text-slate-400" /> Copiar Nome
              </button>
              {inputValue === contextMenu.tableName && (
                 <button onClick={() => handleContextMenuAction('reset')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/50 mt-1 pt-1">
                    <TableIcon className="w-3 h-3 text-slate-400" /> Limpar Filtro
                 </button>
              )}
           </div>
        )}

        {/* MINIMAP */}
        <div className="minimap-ignore">
            <Minimap 
               positions={positions} 
               visibleTables={visibleTables} 
               containerSize={containerSize} 
               pan={pan} 
               scale={scale} 
               tables={schema.tables}
            />
        </div>
      </div>
    </div>
  );
};

export default SchemaDiagramModal;
