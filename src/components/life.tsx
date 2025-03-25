import React, { useState, useRef, useEffect, useMemo } from "react";

interface GridProps {
  initialState?: string;
}

const Grid: React.FC<GridProps> = ({ initialState }) => {
  // Parse initial state if provided
  const initialCells = initialState
    ? new Set<string>(JSON.parse(initialState) as string[])
    : new Set<string>(["0,0"]);

  // Track filled cells using a Set with string keys "x,y"
  const [filledCells, setFilledCells] = useState<Set<string>>(initialCells);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const [iterationSpeed, setIterationSpeed] = useState(100); // ms between iterations
  const animationRef = useRef<number | null>(null);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  // Container ref and offset state for dynamic positioning
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerOffset, setContainerOffset] = useState({ top: 0 });

  // Add windowSize state to properly recalculate on resize
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  // Track if we're in drawing mode and what action we're taking
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawAction, setDrawAction] = useState<"add" | "remove" | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Effect to measure container position
  useEffect(() => {
    const measureOffset = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerOffset({ top: rect.top });
      }
    };

    // Measure on mount and window resize
    measureOffset();
    window.addEventListener("resize", measureOffset);

    return () => {
      window.removeEventListener("resize", measureOffset);
    };
  }, []);

  // Helper function to get adjusted cursor position
  const getAdjustedCursorPosition = (clientX: number, clientY: number) => {
    return {
      x: clientX,
      y: clientY - containerOffset.top,
    };
  };

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle mouse down for dragging (right click) or drawing (left click)
  const handleMouseDown = (e: React.MouseEvent) => {
    const { x: cursorX, y: cursorY } = getAdjustedCursorPosition(
      e.clientX,
      e.clientY
    );

    if (e.button === 2) {
      // Right click for panning
      e.preventDefault(); // Prevent context menu
      setIsDragging(true);
      setDragStart({
        x: cursorX - position.x,
        y: cursorY - position.y,
      });
    } else if (e.button === 0) {
      // Left click for drawing
      setIsDrawing(true);
      // Determine if we're adding or removing cells
      const cellSize = 30;
      const col = Math.floor((cursorX - position.x) / cellSize / zoom);
      const row = Math.floor((cursorY - position.y) / cellSize / zoom);
      const cellKey = `${col},${row}`;

      // If clicking on a filled cell, we're removing; otherwise, we're adding
      const action = filledCells.has(cellKey) ? "remove" : "add";
      setDrawAction(action);

      // Toggle the initial cell
      handleCellToggle(row, col);
    }
  };

  // Handle mouse move for dragging or drawing
  const handleMouseMove = (e: React.MouseEvent) => {
    const { x: cursorX, y: cursorY } = getAdjustedCursorPosition(
      e.clientX,
      e.clientY
    );

    if (isDragging) {
      // Handle panning
      setPosition({
        x: cursorX - dragStart.x,
        y: cursorY - dragStart.y,
      });
    } else if (isDrawing && drawAction) {
      // Handle drawing cells
      const cellSize = 30;
      const col = Math.floor((cursorX - position.x) / cellSize / zoom);
      const row = Math.floor((cursorY - position.y) / cellSize / zoom);
      const cellKey = `${col},${row}`;

      setFilledCells((prevFilledCells) => {
        const newFilledCells = new Set(prevFilledCells);

        if (drawAction === "add" && !newFilledCells.has(cellKey)) {
          newFilledCells.add(cellKey);
        } else if (drawAction === "remove" && newFilledCells.has(cellKey)) {
          newFilledCells.delete(cellKey);
        }

        return newFilledCells;
      });
    }
  };

  // Handle mouse up to stop dragging or drawing
  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2 || isDragging) {
      setIsDragging(false);
    }
    if (e.button === 0 || isDrawing) {
      setIsDrawing(false);
      setDrawAction(null);
    }
  };

  // Prevent context menu from appearing on right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Handle cell toggle function
  const handleCellToggle = (row: number, col: number) => {
    const cellKey = `${col},${row}`;
    setFilledCells((prevFilledCells) => {
      const newFilledCells = new Set(prevFilledCells);

      if (
        drawAction === "add" ||
        (drawAction === null && !newFilledCells.has(cellKey))
      ) {
        newFilledCells.add(cellKey);
      } else if (
        drawAction === "remove" ||
        (drawAction === null && newFilledCells.has(cellKey))
      ) {
        newFilledCells.delete(cellKey);
      }

      return newFilledCells;
    });
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;

    // Get cursor position relative to the page with adjustments
    const { x: cursorX, y: cursorY } = getAdjustedCursorPosition(
      e.clientX,
      e.clientY
    );

    // Get cursor position relative to the grid's transformed position
    const cursorGridX = (cursorX - position.x) / zoom;
    const cursorGridY = (cursorY - position.y) / zoom;

    // Calculate new zoom with limits
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));

    if (newZoom !== zoom) {
      // Calculate new position to keep cursor at the same spot
      const newPosX = cursorX - cursorGridX * newZoom;
      const newPosY = cursorY - cursorGridY * newZoom;

      // Update zoom and position
      setZoom(newZoom);
      setPosition({
        x: newPosX,
        y: newPosY,
      });
    }
  };

  // Add body overflow control
  useEffect(() => {
    // Save original overflow style
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Clean up event listeners
    const currentRef = gridRef.current;

    return () => {
      document.body.style.overflow = originalStyle;
      if (currentRef) {
        currentRef.removeEventListener("wheel", handleWheel as any);
      }
    };
  }, []);

  // Animation loop for running the simulation
  useEffect(() => {
    if (!isRunning) {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    let lastTime = 0;
    const animate = (time: number) => {
      if (time - lastTime >= iterationSpeed) {
        iterate();
        lastTime = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, iterationSpeed]);

  // Update keyboard handler to toggle simulation with spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default browser behavior for these keys
      if (e.key === " " || e.key === "z" || e.key === "Shift") {
        e.preventDefault();
      }

      switch (e.key) {
        case " ": // Spacebar
          setIsRunning((prev) => !prev); // Toggle simulation
          break;

        case "z":
          // Single step forward
          if (!isRunning) {
            iterate();
          }
          break;

        case "Shift":
          // Clear the grid
          setFilledCells(new Set());
          break;

        default:
          break;
      }
    };

    // Add event listener to window
    window.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRunning]);

  // Function to iterate the Game of Life one generation
  const iterate = () => {
    setFilledCells((prevFilledCells) => {
      const newFilledCells = new Set<string>();
      const cellsToCheck = new Set<string>();

      // Add all filled cells to check
      prevFilledCells.forEach((cell) => cellsToCheck.add(cell));

      // Add all neighbors of filled cells to check
      prevFilledCells.forEach((cell) => {
        const [col, row] = cell.split(",").map(Number);

        // Check all 8 neighboring cells
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue; // Skip the cell itself
            const neighborKey = `${col + j},${row + i}`;
            cellsToCheck.add(neighborKey);
          }
        }
      });

      // Apply Game of Life rules to each cell
      cellsToCheck.forEach((cell) => {
        const [col, row] = cell.split(",").map(Number);
        let liveNeighbors = 0;

        // Count live neighbors
        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue; // Skip the cell itself
            const neighborKey = `${col + j},${row + i}`;
            if (prevFilledCells.has(neighborKey)) {
              liveNeighbors++;
            }
          }
        }

        // Apply Conway's Game of Life rules:
        // 1. Any live cell with 2 or 3 live neighbors survives
        // 2. Any dead cell with exactly 3 live neighbors becomes alive
        // 3. All other live cells die, and all other dead cells stay dead
        if (prevFilledCells.has(cell)) {
          // Cell is alive
          if (liveNeighbors === 2 || liveNeighbors === 3) {
            newFilledCells.add(cell); // Cell survives
          }
        } else {
          // Cell is dead
          if (liveNeighbors === 3) {
            newFilledCells.add(cell); // Cell becomes alive
          }
        }
      });

      return newFilledCells;
    });
  };

  const gridCells = useMemo(() => {
    const cellSize = 30; // size of each grid cell

    // Use fixed values for calculation to avoid excessive re-renders
    const visibleCols = Math.ceil(windowSize.width / cellSize / zoom) + 2;
    const visibleRows = Math.ceil(windowSize.height / cellSize / zoom) + 2;

    // Calculate which cells are visible based on position and zoom
    const startCol = Math.floor(-position.x / cellSize / zoom);
    const startRow = Math.floor(-position.y / cellSize / zoom);

    // Calculate total cells that would be drawn
    const totalPotentialCells = visibleCols * visibleRows;
    const gridLineThreshold = 16384; // Threshold for skipping grid lines

    // Calculate if we should render grid lines based on zoom level
    const shouldRenderGridLines = totalPotentialCells <= gridLineThreshold;

    // Arrays for our two rendering passes
    const filledCellElements = [];
    const gridElements = [];

    // First pass: render all filled cells that are in the viewport
    for (const cellKey of filledCells) {
      const [col, row] = cellKey.split(",").map(Number);

      // Check if the cell is in the visible area
      if (
        col >= startCol &&
        col < startCol + visibleCols &&
        row >= startRow &&
        row < startRow + visibleRows
      ) {
        filledCellElements.push(
          <div
            key={`filled-${row}-${col}`}
            className="cell filled"
            style={{
              left: `${col * cellSize}px`,
              top: `${row * cellSize}px`,
              width: `${cellSize}px`,
              height: `${cellSize}px`,
              border: "none",
              backgroundColor: "var(--bold-color)",
              position: "absolute",
            }}
          />
        );
      }
    }

    // Second pass: render grid overlay if not zoomed out too far
    if (shouldRenderGridLines) {
      // Instead of individual lines, create a single grid overlay
      gridElements.push(
        <svg
          key="grid-overlay"
          className="grid-overlay"
          style={{
            position: "absolute",
            left: `${startCol * cellSize}px`,
            top: `${startRow * cellSize}px`,
            width: `${visibleCols * cellSize + 1}px`,
            height: `${visibleRows * cellSize + 1}px`,
            pointerEvents: "none",
            opacity: 1,
          }}
        >
          <defs>
            <pattern
              id="grid"
              width={cellSize}
              height={cellSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${cellSize} 0 L 0 0 0 ${cellSize}`}
                fill="none"
                stroke="var(--navbar-bg)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      );
    }

    // Return combined elements from both passes
    return [...gridElements, ...filledCellElements];
  }, [
    position.x,
    position.y,
    zoom,
    windowSize.width,
    windowSize.height,
    filledCells,
  ]);

  return (
    <div
      ref={containerRef}
      className="game-container"
      style={{
        position: "fixed",
        width: "100%",
        height: "calc(100vh - var(--navbar-height, 64px))",
        top: "var(--navbar-height, 64px)",
      }}
    >
      {/* Main grid with all event handlers */}
      <div
        className="grid-container"
        onMouseDown={(e) => {
          // Only handle mouse events if not clicking on UI elements
          if (!(e.target as Element).closest(".ui-control")) {
            handleMouseDown(e);
          }
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsDrawing(false);
          setDrawAction(null);
        }}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        ref={gridRef}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          top: "0",
          left: "0",
          right: "0",
          bottom: "0",
          overflow: "hidden",
          backgroundColor: "var(--bg-color)",
          cursor: "grab",
        }}
      >
        <div
          className="grid"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            position: "absolute",
          }}
        >
          {gridCells}
        </div>
      </div>

      {/* UI controls - outside grid event handling */}
      <div
        className="info-button ui-control"
        onClick={() => setShowInfoPopup(!showInfoPopup)}
        style={{
          position: "absolute",
          left: "30px",
          bottom: "30px",
          width: "30px",
          height: "30px",
          borderRadius: "50%",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: "18px",
          fontWeight: "bold",
          zIndex: 1000,
        }}
      >
        i
      </div>

      {/* Info popup */}
      {showInfoPopup && (
        <div
          className="info-popup ui-control"
          style={{
            position: "absolute",
            left: "30px",
            bottom: "80px",
            padding: "15px",
            maxWidth: "300px",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            borderRadius: "8px",
            zIndex: 1000,
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          {/* Popup content */}
          <h3 style={{ margin: "0 0 10px 0" }}>Conway's Game of Life</h3>
          <p>
            <strong>Controls:</strong>
          </p>
          <ul style={{ paddingLeft: "20px", margin: "5px 0" }}>
            <li>Left-click: Toggle cells</li>
            <li>Right-click/drag: Pan the grid</li>
            <li>Mouse wheel: Zoom in/out</li>
            <li>Space: Play/pause simulation</li>
            <li>Z: Single step (when paused)</li>
            <li>Shift: Clear the grid</li>
          </ul>
          <button
            onClick={() => setShowInfoPopup(false)}
            style={{
              backgroundColor: "transparent",
              border: "1px solid white",
              borderRadius: "4px",
              color: "white",
              padding: "5px 10px",
              marginTop: "10px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default Grid;
