
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, Loader2, Search, Key, Link, Target, CornerDownRight, Copy, Eye, Download, Map as MapIcon, Palette, FileCode, Upload, Save, Trash2, Tag, Filter, Eraser, Route, PlayCircle, StopCircle, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
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
  columnName?: string;
}

const TABLE_WIDTH = 250; 
const HEADER_HEIGHT = 44; 
const ROW_HEIGHT = 30;    
const COL_SPACING = 280;
const ROW_SPACING_GAP = 100;

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
      
      Object.entries(positions).forEach(([tableName, pos]) => {
         const x = (pos.x - bounds.minX) * mapScale;
         const y = (pos.y - bounds.minY) * mapScale;
         const w = TABLE_WIDTH * mapScale;
         const h = (HEADER_HEIGHT + 20) * mapScale;

         const colorId = tableColors[tableName] || 'default';
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
  tableColors, columnColors, hasTags, 
  onMouseDown, onMouseEnter, onMouseLeave, onContextMenu, onDoubleClick, onClearTableColor,
  onColumnEnter, onColumnLeave, onColumnClick, selectedColumn
}: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorId = tableColors[table.name] || 'default';
  const style = TABLE_COLORS.find(c => c.id === colorId) || TABLE_COLORS[0];
  
  const nodeStyle = useMemo(() => ({
     transform: `translate(${pos.x}px, ${pos.y}px)`,
     width: TABLE_WIDTH,
     opacity,
     zIndex: isHovered || opacity === 1 || isExpanded ? 50 : 10,
     pointerEvents: opacity < 0.2 ? 'none' : 'auto' as any
  }), [pos.x, pos.y, opacity, isHovered, isExpanded]);

  const displayLimit = lodLevel === 'medium' ? 5 : 10;
  const visibleColumns = isExpanded ? table.columns : table.columns.slice(0, displayLimit);
  const hiddenCount = table.columns.length - displayLimit;

  return (
     <div
        onMouseDown={(e) => onMouseDown(e, table.name)}
        onMouseEnter={() => onMouseEnter(table.name)}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => onContextMenu(e, table.name)}
        onDoubleClick={(e) => onDoubleClick(e, table.name)}
        style={nodeStyle}
        className={`absolute flex flex-col rounded-xl transition-all duration-200
           ${lodLevel === 'low' && !isHovered && !isSelected 
              ? 'bg-indigo-100 dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-700 h-10 items-center justify-center shadow-sm' 
              : 'bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700'}
           ${ringClass}
           ${isSelected ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900 shadow-2xl scale-[1.02] z-50' : ''}
        `}
     >
        {lodLevel === 'low' && !isHovered && !isSelected ? (
           <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate px-2">{table.name}</span>
        ) : (
           <>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 relative group/header rounded-t-xl
                  ${style.bg} ${style.darkBg} ${style.border}
              `}>
                 <div className="flex flex-col min-w-0">
                    <span className={`font-bold text-sm truncate leading-tight ${style.text}`} title={table.name}>{table.name}</span>
                    <span className={`text-[10px] opacity-70 truncate ${style.text}`}>{table.schema}</span>
                 </div>
                 <div className="flex items-center gap-1">
                    {hasTags && (
                       <button onClick={(e) => { e.stopPropagation(); onClearTableColor(table.name); }} className="p-1 opacity-0 group-hover/header:opacity-100 hover:text-red-500 transition-colors bg-white/50 dark:bg-black/20 rounded">
                         <Eraser className="w-3 h-3" />
                       </button>
                    )}
                 </div>
              </div>
              
              {(lodLevel === 'high' || lodLevel === 'medium' || isExpanded) && (
                 <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-b-xl overflow-hidden flex flex-col">
                    <div className={`flex flex-col ${isExpanded ? 'max-h-[300px] overflow-y-auto custom-scrollbar' : 'py-1'}`}>
                        {visibleColumns.map((col: any) => {
                           const colKey = `${table.name}.${col.name}`;
                           const isSelectedCol = selectedColumn?.table === table.name && selectedColumn?.col === col.name;
                           const colColorId = columnColors[colKey];
                           const colStyle = colColorId ? TABLE_COLORS.find(c => c.id === colColorId) : null;
                           const isKey = col.isPrimaryKey || col.isForeignKey;
                           
                           return (
                             <div key={col.name} className={`px-4 flex items-center justify-between text-xs h-[30px] transition-colors border-b border-transparent hover:border-slate-100 dark:hover:border-slate-700 cursor-pointer
                                   ${isSelectedCol ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-1 ring-inset ring-indigo-500 font-bold' : ''}
                                   ${colStyle ? colStyle.bg : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}
                                   ${isKey ? 'bg-slate-50/50 dark:bg-slate-800/80' : ''}
                                `}
                                onContextMenu={(e) => onContextMenu(e, table.name, col.name)}
                                onMouseEnter={() => onColumnEnter(table.name, col.name, col.references)}
                                onMouseLeave={onColumnLeave}
                                onClick={(e) => { e.stopPropagation(); onColumnClick(table.name, col.name, col.references); }}
                             >
                                <div className="flex items-center gap-2 overflow-hidden text-slate-700 dark:text-slate-300">
                                   <div className="w-3.5 flex justify-center shrink-0">
                                      {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 fill-amber-500/20" />}
                                      {col.isForeignKey && <Link className="w-3 h-3 text-blue-500" />}
                                   </div>
                                   <span className={`truncate font-mono ${isKey ? 'font-semibold' : ''}`} title={col.name}>{col.name}</span>
                                </div>
                                <div className="flex items-center gap-1 pl-2">
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

const SchemaDiagramModal: React.FC<SchemaDiagramModalProps> = ({ schema, onClose }) => {
  const [positions, setPositions] = useState<Record<string, NodePosition>>({});
  const [scale, setScale] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ 
     w: typeof window !== 'undefined' ? window.innerWidth : 1000, 
     h: typeof window !== 'undefined' ? window.innerHeight : 800 
  });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const interactionTimeout = useRef<any>(null);
  const interactionStartRef = useRef<any>(null);
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<HoveredColumnState | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<SelectedRelationship | null>(null);
  const [tableColors, setTableColors] = useState<Record<string, string>>({});
  const [columnColors, setColumnColors] = useState<Record<string, string>>({}); 
  const [activeColorFilter, setActiveColorFilter] = useState<string | null>(null);
  const [pathMode, setPathMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState<string | null>(null);
  const [pathEndNode, setPathEndNode] = useState<string | null>(null);
  const [foundPath, setFoundPath] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [viewingDDL, setViewingDDL] = useState<Table | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      let currentX = 50;
      let currentY = 50;
      let maxHeightInRow = 0;
      tablesToLayout.forEach((table, index) => {
        const tableHeight = HEADER_HEIGHT + (Math.min(table.columns.length, 12) * ROW_HEIGHT) + 20;
        newPositions[table.name] = { x: currentX, y: currentY };
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
    setTimeout(() => {
      let tablesToRender = schema.tables;
      if (debouncedTerm.trim()) {
        const term = debouncedTerm.toLowerCase();
        tablesToRender = schema.tables.filter(t => t.name.toLowerCase().includes(term));
      } else if (activeColorFilter) {
         tablesToRender = schema.tables.filter(t => tableColors[t.name] === activeColorFilter);
      }
      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      if (debouncedTerm.trim() && tablesToRender.length > 0) {
         setPan({ x: 100, y: 100 });
         setScale(1);
      }
      setIsLayoutReady(true);
    }, 10);
  }, [schema.tables, debouncedTerm, activeColorFilter, calculateLayout]);

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
     maxX += TABLE_WIDTH;
     maxY += 500;
     const vpX = -pan.x / scale;
     const vpY = -pan.y / scale;
     const vpW = containerSize.w / scale;
     const vpH = containerSize.h / scale;
     const buffer = 1000 / scale; 
     const visible = schema.tables.filter(t => {
        const pos = positions[t.name];
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

  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setContextMenu(null);
    if (pathMode && tableName) {
       if (!pathStartNode) setPathStartNode(tableName);
       else if (!pathEndNode) setPathEndNode(tableName);
       else { setPathStartNode(tableName); setPathEndNode(null); }
       return;
    }
    if (!tableName) {
       setSelectedRelationship(null);
       setSelectedColumn(null); 
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) setDraggedNode(tableName);
    else setIsDraggingCanvas(true);
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
        [draggedNode]: { x: prev[draggedNode].x + dx / scale, y: prev[draggedNode].y + dy / scale }
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

  const handleColumnEnter = useCallback((table: string, col: string, ref?: string) => {
     if (!isInteracting) setHoveredColumn({ table, col, isPk: false, ref });
  }, [isInteracting]);

  const handleColumnLeave = useCallback(() => {
     setHoveredColumn(null);
  }, []);

  const handleColumnClick = useCallback((table: string, col: string, ref?: string) => {
     if (selectedColumn?.table === table && selectedColumn?.col === col) {
        setSelectedColumn(null);
     } else {
        setSelectedColumn({ table, col, isPk: false, ref });
     }
  }, [selectedColumn]);

  const lodLevel = useMemo(() => {
    if (isInteracting) return scale < 0.6 ? 'low' : 'medium';
    if (scale < 0.4) return 'low';
    if (scale < 0.7) return 'medium';
    return 'high';
  }, [scale, isInteracting]);

  useEffect(() => {
     if (pathStartNode && pathEndNode) {
        const queue: string[][] = [[pathStartNode]];
        const visited = new Set<string>();
        visited.add(pathStartNode);
        let pathFound: string[] = [];
        while (queue.length > 0) {
           const path = queue.shift()!;
           const node = path[path.length - 1];
           if (node === pathEndNode) { pathFound = path; break; }
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
        setFoundPath(pathFound);
     } else {
        setFoundPath([]);
     }
  }, [pathStartNode, pathEndNode, relationshipGraph]);

  const connections = useMemo(() => {
    const activeColumn = selectedColumn || hoveredColumn;
    if ((isInteracting && visibleTables.length > 30) || scale < 0.4) {
       if (!hoveredNode && !selectedRelationship && !pathMode && !activeColumn) return [];
    }
    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => t.name));
    let sourceTables = visibleTables;
    if (pathMode && foundPath.length > 0) {
       sourceTables = schema.tables.filter(t => foundPath.includes(t.name));
    } else if (selectedRelationship) {
       sourceTables = schema.tables.filter(t => t.name === selectedRelationship.source || t.name === selectedRelationship.target);
    } else if (activeColumn?.ref) {
       sourceTables = schema.tables.filter(t => t.name === activeColumn.table);
    } else if (hoveredNode) {
       sourceTables = schema.tables.filter(t => t.name === hoveredNode || relationshipGraph[hoveredNode]?.has(t.name));
    }

    sourceTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;
      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          const targetTable = parts.length === 3 ? parts[1] : parts[0];
          if (!visibleSet.has(targetTable) && !hoveredNode && !selectedRelationship && !pathMode && !activeColumn) return;
          const endPos = positions[targetTable];
          if (!endPos) return;
          let isPathLine = false;
          let isHighlighted = false;
          let isExplicitlySelected = false; 
          const targetColName = parts.length === 3 ? parts[2] : parts[1];
          if (pathMode) {
             const srcIdx = foundPath.indexOf(table.name);
             const tgtIdx = foundPath.indexOf(targetTable);
             if (srcIdx !== -1 && tgtIdx !== -1 && Math.abs(srcIdx - tgtIdx) === 1) isPathLine = true;
             else return; 
          } else if (selectedRelationship) {
             if (table.name === selectedRelationship.source && col.name === selectedRelationship.colName && targetTable === selectedRelationship.target) {
                isExplicitlySelected = true;
                isHighlighted = true;
             }
          } else if (activeColumn) {
             if (activeColumn.table === table.name && activeColumn.col === col.name) isHighlighted = true;
             else return; 
          } else if (hoveredNode) {
             if (table.name !== hoveredNode && targetTable !== hoveredNode) return;
          }
          const sourceY = startPos.y + HEADER_HEIGHT + (colIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          let targetY = endPos.y + 20; 
          if (lodLevel === 'high' || isHighlighted || isPathLine) {
             const targetTbl = schema.tables.find(t => t.name === targetTable);
             if (targetTbl) {
                const tColIdx = targetTbl.columns.findIndex(c => c.name === targetColName);
                if (tColIdx >= 0) targetY = endPos.y + HEADER_HEIGHT + (tColIdx * ROW_HEIGHT) + (ROW_HEIGHT / 2);
             }
          }
          const isRight = endPos.x > startPos.x + TABLE_WIDTH;
          const sx = isRight ? startPos.x + TABLE_WIDTH : startPos.x;
          const ex = isRight ? endPos.x : endPos.x + TABLE_WIDTH;
          const dist = Math.abs(ex - sx) * 0.5;
          const pathD = `M ${sx} ${sourceY} C ${isRight ? sx + dist : sx - dist} ${sourceY}, ${isRight ? ex - dist : ex + dist} ${targetY}, ${ex} ${targetY}`;
          let stroke = "#94a3b8";
          let width = 1;
          let opacity = 0.4;
          let markerEnd = hoveredNode === table.name || activeColumn?.table === table.name ? "url(#arrowhead)" : undefined;
          if (isPathLine) { stroke = "#06b6d4"; width = 4; opacity = 1; markerEnd = "url(#arrowhead-selected)"; }
          else if (isExplicitlySelected) { stroke = "#f59e0b"; width = 3; opacity = 1; markerEnd = "url(#arrowhead-selected)"; } 
          else if (isHighlighted) { stroke = "#f59e0b"; width = 3; opacity = 1; markerEnd = "url(#arrowhead-selected)"; } 
          else if (hoveredNode === table.name || hoveredNode === targetTable) { stroke = "#6366f1"; width = 2; opacity = 0.8; markerEnd = "url(#arrowhead)"; }
          lines.push(
             <g key={`${table.name}-${col.name}-${targetTable}`}>
                <path d={pathD} stroke="transparent" strokeWidth={15} fill="none" className="cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); setSelectedRelationship({ source: table.name, target: targetTable, colName: col.name, targetColName: targetColName }); }} />
                <path d={pathD} stroke={stroke} strokeWidth={width} fill="none" opacity={opacity} className="pointer-events-none transition-all duration-300" markerEnd={markerEnd} />
             </g>
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, hoveredNode, hoveredColumn, selectedColumn, selectedRelationship, pathMode, foundPath, schema.tables, relationshipGraph]);

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

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-100 dark:bg-slate-900 w-full h-full rounded-xl shadow-2xl overflow-hidden relative border border-slate-700 flex flex-col">
        {!isLayoutReady && (
           <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/50 text-white backdrop-blur-[2px]">
              <Loader2 className="w-10 h-10 animate-spin mb-2 text-indigo-500" />
              <p className="text-sm font-bold">Processando {schema.tables.length} tabelas...</p>
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
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 pointer-events-auto w-64">
              <Search className="w-4 h-4 text-slate-400" />
              <input type="text" placeholder="Buscar tabela..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full" />
              {inputValue && <button onClick={() => setInputValue('')}><X className="w-3 h-3 text-slate-400" /></button>}
           </div>
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 pointer-events-auto w-64">
              <button onClick={() => { setPathMode(!pathMode); setFoundPath([]); setPathStartNode(null); setPathEndNode(null); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold w-full transition-colors ${pathMode ? 'bg-cyan-100 text-cyan-800' : 'bg-slate-100 text-slate-600'}`}><Route className="w-4 h-4" /> {pathMode ? 'Modo Rota Ativo' : 'Buscar Caminho'}</button>
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
                    <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
                  </marker>
               </defs>
               {connections}
             </svg>
             {visibleTables.map(table => (
                <DiagramNode key={table.name} table={table} pos={positions[table.name]} lodLevel={lodLevel} isHovered={hoveredNode === table.name} isSelected={selectedRelationship?.source === table.name || selectedRelationship?.target === table.name} opacity={pathMode && foundPath.length > 0 && !foundPath.includes(table.name) ? 0.1 : 1} ringClass={pathMode && foundPath.includes(table.name) ? 'ring-2 ring-cyan-400' : ''} tableColors={tableColors} columnColors={columnColors} hasTags={!!tableColors[table.name]} onMouseDown={handleMouseDown} onMouseEnter={(name: string) => !isInteracting && setHoveredNode(name)} onMouseLeave={() => setHoveredNode(null)} onContextMenu={(e: any, t: string, c?: string) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tableName: t, columnName: c }); }} onDoubleClick={(e: any, t: string) => { e.stopPropagation(); setViewingDDL(schema.tables.find(tbl => tbl.name === t) || null); }} onClearTableColor={(t: string) => { const nc = {...tableColors}; delete nc[t]; setTableColors(nc); }} onColumnEnter={handleColumnEnter} onColumnLeave={handleColumnLeave} onColumnClick={handleColumnClick} selectedColumn={selectedColumn} />
             ))}
          </div>
        </div>
        {contextMenu && (
           <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-[80] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 min-w-[150px] animate-in zoom-in-95 duration-100" onClick={e => e.stopPropagation()}>
              <button onClick={() => { const p = positions[contextMenu.tableName]; setPan({ x: (containerSize.w/2) - (p.x * 1.5) - 100, y: (containerSize.h/2) - (p.y * 1.5) }); setScale(1.5); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-slate-200">Focar Tabela</button>
              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <div className="px-3 py-1 text-[9px] text-slate-400">Colorir</div>
              <div className="px-3 flex gap-1 flex-wrap">
                 {TABLE_COLORS.map(c => (
                    <button key={c.id} onClick={() => { setTableColors(prev => ({ ...prev, [contextMenu.tableName]: c.id })); setContextMenu(null); }} className={`w-4 h-4 rounded-full ${c.bg.replace('50', '400')}`} />
                 ))}
              </div>
           </div>
        )}
        {viewingDDL && (
           <div className="absolute inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setViewingDDL(null)}>
              <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                 <div className="flex-1 overflow-auto bg-slate-900 p-4"><pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">{generateDDL(viewingDDL)}</pre></div>
                 <button onClick={() => setViewingDDL(null)} className="p-3 bg-slate-800 text-white text-xs w-full text-center hover:bg-slate-700">Fechar</button>
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
