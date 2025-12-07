import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { DatabaseSchema, Table } from '../types';
import { X, ZoomIn, ZoomOut, Maximize, Loader2, Search, Key, Link, Target, CornerDownRight, Copy, Eye, Download, Map as MapIcon, Palette, FileCode, Upload, Save, Trash2, Tag, Filter, Eraser, Route, PlayCircle, StopCircle, ArrowRight } from 'lucide-react';
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

const TABLE_WIDTH = 220;
const HEADER_HEIGHT = 42; 
const ROW_HEIGHT = 28;    
const COL_SPACING = 300;
const ROW_SPACING_GAP = 60;

// Predefined colors for table grouping
const TABLE_COLORS = [
  { id: 'default', bg: 'bg-slate-50', darkBg: 'dark:bg-slate-900/50', border: 'border-slate-100', text: 'text-slate-700' },
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

// --- Minimap Component ---
const Minimap = ({ 
   positions, 
   visibleTables, 
   containerSize, 
   pan, 
   scale,
   tables,
   tableColors 
}: { 
   positions: Record<string, NodePosition>, 
   visibleTables: Table[], 
   containerSize: {w: number, h: number}, 
   pan: {x: number, y: number},
   scale: number,
   tables: Table[],
   tableColors: Record<string, string>
}) => {
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
      return { minX: minX - 100, minY: minY - 100, w: (maxX - minX) + 200, h: (maxY - minY) + 200 };
   }, [positions, visibleTables]);

   if (visibleTables.length === 0) return null;

   const mapWidth = 200;
   const mapScale = mapWidth / bounds.w;
   const mapHeight = bounds.h * mapScale;

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
               const mx = (p.x - bounds.minX) * mapScale;
               const my = (p.y - bounds.minY) * mapScale;
               const mw = TABLE_WIDTH * mapScale;
               const mh = ((t.columns.length * ROW_HEIGHT) + HEADER_HEIGHT) * mapScale;
               
               const colorId = tableColors[t.name] || 'default';
               const colorClass = colorId === 'default' ? 'bg-slate-300 dark:bg-slate-600' : 
                                  colorId === 'red' ? 'bg-red-400' :
                                  colorId === 'blue' ? 'bg-blue-400' :
                                  colorId === 'green' ? 'bg-emerald-400' : 
                                  'bg-indigo-400';

               return (
                  <div 
                     key={t.name}
                     className={`absolute rounded-[1px] ${colorClass}`}
                     style={{ left: mx, top: my, width: mw, height: mh }}
                  />
               );
            })}
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
  
  // Customization State
  const [tableColors, setTableColors] = useState<Record<string, string>>({});
  const [columnColors, setColumnColors] = useState<Record<string, string>>({}); 
  const [activeColorFilter, setActiveColorFilter] = useState<string | null>(null);
  
  // Interaction States
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<HoveredColumnState | null>(null);
  const [selectedRelationship, setSelectedRelationship] = useState<SelectedRelationship | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // Pathfinding State
  const [pathMode, setPathMode] = useState(false);
  const [pathStartNode, setPathStartNode] = useState<string | null>(null);
  const [pathEndNode, setPathEndNode] = useState<string | null>(null);
  const [foundPath, setFoundPath] = useState<string[]>([]);
  
  // DDL Viewer State
  const [viewingDDL, setViewingDDL] = useState<Table | null>(null);

  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeout = useRef<any>(null);
  
  // Search State
  const [inputValue, setInputValue] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(inputValue);
    }, 400); 
    return () => clearTimeout(timer);
  }, [inputValue]);

  const triggerInteraction = useCallback(() => {
     if (!isInteracting) setIsInteracting(true);
     if (interactionTimeout.current) clearTimeout(interactionTimeout.current);
     interactionTimeout.current = setTimeout(() => {
        setIsInteracting(false);
     }, 150);
  }, [isInteracting]);

  // Graph Adjacency List for relationships
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
             
             // Undirected graph for pathfinding connectivity
             adj[t.name].add(targetTable);
             adj[targetTable].add(t.name);
          }
       });
    });
    return adj;
  }, [schema.tables]);

  // Pathfinding BFS
  const findShortestPath = useCallback((start: string, end: string) => {
     if (!start || !end) return [];
     if (start === end) return [start];

     const queue: string[][] = [[start]];
     const visited = new Set<string>();
     visited.add(start);

     while (queue.length > 0) {
        const path = queue.shift()!;
        const node = path[path.length - 1];

        if (node === end) return path;

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
     return [];
  }, [relationshipGraph]);

  // Update path when nodes change
  useEffect(() => {
     if (pathStartNode && pathEndNode) {
        const path = findShortestPath(pathStartNode, pathEndNode);
        setFoundPath(path);
     } else {
        setFoundPath([]);
     }
  }, [pathStartNode, pathEndNode, findShortestPath]);

  const calculateLayout = useCallback((tablesToLayout: Table[]) => {
      const newPositions: Record<string, NodePosition> = {};
      const count = tablesToLayout.length;
      const cols = Math.ceil(Math.sqrt(count * 1.5)); 
      const rowMaxHeights: number[] = [];
      
      tablesToLayout.forEach((table, index) => {
        const row = Math.floor(index / cols);
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
      } else if (activeColorFilter) {
         tablesToRender = schema.tables.filter(t => tableColors[t.name] === activeColorFilter);
      }

      const newPos = calculateLayout(tablesToRender);
      setPositions(newPos);
      
      if (debouncedTerm.trim() || activeColorFilter) {
         setPan({ x: 50, y: 50 });
         setScale(1);
      }
      setIsLayoutReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [debouncedTerm, activeColorFilter, schema.tables, calculateLayout, tableColors]);

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
     if (debouncedTerm.trim() || activeColorFilter) return schema.tables.filter(t => !!positions[t.name]);
     return schema.tables.filter(t => !!positions[t.name]);
  }, [positions, isLayoutReady, schema.tables, debouncedTerm, activeColorFilter]);

  const handleMouseDown = (e: React.MouseEvent, tableName?: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    
    setContextMenu(null);
    
    // Path Mode Logic
    if (pathMode && tableName) {
       if (!pathStartNode) {
          setPathStartNode(tableName);
       } else if (!pathEndNode) {
          setPathEndNode(tableName);
       } else {
          // Reset and start new path
          setPathStartNode(tableName);
          setPathEndNode(null);
       }
       return;
    }

    if (!tableName) setSelectedRelationship(null);

    lastMousePos.current = { x: e.clientX, y: e.clientY };
    if (tableName) setDraggedNode(tableName);
    else setIsDraggingCanvas(true);
  };
  
  const handleContextMenu = (e: React.MouseEvent, tableName: string, columnName?: string) => {
     e.preventDefault();
     e.stopPropagation();
     setContextMenu({ x: e.clientX, y: e.clientY, tableName, columnName });
  };

  const handleDoubleClick = (e: React.MouseEvent, tableName: string) => {
    e.stopPropagation();
    const table = schema.tables.find(t => t.name === tableName);
    if (table) setViewingDDL(table);
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
  
  const handleContextMenuAction = (action: 'copy' | 'focus' | 'reset' | 'ddl' | 'color', color?: string) => {
     if (!contextMenu) return;
     
     if (action === 'copy') {
        const text = contextMenu.columnName || contextMenu.tableName;
        navigator.clipboard.writeText(text);
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
        if (contextMenu.columnName) {
           setColumnColors(prev => { const next = { ...prev }; delete next[`${contextMenu.tableName}.${contextMenu.columnName}`]; return next; });
        } else {
           setTableColors(prev => { const next = { ...prev }; delete next[contextMenu.tableName]; return next; });
        }
     } else if (action === 'ddl') {
        const table = schema.tables.find(t => t.name === contextMenu.tableName);
        if (table) setViewingDDL(table);
     } else if (action === 'color' && color) {
        if (contextMenu.columnName) {
           setColumnColors(prev => ({ ...prev, [`${contextMenu.tableName}.${contextMenu.columnName}`]: color }));
        } else {
           setTableColors(prev => ({ ...prev, [contextMenu.tableName]: color }));
        }
     }
     setContextMenu(null);
  };

  const handleClearTableColor = (tableName: string) => {
     // Clear Table Color
     setTableColors(prev => { const next = { ...prev }; delete next[tableName]; return next; });
     // Clear Column Colors for this table
     setColumnColors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
           if (key.startsWith(`${tableName}.`)) {
              delete next[key];
           }
        });
        return next;
     });
  };

  const handleExportImage = async () => {
     if (!containerRef.current) return;
     try {
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

  const handleSaveLayout = () => {
    const layout = {
      name: schema.name,
      positions,
      tableColors,
      columnColors,
      timestamp: Date.now()
    };
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `layout_${schema.name}.json`;
    link.click();
  };

  const handleLoadLayout = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const layout = JSON.parse(event.target?.result as string);
        if (layout.positions) setPositions(layout.positions);
        if (layout.tableColors) setTableColors(layout.tableColors);
        if (layout.columnColors) setColumnColors(layout.columnColors);
        alert("Layout carregado com sucesso!");
      } catch (err) {
        alert("Arquivo de layout inválido.");
      }
    };
    reader.readAsText(file);
  };

  const usedColors = useMemo(() => {
     return [...new Set(Object.values(tableColors))];
  }, [tableColors]);

  const getSmartPath = (start: {x: number, y: number}, end: {x: number, y: number}) => {
    const isTargetRight = end.x > start.x + TABLE_WIDTH;
    const isTargetLeft = end.x + TABLE_WIDTH < start.x;
    
    let startX: number, endX: number;
    let cp1x: number, cp2x: number;
    
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

  const connections = useMemo(() => {
    if (isInteracting && visibleTables.length > 50) return []; 
    if (visibleTables.length > 200 && !hoveredNode && !hoveredColumn && !selectedRelationship && !pathMode) return []; 

    const lines: React.ReactElement[] = [];
    const visibleSet = new Set(visibleTables.map(t => t.name));
    const foundPathSet = new Set(foundPath);

    visibleTables.forEach(table => {
      const startPos = positions[table.name];
      if (!startPos) return;
      
      // Determine if lines should be drawn for this table
      const isPathRelevant = pathMode && foundPath.length > 0 && foundPathSet.has(table.name);
      
      if (pathMode) {
         if (!isPathRelevant) return; 
      } else {
         if (selectedRelationship) {
            const isRelated = table.name === selectedRelationship.source || table.name === selectedRelationship.target;
            if (!isRelated) return;
         } else if (hoveredNode) {
            const isRelated = table.name === hoveredNode || relationshipGraph[hoveredNode]?.has(table.name);
            if (!isRelated) return;
         }
      }

      table.columns.forEach((col, colIndex) => {
        if (col.isForeignKey && col.references) {
          const parts = col.references.split('.');
          const targetTable = parts.length === 3 ? parts[1] : parts[0];
          const targetColName = parts.length === 3 ? parts[2] : parts[1];
          
          if (!visibleSet.has(targetTable) && !hoveredNode && !selectedRelationship && !pathMode) return;

          let isHighlighted = false;
          let isPathLine = false;

          if (pathMode) {
             // Highlight ONLY if both source and target are in the found path AND adjacent in path sequence
             const srcIdx = foundPath.indexOf(table.name);
             const tgtIdx = foundPath.indexOf(targetTable);
             if (srcIdx !== -1 && tgtIdx !== -1 && Math.abs(srcIdx - tgtIdx) === 1) {
                isPathLine = true;
                isHighlighted = true;
             } else {
                return;
             }
          } else {
             if (selectedRelationship) {
                const matchesSelected = (table.name === selectedRelationship.source && col.name === selectedRelationship.colName) && targetTable === selectedRelationship.target;
                if (!matchesSelected) return;
             } else if (hoveredNode) {
                const isLineRelevant = table.name === hoveredNode || targetTable === hoveredNode;
                if (!isLineRelevant) return;
             }

             if (selectedRelationship) {
                isHighlighted = true;
             } else if (hoveredColumn) {
                if (hoveredColumn.isPk && hoveredColumn.table === targetTable && hoveredColumn.col === targetColName) {
                   isHighlighted = true;
                } else if (!hoveredColumn.isPk && hoveredColumn.table === table.name && hoveredColumn.col === col.name) {
                   isHighlighted = true;
                } else {
                   return;
                }
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
          if (lodLevel === 'high' || hoveredNode || selectedRelationship || pathMode) {
              targetAnchorY = endPos.y + HEADER_HEIGHT + (targetColIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2);
          }

          const pathD = getSmartPath({x: startPos.x, y: sourceAnchorY}, {x: endPos.x, y: targetAnchorY});
          
          let strokeColor = "#94a3b8";
          let strokeWidth = 1.5;
          let opacity = 0.35;

          if (isPathLine) {
             strokeColor = "#06b6d4"; // Cyan
             strokeWidth = 4;
             opacity = 1;
          } else if (isHighlighted || selectedRelationship) {
             strokeColor = "#f59e0b";
             strokeWidth = 3;
             opacity = 1;
          } else if (hoveredNode) {
             strokeColor = "#6366f1";
             strokeWidth = 2;
             opacity = 0.8;
          }

          const relKey = `${table.name}-${col.name}-${targetTable}`;

          lines.push(
            <g key={relKey}>
               <path 
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={15}
                  fill="none"
                  className="cursor-pointer hover:stroke-indigo-500/10 pointer-events-auto"
                  onClick={(e) => {
                     e.stopPropagation();
                     if (!pathMode) {
                        if (selectedRelationship && selectedRelationship.source === table.name && selectedRelationship.colName === col.name) {
                           setSelectedRelationship(null);
                        } else {
                           setSelectedRelationship({
                              source: table.name,
                              colName: col.name,
                              target: targetTable,
                              targetColName: targetColName
                           });
                        }
                     }
                  }}
               />
               <path 
                  d={pathD} 
                  stroke={strokeColor} 
                  strokeWidth={strokeWidth} 
                  fill="none" 
                  opacity={opacity} 
                  className="pointer-events-none transition-all duration-300"
                  markerEnd={(isHighlighted || hoveredNode || selectedRelationship || isPathLine) ? (isPathLine ? "url(#arrowhead-cyan)" : "url(#arrowhead)") : undefined}
               />
            </g>
          );
        }
      });
    });
    return lines;
  }, [visibleTables, positions, lodLevel, isInteracting, schema.tables, hoveredNode, hoveredColumn, relationshipGraph, selectedRelationship, pathMode, foundPath]);

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
              
              <button onClick={handleSaveLayout} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Salvar Layout"><Save className="w-5 h-5" /></button>
              <label className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 cursor-pointer" title="Carregar Layout"><Upload className="w-5 h-5" /><input type="file" ref={fileInputRef} onChange={handleLoadLayout} accept=".json" className="hidden" /></label>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 self-center"></div>
              <button onClick={handleExportImage} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title="Exportar PNG"><Download className="w-5 h-5" /></button>
           </div>
           
           <div className="flex gap-2 pointer-events-auto">
              <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 w-64">
                 <Search className={`w-4 h-4 ${inputValue !== debouncedTerm ? 'text-indigo-500 animate-pulse' : 'text-slate-400'}`} />
                 <input type="text" placeholder="Buscar tabela..." value={inputValue} onChange={(e) => { setInputValue(e.target.value); setActiveColorFilter(null); }} className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-full placeholder-slate-400" />
                 {inputValue && <button onClick={() => setInputValue('')} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>}
              </div>
              
              {usedColors.length > 0 && (
                 <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex items-center gap-2 relative group">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select value={activeColorFilter || ''} onChange={(e) => { setActiveColorFilter(e.target.value || null); setInputValue(''); }} className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-200 w-24 cursor-pointer appearance-none">
                       <option value="">Todas as tags</option>
                       {usedColors.map(colorId => (<option key={colorId} value={colorId}>{colorId.charAt(0).toUpperCase() + colorId.slice(1)}</option>))}
                    </select>
                    {activeColorFilter && <button onClick={() => setActiveColorFilter(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>}
                 </div>
              )}
           </div>

           {/* Pathfinding Control */}
           <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 flex flex-col gap-2 pointer-events-auto w-64 transition-all">
              <button 
                 onClick={() => { setPathMode(!pathMode); setPathStartNode(null); setPathEndNode(null); setFoundPath([]); }}
                 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-full ${pathMode ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}
              >
                 <Route className="w-4 h-4" /> 
                 {pathMode ? 'Pathfinding Ativo' : 'Ativar Pathfinding'}
              </button>
              
              {pathMode && (
                 <div className="space-y-1.5 animate-in slide-in-from-top-2">
                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${pathStartNode ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'}`}>
                       <PlayCircle className="w-3.5 h-3.5" />
                       <span className="truncate">{pathStartNode || "Clique na Origem"}</span>
                    </div>
                    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${pathEndNode ? 'bg-red-50 border-red-200 text-red-800' : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'}`}>
                       <StopCircle className="w-3.5 h-3.5" />
                       <span className="truncate">{pathEndNode || "Clique no Destino"}</span>
                    </div>
                    {foundPath.length > 0 && (
                       <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <div className="text-[9px] font-bold uppercase text-slate-400 mb-1">Rota Encontrada</div>
                          <div className="flex flex-wrap items-center gap-1">
                             {foundPath.map((node, i) => (
                                <React.Fragment key={node}>
                                   {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-cyan-500" />}
                                   <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/20 px-1 rounded">{node}</span>
                                </React.Fragment>
                             ))}
                          </div>
                       </div>
                    )}
                    {pathStartNode && pathEndNode && foundPath.length === 0 && (
                       <div className="text-[10px] text-red-500 text-center mt-1">Sem conexão entre tabelas</div>
                    )}
                 </div>
              )}
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
                  <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
                  </marker>
               </defs>
               {connections}
             </svg>

             {visibleTables.map(table => {
                const pos = positions[table.name];
                if (!pos) return null;
                
                // --- Visual State Logic ---
                const isTableHovered = hoveredNode === table.name;
                const isRelated = !hoveredNode || hoveredNode === table.name || relationshipGraph[hoveredNode]?.has(table.name);
                
                // Check if this table has any column tags to show eraser button
                const hasTags = tableColors[table.name] || table.columns.some(c => columnColors[`${table.name}.${c.name}`]);

                let opacity = 1;
                let isPathNode = false;

                if (pathMode) {
                   if (foundPath.length > 0) {
                      isPathNode = foundPath.includes(table.name);
                      opacity = isPathNode ? 1 : 0.1;
                   } else if (pathStartNode || pathEndNode) {
                      if (table.name === pathStartNode || table.name === pathEndNode) opacity = 1;
                      else opacity = 0.3;
                   } else {
                      opacity = 1;
                   }
                } else if (selectedRelationship) {
                   const isSelected = table.name === selectedRelationship.source || table.name === selectedRelationship.target;
                   opacity = isSelected ? 1 : 0.05;
                } else {
                   opacity = isRelated ? 1 : 0.2;
                   if (hoveredColumn) {
                      // Detailed Column Highlight Logic...
                      const isSource = hoveredColumn.table === table.name;
                      let isTarget = false;
                      if (hoveredColumn.isPk) {
                         isTarget = table.columns.some(c => c.references?.includes(hoveredColumn.table));
                      } else {
                         const refParts = hoveredColumn.ref?.split('.') || [];
                         const targetTable = refParts.length === 3 ? refParts[1] : refParts[0];
                         isTarget = table.name === targetTable;
                      }
                      opacity = (isSource || isTarget) ? 1 : 0.1;
                   }
                }

                const displayLOD = (isTableHovered || selectedRelationship || isPathNode) ? 'high' : lodLevel;
                const colorId = tableColors[table.name] || 'default';
                const style = TABLE_COLORS.find(c => c.id === colorId) || TABLE_COLORS[0];
                
                // Ring styles for Pathfinding
                let ringClass = '';
                if (pathMode) {
                   if (table.name === pathStartNode) ringClass = 'ring-4 ring-emerald-400 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
                   else if (table.name === pathEndNode) ringClass = 'ring-4 ring-red-400 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]';
                   else if (isPathNode) ringClass = 'ring-2 ring-cyan-400 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]';
                } else if (isTableHovered || (selectedRelationship && opacity === 1)) {
                   ringClass = 'border-indigo-500 ring-2 ring-indigo-500 shadow-xl scale-105';
                }

                return (
                   <div
                      key={table.name}
                      onMouseDown={(e) => handleMouseDown(e, table.name)}
                      onMouseEnter={() => !isInteracting && setHoveredNode(table.name)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onContextMenu={(e) => handleContextMenu(e, table.name)}
                      onDoubleClick={(e) => handleDoubleClick(e, table.name)}
                      style={{
                         transform: `translate(${pos.x}px, ${pos.y}px)`,
                         width: TABLE_WIDTH,
                         opacity,
                         zIndex: isTableHovered || opacity === 1 ? 50 : 10,
                         pointerEvents: opacity < 0.2 ? 'none' : 'auto'
                      }}
                      className={`absolute rounded-lg cursor-grab active:cursor-grabbing transition-all duration-200
                         ${lodLevel === 'low' && !isTableHovered && !selectedRelationship && !isPathNode ? 'bg-indigo-200 dark:bg-indigo-900 border border-indigo-300 dark:border-indigo-800 h-10 flex items-center justify-center' : 'bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700'}
                         ${ringClass}
                      `}
                   >
                      {lodLevel === 'low' && !isTableHovered && !selectedRelationship && !isPathNode ? (
                         <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 truncate px-2">{table.name}</span>
                      ) : (
                         <>
                            <div className={`flex items-center justify-between px-3 py-2 border-b h-[42px] transition-colors relative group/header ${style.bg} ${style.darkBg} ${style.border}`}>
                               <span className={`font-bold text-sm truncate ${style.text}`} title={table.name}>{table.name}</span>
                               <div className="flex items-center gap-1">
                                  {hasTags && (
                                     <button 
                                       onClick={(e) => { e.stopPropagation(); handleClearTableColor(table.name); }} 
                                       className="p-1 opacity-0 group-hover/header:opacity-100 hover:text-red-500 transition-colors"
                                       title="Limpar todas as tags (tabela e colunas)"
                                     >
                                       <Eraser className="w-3 h-3" />
                                     </button>
                                  )}
                                  <span className={`text-[9px] opacity-70 ${style.text}`}>{table.schema}</span>
                               </div>
                            </div>
                            {displayLOD === 'high' && (
                               <div className="py-1">
                                  {table.columns.slice(0, 15).map(col => {
                                     // Column Color Check
                                     const colColorId = columnColors[`${table.name}.${col.name}`];
                                     const colStyle = colColorId ? TABLE_COLORS.find(c => c.id === colColorId) : null;
                                     const colBg = colStyle ? colStyle.bg : 'hover:bg-slate-50 dark:hover:bg-slate-700/50';
                                     const colText = colStyle ? colStyle.text : 'text-slate-600 dark:text-slate-400';

                                     return (
                                       <div 
                                          key={col.name} 
                                          className={`px-3 flex items-center justify-between text-[11px] h-[28px] ${colBg} ${colText} relative group/col`}
                                          onMouseEnter={() => !isInteracting && setHoveredColumn({ table: table.name, col: col.name, isPk: col.isPrimaryKey || false, ref: col.references })}
                                          onMouseLeave={() => setHoveredColumn(null)}
                                          onContextMenu={(e) => handleContextMenu(e, table.name, col.name)}
                                       >
                                          {colColorId && <div className={`absolute left-0 top-0 bottom-0 w-1 ${colStyle?.bg.replace('50', '400')}`}></div>}
                                          <div className="flex items-center gap-1.5 overflow-hidden">
                                             {col.isPrimaryKey && <Key className="w-3 h-3 text-amber-500 shrink-0" />}
                                             {col.isForeignKey && <Link className="w-3 h-3 text-blue-500 shrink-0" />}
                                             <span className="truncate">{col.name}</span>
                                          </div>
                                          <div className="flex items-center gap-1">
                                             <span className="text-slate-300 font-mono text-[9px]">{col.type.split('(')[0]}</span>
                                             {/* Column Hover Actions (Optional) */}
                                             {/* 
                                             <div className="flex items-center opacity-0 group-hover/col:opacity-100 transition-opacity absolute right-1 bg-white dark:bg-slate-800 shadow-sm border rounded p-0.5">
                                                <Target className="w-3 h-3 text-slate-400" />
                                             </div> 
                                             */}
                                          </div>
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
        
        {/* Context Menus & Modals (Preserved from previous logic) */}
        {contextMenu && (
           <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed z-[80] bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-2 min-w-[180px] animate-in fade-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => handleContextMenuAction('focus')} className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Eye className="w-3 h-3" /> Focar</button>
              {pathMode && <button onClick={() => { setPathStartNode(contextMenu.tableName); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2"><PlayCircle className="w-3 h-3" /> Definir Origem</button>}
              {pathMode && <button onClick={() => { setPathEndNode(contextMenu.tableName); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"><StopCircle className="w-3 h-3" /> Definir Destino</button>}
              <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
              <div className="px-3 py-1 text-[9px] text-slate-400">Cores</div>
              <div className="px-3 flex gap-1 flex-wrap">{TABLE_COLORS.map(c => <button key={c.id} onClick={() => handleContextMenuAction('color', c.id)} className={`w-4 h-4 rounded-full ${c.bg.replace('50', '400')}`} />)}</div>
           </div>
        )}
        
        {/* DDL Modal */}
        {viewingDDL && (
           <div className="absolute inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setViewingDDL(null)}>
              <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                 <div className="flex-1 overflow-auto bg-slate-900 p-4"><pre className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">{generateDDL(viewingDDL)}</pre></div>
                 <button onClick={() => setViewingDDL(null)} className="p-3 bg-slate-800 text-white text-xs w-full text-center hover:bg-slate-700">Fechar</button>
              </div>
           </div>
        )}

        <div className="minimap-ignore">
            <Minimap positions={positions} visibleTables={visibleTables} containerSize={containerSize} pan={pan} scale={scale} tables={schema.tables} tableColors={tableColors} />
        </div>
      </div>
    </div>
  );
};

export default SchemaDiagramModal;