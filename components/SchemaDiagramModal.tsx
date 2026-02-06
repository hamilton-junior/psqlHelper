
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { DatabaseSchema, Table, VirtualRelation, DbCredentials } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, Loader2, Search, Key, Link, Target, CornerDownRight, Copy, Eye, Download, Map as MapIcon, Palette, FileCode, Upload, Save, Trash2, Tag, Filter, Eraser, Route, PlayCircle, StopCircle, ArrowRight, ChevronDown, ChevronUp, Sparkles, CheckCircle2, ListFilter } from 'lucide-react';
import html2canvas from 'html2canvas';
import IntersectionValidatorModal from './IntersectionValidatorModal';

interface SchemaDiagramModalProps {
  schema: DatabaseSchema;
  onClose: () => void;
  onAddVirtualRelation?: (rel: VirtualRelation) => void;
  credentials?: DbCredentials | null;
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
  tableId: string;
  columnName?: string;
}

const TABLE_WIDTH = 250; 
const HEADER_HEIGHT = 44; 
const ROW_HEIGHT = 30;    
const COL_SPACING = 280;
const ROW_SPACING_GAP = 100;

const getTableId = (t: any) => `${t.schema || 'public'}.${t.name}`;

const TABLE_COLORS = [
  { id: 'default', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/50', border: 'border-slate-200', text: 'text-slate-700' },
  { id: 'red', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/30', border: 'border-red-200', text: 'text-red-800' },
  { id: 'orange', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/30', border: 'border-orange-200', text: 'text-orange-800' },
  { id: 'amber', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/30', border: 'border-amber-200', text: 'text-amber-800' },
  { id: 'green', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-900/30', border: 'border-emerald-200', text: 'text-emerald-800' },
  { id: 'blue', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-900/30', border: 'border-blue-200', text: 'text-blue-800' },
  { id: 'indigo', bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-900/30', border: 'border-indigo-200', text: 'text-indigo-800' },
  { id: 'violet', bg: 'bg-violet-50', darkBg: 'dark:bg-violet-900/30', border: 'border-violet-200', text: 'text-violet-800' },
];

const generateDDL = (t: Table) => {
   let sql = `-- Tabela: ${t.schema}.${t.name}\n`;
   sql += `CREATE TABLE ${t.schema}.${t.name} (\n`;
   const cols = t.columns.map(c => {
      let line = `  ${c.name} ${c.type}`;
      if (c.isPrimaryKey) line += ' PRIMARY KEY';
      return line;
   });
   sql += cols.join(',\n');
   sql += `\n);\n\n`;
   if (t.description) {
      sql += `COMMENT ON TABLE ${t.schema}.${t.name} IS '${t.description.replace(/'/g, "''")}';\n`;
   }
   return sql;
};

const CanvasMinimap = memo(({ 
   positions, 
   bounds,
   pan, 
   scale,
   containerSize,
   tableColors
}: { 
   positions: Record<string, NodePosition>, 
   bounds: { minX: number, minY: number, maxX: number, maxY: number, w: number, h: number },
   pan: {x: number, y: number},
   scale: number,
   containerSize: {w: number, h: number},
   tableColors: Record<string, string>
}) => {
   const canvasRef = useRef<HTMLCanvasElement>(null);

   useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const mapWidth = 200;
      const mapScale = mapWidth / Math.max(bounds.w, 1); 
      const mapHeight = Math.max(bounds.h * mapScale, 50);

      canvas.width = mapWidth;
      canvas.height = mapHeight;

      ctx.clearRect(0, 0, mapWidth, mapHeight);
      
      Object.entries(positions).forEach(([tableId, pos]) => {
         const x = (pos.x - bounds.minX) * mapScale;
         const y = (pos.y - bounds.minY) * mapScale;
         const w = TABLE_WIDTH * mapScale;
         const h = (HEADER_HEIGHT + 20) * mapScale;

         const colorId = tableColors[tableId] || 'default';
         ctx.fillStyle = colorId === 'red' ? '#f87171' : 
                         colorId === 'blue' ? '#60a5fa' : 
                         colorId === 'green' ? '#34d399' : '#94a3b8';
         ctx.fillRect(x, y, w, h);
      });

      const viewportX = (-pan.x / scale - bounds.minX) * mapScale;
      const viewportY = (-pan.y / scale - bounds.minY) * mapScale;
      const viewportW = (containerSize.w / scale) * mapScale;
      const viewportH = (containerSize.h / scale) * mapScale;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
      ctx.fillRect(viewportX, viewportY, viewportW, viewportH);
   }, [positions, bounds, pan, scale, containerSize, tableColors]);

   return (
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl overflow-hidden z-[60] backdrop-blur opacity-80 hover:opacity-100 transition-opacity">
         <canvas ref={canvasRef} className="block cursor-pointer" />
         <div className="px-2 py-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1">
             <MapIcon className="w-3 h-3" /> Minimap ({Object.keys(positions).length})
         </div>
      </div>
   );
});

const DiagramNode = memo(({
  table, pos, lodLevel, isHovered, opacity, isSelected, ringClass, 
  tableColors, columnColors, hasTags, searchTerm, searchColumns,
  onMouseDown, onMouseEnter, onMouseLeave, onContextMenu, onDoubleClick, onClearTableColor,
  onColumnEnter, onColumnLeave, onColumnClick, selectedColumn, secondSelectedColumn,
  isNodeSelected
}: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tableId = getTableId(table);
  const colorId = tableColors[tableId] || 'default';
  const style = TABLE_COLORS.find(c => c.id === colorId) || TABLE_COLORS[0];
  
  const nodeStyle = useMemo(() => ({
     transform: `translate(${pos?.x || 0}px, ${pos?.y || 0}px)`,
     width: TABLE_WIDTH,
     opacity,
     zIndex: isHovered || isNodeSelected || opacity === 1 || isExpanded ? 50 : 10,
     pointerEvents: opacity < 0.2 ? 'none' : 'auto' as any,
     display: pos ? 'flex' : 'none'
  }), [pos, opacity, isHovered, isExpanded, isNodeSelected]);

  const displayLimit = lodLevel === 'medium' ? 5 : 10;
  const visibleColumns = isExpanded ? table.columns : table.columns.slice(0, displayLimit);
  const hiddenCount = table.columns.length - displayLimit;

  if (!pos) return null;

  return (
     <div
        onMouseDown={(e) => onMouseDown(e, tableId)}
        onMouseEnter={() => onMouseEnter(tableId)}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => onContextMenu(e, tableId)}
        onDoubleClick={(e) => onDoubleClick(e, tableId)}
        style={nodeStyle}
        className={`absolute flex flex-col rounded-xl transition-all duration-200
           ${lodLevel === 'low' && !isHovered && !isSelected && !isNodeSelected
              ? 'bg-indigo-100 dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 h-10 items-center justify-center shadow-sm' 
              : 'bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700'}
           ${ringClass}
           ${isSelected || isNodeSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 shadow-2xl scale-[1.02] z-50' : ''}
        `}
     >
        {lodLevel === 'low' && !isHovered && !isSelected && !isNodeSelected ? (
           <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate px-2">{table.name}</span>
        ) : (
           <>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 relative group/header rounded-t-xl
                  ${isNodeSelected ? 'bg-indigo-600 text-white border-indigo-700' : `${style.bg} ${style.darkBg} ${style.border}`}
              `}>
                 <div className="flex flex-col min-w-0">
                    <span className={`font-bold text-sm truncate leading-tight ${isNodeSelected ? 'text-white' : style.text}`} title={table.name}>{table.name}</span>
                    <span className={`text-[10px] opacity-70 truncate ${isNodeSelected ? 'text-indigo-100' : style.text}`}>{table.schema}</span>
                 </div>
                 <div className="flex items-center gap-1">
                    {hasTags && (
                       <button onClick={(e) => { e.stopPropagation(); onClearTableColor(tableId); }} className="p-1 opacity-0 group-hover/header:opacity-100 hover:text-red-500 transition-colors bg-white/50 dark:bg-black/20 rounded">
                         <Eraser className="w-3 h-3" />
                       </button>
                    )}
                 </div>
              </div>
              
              {(lodLevel === 'high' || lodLevel === 'medium' || isExpanded) && (
                 <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-b-xl overflow-hidden flex flex-col">
                    <div className={`flex flex-col ${isExpanded ? 'max-h-[300px] overflow-y-auto custom-scrollbar' : 'py-1'}`}>
                        {visibleColumns.map((col: any) => {
                           const colKey = `${tableId}.${col.name}`;
                           const isSelectedCol = selectedColumn?.tableId === tableId && selectedColumn?.col === col.name;
                           const isSecondSelectedCol = secondSelectedColumn?.tableId === tableId && secondSelectedColumn?.col === col.name;
                           const colColorId = columnColors[colKey];
                           const colStyle = colColorId ? TABLE_COLORS.find(c => c.id === colColorId) : null;
                           const isKey = col.isPrimaryKey || col.isForeignKey;
                           
                           const isMatch = searchColumns && searchTerm && col.name.toLowerCase().includes(searchTerm.toLowerCase());

                           return (
                             <div key={col.name} className={`px-4 flex items-center justify-between text-xs h-[30px] transition-all border-b border-transparent hover:border-slate-100 dark:hover:border-slate-700 cursor-pointer
                                   ${isSelectedCol ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-inset ring-indigo-500 font-bold shadow-inner' : ''}
                                   ${isSecondSelectedCol ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-inset ring-emerald-500 font-bold shadow-inner' : ''}
                                   ${isMatch && !isSelectedCol && !isSecondSelectedCol ? 'bg-yellow-50 dark:bg-yellow-900/20' : colStyle ? colStyle.bg : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                                   ${isKey && !isSelectedCol && !isSecondSelectedCol && !isMatch ? 'bg-slate-50/50 dark:bg-slate-800/80' : ''}
                                `}
                                onContextMenu={(e) => onContextMenu(e, tableId, col.name)}
                                onMouseEnter={() => onColumnEnter(tableId, col.name, col.references)}
                                onMouseLeave={onColumnLeave}
                                onClick={(e) => { e.stopPropagation(); onColumnClick(tableId, col.name, col.references); }}
                             >
                                <div className="flex items-center gap-2 overflow-hidden text-slate-700 dark:text-slate-300">
                                   <div className="w-3.5 flex justify-center shrink-0">
                                      {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 fill-amber-500/20" />}
                                      {col.isForeignKey && <Link className="w-3 h-3 text-blue-500" />}
                                   </div>
                                   <span className={`truncate font-mono ${isKey ? 'font-semibold' : ''} ${isMatch ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''}`} title={col.name}>{col.name}</span>
                                </div>
                                <div className="flex items-center gap-1 pl-2">
                                   {(isSelectedCol || isSecondSelectedCol) && <CheckCircle2 className={`w-3 h-3 ${isSelectedCol ? 'text-indigo-500' : 'text-emerald-500'}`} />}
                                   <span className="text-slate-400 dark:text-slate-500 text-[10px] truncate max-w-[60px] text-right" title={col.type}>{col.type.split('(')[0].toLowerCase()}</span>
                                </div>
                             </div>
                           );
                        })}
                    </div>
                    {(table.columns.length > displayLimit) && (
                       <div className="px-4 py-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-1 border-t border-slate-100 dark:border-slate-700"
                          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                       >
                          {isExpanded ? <><ChevronUp className="w-3 h-3" /> Recolher</> : <><ChevronDown className="w-3 h-3" /> Ver mais {hiddenCount} campos</>}
                       </div>
                    )}
                 </div>
              )}
           </>
        )}
     </div>
  );
});

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose, onAddVirtualRelation, credentials }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ 
     w: typeof window !== 'undefined' ? window.innerWidth : 1000, 
     h: typeof window !== 'undefined' ? window.innerHeight : 800 
  });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const interactionTimeout = useRef<any>(null);
  const interactionStartRef = useRef<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [searchColumns, setSearchColumns] = useState(false); 
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<HoveredColumnState | null>(null);
  const [secondSelectedColumn, setSecondSelectedColumn] = useState<HoveredColumnState | null>(null);
  const [showValidator, setShowValidator] = useState(false);

  const [selectedRelationship, setSelectedRelationship] = useState<SelectedRelationship | null>(null);
  const [tableColors, setTableColors] = useState<Record<string, string>>({});
  const [columnColors, setColumnColors] = useState<Record<string, string>>({}); 
  const [activeColorFilter, setActiveColorFilter] = useState<string | null>(null);
  const [pathMode, setPathMode] = useState(false);
  const [pathStartNodeId, setPathStartNodeId] = useState<string | null>(null);
  const [pathEndNodeId, setPathEndNodeId] = useState<string | null>(null);
  const [foundPathIds, setFoundPathIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewingDDL, setViewingDDL] = useState<Table | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const logDiagram = (msg: string, data?: any) => console.log(`[DIAGRAM] ${msg}`, data || '');

  const relationshipGraph = useMemo(() => {
    logDiagram('Calculando grafo de relacionamentos...');
    const adj: Record<string, Set<string>> = {};
    schema.tables.forEach(t => {
       const tId = getTableId(t);
       if (!adj[tId]) adj[tId] = new Set();
       t.columns.forEach(c => {
          if (c.isForeignKey && c.references) {
             const parts = c.references.split('.'); 
             let targetTableId = '';
             
             if (parts.length === 3) targetTableId = `${parts[0]}.${parts[1]}`;
             else if (parts.length === 2) targetTableId = `public.${parts[0]}`;
             
             if (targetTableId) {
                if (!adj[tId]) adj[tId] = new Set();
                if (!adj[targetTableId]) adj[targetTableId] = new Set();
                adj[tId].add(targetTableId);
                adj[targetTableId].add(tId);
             }
          }
       });
    });
    return adj;
  }, [schema.tables]);

  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      let currentX = 50;
      let currentY = 50;
      let maxHeightInRow = 0;
      tablesToLayout.forEach((table, index) => {
        const tableId = getTableId(table);
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 12) * ROW_HEIGHT) + 20;
        newPositions[tableId] = { x: currentX, y: currentY };
        maxHeightInRow = Math.max(maxHeightInRow, tableHeight);
        currentX += COL_SPACING;
        if ((index + 1) % cols === 0) {
           currentX = 50;
           currentY += maxHeightInRow + ROW_SPACING_GAP;
           maxHeightInRow = 0;
        }
      });
      return newPositions;
  }, []);

  useEffect(() => {
    setIsLayoutReady(false);
    logDiagram('Inicializando layout...');
    setTimeout(() => {
      let tablesToRender = schema.tables;
      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => {
          const tableMatch = t.name.toLowerCase().includes(term);
          const columnMatch = searchColumns && t.columns.some(c => c.name.toLowerCase().includes(term));
          return tableMatch || columnMatch;
        });
        
        tablesToRender = [...tablesToRender].sort((a, b) => {
           const nameA = a.name.toLowerCase();
           const nameB = b.name.toLowerCase();
           if (nameA === term && nameB !== term) return -1;
           if (nameB === term && nameA !== term) return 1;
           if (nameA.startsWith(term) && !nameB.startsWith(term)) return -1;
           if (nameB.startsWith(term) && !nameA.startsWith(term)) return 1;
           return nameA.localeCompare(nameB);
        });

      } else if (activeColorFilter) {
         tablesToRender = schema.tables.filter(t => tableColors[getTableId(t)] === activeColorFilter);
      }
      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      if (debouncedTerm.trim() && tablesToRender.length > 0) {
         setPan({ x: 100, y: 100 });
         setScale(1);
      }
      setIsLayoutReady(true);
    }, 10);
  }, [schema.tables, debouncedTerm, searchColumns, activeColorFilter, calculateLayout]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(inputValue), 400); 
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
       for (const entry of entries) {
          setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
       }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const { visibleTables, bounds } = useMemo(() => {
     if (!isLayoutReady) return { visibleTables: [], bounds: {minX:0, maxX:0, minY:0, maxY:0, w:0, h:0} };
     const allKeys = Object.keys(positions);
     let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
     allKeys.forEach(k => {
        const p = positions[k];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
     });
     if (allKeys.length === 0) {
        minX = minY = maxX = maxY = 0;
     } else {
        maxX += TABLE_WIDTH;
        maxY += 500;
     }
     const vpX = -pan.x / scale;
     const vpY = -pan.y / scale;
     const vpW = containerSize.w / scale;
     const vpH = containerSize.h / scale;
     const buffer = 1000 / scale; 
     const visible = schema.tables.filter(t => {
        const tId = getTableId(t);
        const pos = positions[tId];
        if (!pos) return false;
        if (pos.x > vpX + vpW + buffer) return false; 
        if (pos.x + TABLE_WIDTH < vpX - buffer) return false; 
        if (pos.y > vpY + vpH + buffer) return false; 
        if (pos.y + 600 < vpY - buffer) return false; 
        return true;
     });
     return { visibleTables: visible, bounds: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY } };
  }, [positions, pan, scale, containerSize, schema.tables, isLayoutReady]);

  const triggerInteraction = useCallback(() => {
     if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
     interactionTimeout.current = setTimeout(() => {
         setIsInteracting(false);
         if (interactionStartRef.current) {
             clearTimeout(interactionStartRef.current);
             interactionStartRef.current = null;
         }
     }, 300);
     if (!isInteracting && !interactionStartRef.current) {
         interactionStartRef.current = setTimeout(() => {
             setIsInteracting(true);
             interactionStartRef.current = null;
         }, 150); 
     }
  }, [isInteracting]);

  const handleMouseDown = (e: React.MouseEvent, tableId?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setContextMenu(null);
    if (pathMode && tableId) {
       if (!pathStartNodeId) setPathStartNodeId(tableId);
       else if (!pathEndNodeId) setPathEndNodeId(tableId);
       else { setPathStartNodeId(tableId); setPathEndNodeId(null); }
       return;
    }
    if (!tableId) {
       setSelectedRelationship(null);
       setSelectedColumn(null); 
       setSecondSelectedColumn(null);
       setSelectedNodeId(null);
    } else {
       setSelectedNodeId(tableId);
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableId) setDraggedNodeId(tableId);
    else setIsDraggingCanvas(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas && !draggedNodeId) return;
    triggerInteraction(); 
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (draggedNodeId) {
      setPositions(prev => ({
        ...prev,
        [draggedNodeId]: { x: prev[draggedNodeId].x + dx / scale, y: prev[draggedNodeId].y + dy / scale }
      }));
    } else if (isDraggingCanvas) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
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

  const handleColumnEnter = useCallback((tableId: string, col: string, ref?: string) => {
     if (!isInteracting) setHoveredColumn({ table: tableId, col, isPk: false, ref });
  }, [isInteracting]);

  const handleColumnLeave = useCallback(() => {
     setHoveredColumn(null);
  }, []);

  const handleColumnClick = useCallback((tableId: string, col: string, ref?: string) => {
     const target = { table: tableId, col, isPk: false, ref };
     if (selectedColumn?.table === tableId && selectedColumn?.col === col) {
        setSelectedColumn(null);
     } else if (secondSelectedColumn?.table === tableId && secondSelectedColumn?.col === col) {
        setSecondSelectedColumn(null);
     } else if (!selectedColumn) {
        setSelectedColumn(target);
     } else if (!secondSelectedColumn) {
        setSecondSelectedColumn(target);
     } else {
        setSelectedColumn(secondSelectedColumn);
        setSecondSelectedColumn(target);
     }
  }, [selectedColumn, secondSelectedColumn]);

  const lodLevel = useMemo(() => {
    if (isInteracting) return scale < 0.6 ? 'low' : 'medium';
    if (scale < 0.4) return 'low';
    if (scale < 0.7) return 'medium';
    return 'high';
  }, [scale, isInteracting]);

  useEffect(() => {
     if (pathStartNodeId && pathEndNodeId) {
        const queue: string[][] = [[pathStartNodeId]];
        const visited = new Set<string>();
        visited.add(pathStartNodeId);
        let pathFound: string[] = [];
        while (queue.length > 0) {
           const path = queue.shift()!;
           const node = path[path.length - 1];
           if (node === pathEndNodeId) { pathFound = path; break; }
           const neighbors = relationshipGraph[node];
           if (neighbors) {
              for (const neighbor of neighbors) {
                 if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                 }
              }
           }
        }
        setFoundPathIds(pathFound);
     } else {
        setFoundPathIds([]);
     }
  }, [pathStartNodeId, pathEndNodeId, relationshipGraph]);

  const connections = useMemo(() => {
    const activeColumn = selectedColumn || hoveredColumn;
    const isGlobalInteraction = hoveredNodeId || selectedNodeId || selectedRelationship || pathMode || activeColumn;

    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => getTableId(t)));
    
    schema.tables.forEach(table => {
      const tableId = getTableId(table);
      const startPos = positions[tableId];
      if (!startPos) return;

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          let targetTableId = '';
          let targetColName = '';
          
          if (parts.length === 3) {
             targetTableId = `${parts[0]}.${parts[1]}`;
             targetColName = parts[2];
          } else {
             targetTableId = `public.${parts[0]}`;
             targetColName = parts[1];
          }
          
          const endPos = positions[targetTableId];
          if (!endPos) return;

          if (!visibleSet.has(tableId) && !visibleSet.has(targetTableId) && !isGlobalInteraction) return;

          let isPathLine = false;
          let isHighlighted = false;
          let isExplicitlySelected = false; 

          if (pathMode) {
             const srcIdx = foundPathIds.indexOf(tableId);
             const tgtIdx = foundPathIds.indexOf(targetTableId);
             if (srcIdx !== -1 && tgtIdx !== -1 && Math.abs(srcIdx - tgtIdx) === 1) isPathLine = true;
          } else if (selectedRelationship) {
             if (tableId === selectedRelationship.source && col.name === selectedRelationship.colName && targetTableId === selectedRelationship.target) {
                isExplicitlySelected = true;
                isHighlighted = true;
             }
          } else if (activeColumn) {
             if (activeColumn.table === tableId && activeColumn.col === col.name) isHighlighted = true;
             else if (activeColumn.table === targetTableId && activeColumn.col === targetColName) isHighlighted = true;
          } else if (hoveredNodeId || selectedNodeId) {
             if (tableId === hoveredNodeId || targetTableId === hoveredNodeId || 
                 tableId === selectedNodeId || targetTableId === selectedNodeId) isHighlighted = true;
          }

          const isDimmed = isGlobalInteraction && !isHighlighted && !isPathLine && !isExplicitlySelected;

          const sourceY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          let targetY = endPos.y + 20; 
          
          const targetTbl = schema.tables.find(t => getTableId(t) === targetTableId);
          if (targetTbl) {
            const tColIdx = targetTbl.columns.findIndex(c => c.name === targetColName);
            if (tColIdx >= 0) targetY = endPos.y + HEADER_HEIGHT + (tColIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          }

          const isRight = endPos.x > startPos.x + TABLE_WIDTH;
          const sx = isRight ? startPos.x + TABLE_WIDTH : startPos.x;
          const ex = isRight ? endPos.x : endPos.x + TABLE_WIDTH;
          
          const midX = (sx + ex) / 2;
          const pathD = `M ${sx} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${ex} ${targetY}`;
          
          let stroke = isHighlighted || isPathLine ? "#6366f1" : "#94a3b8";
          if (isPathLine) stroke = "#06b6d4";
          if (isExplicitlySelected) stroke = "#f59e0b";
          
          let width = isHighlighted || isPathLine ? 3 : 1;
          let opacity = isDimmed ? 0.05 : (isHighlighted || isPathLine ? 1 : 0.4);
          
          let markerEnd = "url(#arrowhead)";
          if (isExplicitlySelected) markerEnd = "url(#arrowhead-fixed)";
          else if (isHighlighted || isPathLine) markerEnd = "url(#arrowhead-selected)";

          lines.push(
             <g key={`${tableId}-${col.name}-${targetTableId}`} className="transition-all duration-300">
                <path d={pathD} stroke="transparent" strokeWidth={15} fill="none" className="cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedRelationship({ source: tableId, target: targetTableId, colName: col.name, targetColName: targetColName }); }} />
                
                <path 
                  d={pathD} 
                  stroke={stroke} 
                  strokeWidth={width} 
                  fill="none" 
                  opacity={opacity} 
                  className="transition-all duration-300" 
                  markerEnd={markerEnd} 
                />

                {(isHighlighted || isPathLine) && !isInteracting && (
                  <path
                    d={pathD}
                    stroke="white"
                    strokeWidth={width / 2}
                    fill="none"
                    strokeDasharray="5, 15"
                    className="animate-marching-ants"
                  />
                )}
             </g>
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, hoveredNodeId, selectedNodeId, hoveredColumn, selectedColumn, selectedRelationship, pathMode, foundPathIds, schema.tables, relationshipGraph]);

  const handleSaveLayout = () => {
    const layout = { name: schema.name, positions, tableColors, columnColors, timestamp: Date.now() };
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `layout_${schema.name}.json`;
    link.click();
  };

  const handleExportImage = async () => {
     if (!containerRef.current) return;
     try {
        const canvas = await html2canvas(containerRef.current, { backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f1f5f9', ignoreElements: (el) => el.classList.contains('minimap-ignore') });
        const link = document.createElement('a');
        link.download = `schema_${schema.name}.png`;
        link.href = canvas.toDataURL();
        link.click();
     } catch (e) { alert("Erro ao exportar imagem."); }
  };

  const handleAddRelation = (rel: VirtualRelation) => {
     if (onAddVirtualRelation) onAddVirtualRelation(rel);
     setSelectedColumn(null);
     setSecondSelectedColumn(null);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <style>{`
        @keyframes marching-ants {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        .animate-marching-ants {
          animation: marching-ants 0.8s linear infinite;
        }
      `}</style>

      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        
        {showValidator && selectedColumn && secondSelectedColumn && (
           <IntersectionValidatorModal 
              tableA={selectedColumn.table}
              columnA={selectedColumn.col}
              tableB={secondSelectedColumn.table}
              columnB={secondSelectedColumn.col}
              credentials={credentials || null}
              onClose={() => setShowValidator(false)}
              onCreateRelation={handleAddRelation}
           />
        )}

        {!isLayoutReady && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Processando {schema.tables.length} tabelas...</p>
           </div>
        )}

        {(selectedColumn || secondSelectedColumn) && !showValidator && (
           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-2">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedColumn ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
                 <div className="min-w-[80px]">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Coluna A</div>
                    <div className="text-xs font-mono truncate max-w-[100px]">{selectedColumn?.col || '---'}</div>
                 </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
              <div className="flex items-center gap-2">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${secondSelectedColumn ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
                 <div className="min-w-[80px]">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Coluna B</div>
                    <div className="text-xs font-mono truncate max-w-[100px]">{secondSelectedColumn?.col || '---'}</div>
                 </div>
              </div>
              
              {selectedColumn && secondSelectedColumn ? (
                 <button 
                    onClick={() => setShowValidator(true)}
                    className="ml-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
                 >
                    <Sparkles className="w-3.5 h-3.5" /> Validar Interseção
                 </button>
              ) : (
                 <span className="ml-2 text-[10px] text-slate-400 italic">Selecione outra coluna para validar</span>
              )}
              
              <button onClick={() => { setSelectedColumn(null); setSecondSelectedColumn(null); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                 <X className="w-4 h-4" />
              </button>
           </div>
        )}

        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none minimap-ignore">
           <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex gap-1 pointer-events-auto">
              <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomIn className="w-5 h-5" /></button>
              <button onClick={() => setScale(s => Math.max(s - 0.1, 0.05))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Maximize className="w-5 h-5" /></button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
              <button onClick={handleSaveLayout} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Save className="w-5 h-5" /></button>
              <button onClick={handleExportImage} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"><Download className="w-5 h-5" /></button>
           </div>
           
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 pointer-events-auto w-64 space-y-2">
              <div className="flex items-center gap-2">
                 <Search className="w-4 h-4 text-slate-400" />
                 <input type="text" placeholder="Buscar no schema..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full" />
                 {inputValue && <button onClick={() => setInputValue('')}><X className="w-3 h-3 text-slate-400" /></button>}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Buscar em Colunas</span>
                 <label className="relative inline-flex items-center cursor-pointer scale-75 origin-right">
                    <input type="checkbox" checked={searchColumns} onChange={e => setSearchColumns(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                 </label>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 pointer-events-auto w-64">
              <button onClick={() => { setPathMode(!pathMode); setFoundPathIds([]); setPathStartNodeId(null); setPathEndNodeId(null); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold w-full transition-colors ${pathMode ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}><Route className="w-4 h-4" /> {pathMode ? 'Modo Rota Ativo' : 'Buscar Caminho'}</button>
              {pathMode && <div className="mt-2 text-[10px] text-slate-500 text-center">Clique em duas tabelas para achar a rota.</div>}
           </div>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 bg-white dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-lg shadow-md minimap-ignore"><X className="w-6 h-6" /></button>
        <div ref={containerRef} className="flex-1 overflow-hidden cursor-move bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]" onMouseDown={(e) => handleMouseDown(e)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0', width: '100%', height: '100%' }} className="relative w-full h-full">
             <svg className="absolute inset-0 pointer-events-none overflow-visible w-full h-full" style={{ zIndex: 0 }}>
               <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                  </marker>
                  <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
                  </marker>
                  <marker id="arrowhead-fixed" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                  </marker>
               </defs>
               {connections}
             </svg>
             {visibleTables.map(table => {
                const tId = getTableId(table);
                return (
                  <DiagramNode 
                     key={tId} 
                     table={table} 
                     pos={positions[tId]} 
                     lodLevel={lodLevel} 
                     isHovered={hoveredNodeId === tId} 
                     isSelected={selectedRelationship?.source === tId || selectedRelationship?.target === tId} 
                     isNodeSelected={selectedNodeId === tId}
                     opacity={pathMode && foundPathIds.length > 0 && !foundPathIds.includes(tId) ? 0.1 : 1} 
                     ringClass={pathMode && foundPathIds.includes(tId) ? 'ring-2 ring-cyan-400' : ''} 
                     tableColors={tableColors} 
                     columnColors={columnColors} 
                     hasTags={!!tableColors[tId]} 
                     searchTerm={debouncedTerm}
                     searchColumns={searchColumns}
                     onMouseDown={handleMouseDown} 
                     onMouseEnter={(id: string) => !isInteracting && setHoveredNodeId(id)} 
                     onMouseLeave={() => setHoveredNodeId(null)} 
                     onContextMenu={(e: any, id: string, c?: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tableId: id, columnName: c }); }} 
                     onDoubleClick={(e: any, id: string) => { e.stopPropagation(); setViewingDDL(schema.tables.find(tbl => getTableId(tbl) === id) || null); }} 
                     onClearTableColor={(id: string) => { const nc = {...tableColors}; delete nc[id]; setTableColors(nc); }} 
                     onColumnEnter={handleColumnEnter} 
                     onColumnLeave={handleColumnLeave} 
                     onColumnClick={handleColumnClick} 
                     selectedColumn={selectedColumn} 
                     secondSelectedColumn={secondSelectedColumn}
                  />
                );
             })}
          </div>
        </div>
        {contextMenu && (
           <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-[80] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 min-w-[150px] animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
              <button 
                 onClick={() => { 
                    const table = schema.tables.find(t => getTableId(t) === contextMenu.tableId);
                    if (table) setViewingDDL(table);
                    setContextMenu(null); 
                 }} 
                 className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200 flex items-center gap-2"
              >
                 <FileCode className="w-3.5 h-3.5 text-slate-400" /> Ver DDL (SQL)
              </button>
              <button onClick={() => { const p = positions[contextMenu.tableId]; setPan({ x: (containerSize.w/2) - (p.x * 1.5) - 100, y: (containerSize.h/2) - (p.y * 1.5) }); setScale(1.5); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200 flex items-center gap-2">
                 <Maximize className="w-3.5 h-3.5 text-slate-400" /> Focar Tabela
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <div className="px-3 py-1 text-[9px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1"><Palette className="w-3 h-3" /> Colorir</div>
              <div className="px-3 pb-1 flex gap-1 flex-wrap">
                 {TABLE_COLORS.map(c => (
                    <button key={c.id} onClick={() => { setTableColors(prev => ({ ...prev, [contextMenu.tableId]: c.id })); setContextMenu(null); }} className={`w-5 h-5 rounded-full border border-black/5 dark:border-white/10 ${c.bg.replace('50', '400')}`} title={c.id} />
                 ))}
              </div>
           </div>
        )}
        {viewingDDL && (
           <div className="absolute inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setViewingDDL(null)}>
              <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                 <div className="flex-1 overflow-auto bg-slate-900 p-4"><pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">{generateDDL(viewingDDL)}</pre></div>
                 <button onClick={() => setViewingDDL(null)} className="p-3 bg-slate-800 text-white text-xs w-full text-center hover:bg-slate-700 font-bold uppercase tracking-widest">Fechar</button>
              </div>
           </div>
        )}
        <div className="minimap-ignore">
           <CanvasMinimap positions={positions} bounds={bounds} pan={pan} scale={scale} containerSize={containerSize} tableColors={tableColors} />
        </div>
      </div>
    </div>
  );
};

export default SchemaDiagramModal;
