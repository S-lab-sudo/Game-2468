'use client';

import { useMemo, useState, useEffect, useCallback, memo } from 'react';
import { Tile as TileType, PowerUpMode } from '@/types/game';
import { Tile } from './Tile';
import { perfRender, perfStart, perfEnd } from '@/lib/perfLogger';
import styles from './styles/GameBoard.module.css';

interface GameBoardProps {
  tiles: TileType[];
  gridSize: number;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  activeMode?: PowerUpMode;
  selectedTileId?: string | null;
  onTileClick?: (tileId: string) => void;
}

// Debounced resize handler for performance
function useBoardSize(gridSize: number) {
  const [dimensions, setDimensions] = useState({
    boardSize: 480,
    gap: 12,
    cellSize: 111,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    function calculateSize() {
      perfStart('useBoardSize.calculateSize');
      
      const screenWidth = window.innerWidth;
      const padding = 16;
      const maxBoardSize = gridSize === 4 ? 520 : gridSize === 5 ? 560 : 600;
      const boardSize = Math.min(maxBoardSize, screenWidth - padding * 2);
      const gap = Math.max(4, Math.floor(boardSize * (gridSize <= 4 ? 0.025 : gridSize === 5 ? 0.02 : 0.015)));
      const totalGaps = gap * (gridSize + 1);
      const cellSize = Math.floor((boardSize - totalGaps) / gridSize);
      
      setDimensions({ boardSize, gap, cellSize });
      perfEnd('useBoardSize.calculateSize');
    }

    // Debounced resize handler - only recalculate after 100ms of no resize
    function handleResize() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(calculateSize, 100);
    }

    calculateSize();
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [gridSize]);

  return dimensions;
}

// Memoized GameBoard component
export const GameBoard = memo(function GameBoard({ 
  tiles, 
  gridSize,
  onTouchStart, 
  onTouchEnd,
  activeMode = 'none',
  selectedTileId,
  onTileClick,
}: GameBoardProps) {
  perfRender('GameBoard', { tilesCount: tiles.length, gridSize });
  
  const { boardSize, gap, cellSize } = useBoardSize(gridSize);
  const isSelectionMode = activeMode !== 'none';

  // Memoize click handler to prevent re-creating on each render
  const handleTileClick = useCallback((tileId: string) => {
    onTileClick?.(tileId);
  }, [onTileClick]);

  // Memoize touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    onTouchStart(e);
  }, [onTouchStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    onTouchEnd(e);
  }, [onTouchEnd]);

  // Memoize background grid cells - only regenerate when dimensions change
  const backgroundCells = useMemo(() => {
    perfStart('GameBoard.backgroundCells');
    const cells = [];
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        cells.push(
          <div
            key={`cell-${row}-${col}`}
            className={styles.cell}
            style={{
              width: cellSize,
              height: cellSize,
              left: gap + col * (cellSize + gap),
              top: gap + row * (cellSize + gap),
            }}
          />
        );
      }
    }
    perfEnd('GameBoard.backgroundCells');
    return cells;
  }, [cellSize, gap, gridSize]);

  return (
    <div
      className={`${styles.boardWrapper} ${isSelectionMode ? styles.selectionMode : ''}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className={styles.board}
        style={{ width: boardSize, height: boardSize }}
      >
        <div className={styles.gridBackground}>
          {backgroundCells}
        </div>

        <div 
          className={styles.tilesContainer}
          style={{ left: gap, top: gap }}
        >
          {tiles.map((tile) => (
            <Tile
              key={tile.id}
              tile={tile}
              cellSize={cellSize}
              gap={gap}
              isClickable={isSelectionMode}
              isSelected={tile.id === selectedTileId}
              activeMode={activeMode}
              onClick={() => handleTileClick(tile.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});
