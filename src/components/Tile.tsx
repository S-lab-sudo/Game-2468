'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tile as TileType, PowerUpMode } from '@/types/game';
import { getTileColor } from '@/lib/constants';
import { perfRender, perfAnimation } from '@/lib/perfLogger';
import styles from './styles/Tile.module.css';

interface TileProps {
  tile: TileType;
  cellSize: number;
  gap: number;
  isClickable?: boolean;
  isSelected?: boolean;
  activeMode?: PowerUpMode;
  onClick?: () => void;
}

// Animation timing - reduced for mobile performance
const SLIDE_DURATION = 0.12; // Reduced from 0.15

// Memoized tile component to prevent unnecessary re-renders
export const Tile = memo(function Tile({ 
  tile, 
  cellSize, 
  gap, 
  isClickable = false,
  isSelected = false,
  activeMode = 'none',
  onClick,
}: TileProps) {
  perfRender('Tile', { id: tile.id, value: tile.value });

  const { background, text } = getTileColor(tile.value);
  
  // Memoize position calculations
  const { x, y, prevX, prevY, fontSize } = useMemo(() => {
    const posX = tile.col * (cellSize + gap);
    const posY = tile.row * (cellSize + gap);
    const pX = tile.previousPosition ? tile.previousPosition.col * (cellSize + gap) : posX;
    const pY = tile.previousPosition ? tile.previousPosition.row * (cellSize + gap) : posY;
    
    // Calculate font size based on digits
    const digits = tile.value.toString().length;
    let size = cellSize * 0.45;
    if (digits === 3) size = cellSize * 0.38;
    else if (digits === 4) size = cellSize * 0.32;
    else if (digits >= 5) size = cellSize * 0.26;
    
    return { x: posX, y: posY, prevX: pX, prevY: pY, fontSize: size };
  }, [tile.col, tile.row, tile.previousPosition, tile.value, cellSize, gap]);

  const canClick = isClickable && (
    (activeMode === 'divider' && tile.value > 2) ||
    (activeMode === 'doubler') ||
    (activeMode === 'swapper')
  );

  // Simplified animation - NO shake on mobile (performance killer)
  // Using CSS animations instead of Framer Motion keyframes
  
  return (
    <motion.div
      className={`${styles.tile} ${canClick ? styles.clickable : ''} ${isSelected ? styles.selected : ''} ${isClickable && !isSelected ? styles.wiggle : ''}`}
      style={{
        width: cellSize,
        height: cellSize,
        backgroundColor: background,
        color: text,
        fontSize: `${fontSize}px`,
      }}
      initial={
        tile.isNew 
          ? { scale: 0, opacity: 0, x, y }
          : tile.previousPosition
          ? { x: prevX, y: prevY, scale: 1, opacity: 1 }
          : { x, y, scale: 1, opacity: 1 }
      }
      animate={{ 
        x, 
        y, 
        scale: isSelected ? 1.05 : 1, 
        opacity: 1,
      }}
      transition={{
        x: { duration: SLIDE_DURATION, ease: 'easeOut' },
        y: { duration: SLIDE_DURATION, ease: 'easeOut' },
        scale: { 
          duration: tile.isNew ? 0.15 : 0.1,
          delay: tile.isMerged ? SLIDE_DURATION : 0,
        },
        opacity: { duration: 0.1 },
      }}
      onClick={canClick ? onClick : undefined}
      onAnimationStart={() => perfAnimation('Tile', 'start')}
      onAnimationComplete={() => perfAnimation('Tile', 'complete')}
    >
      <span className={styles.value}>{tile.value}</span>
      
      {/* Simplified merge effect - CSS only, no extra motion div */}
      {tile.isMerged && <div className={styles.mergeFlash} style={{ backgroundColor: background }} />}
      
      {isSelected && <div className={styles.selectedRing} />}
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these change
  return (
    prevProps.tile.id === nextProps.tile.id &&
    prevProps.tile.value === nextProps.tile.value &&
    prevProps.tile.row === nextProps.tile.row &&
    prevProps.tile.col === nextProps.tile.col &&
    prevProps.tile.isNew === nextProps.tile.isNew &&
    prevProps.tile.isMerged === nextProps.tile.isMerged &&
    prevProps.cellSize === nextProps.cellSize &&
    prevProps.gap === nextProps.gap &&
    prevProps.isClickable === nextProps.isClickable &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.activeMode === nextProps.activeMode
  );
});
