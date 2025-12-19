'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tile, Direction, GameState, GameData, PowerUpState, PowerUpMode, Difficulty, getDefaultPowerUps } from '@/types/game';
import { initializeTiles, move, spawnTile, isGameOver, hasWon, generateTileId } from '@/lib/gameEngine';
import { STORAGE_KEYS, GRID_SIZES } from '@/lib/constants';
import { perfState, perfStart, perfEnd } from '@/lib/perfLogger';

interface UseGameReturn {
    tiles: Tile[];
    score: number;
    bestScore: number;
    gameState: GameState;
    playerName: string;
    hasWonBefore: boolean;
    isLoading: boolean;
    powerUps: PowerUpState;
    difficulty: Difficulty;
    gridSize: number;
    executeMove: (direction: Direction) => void;
    undo: () => void;
    newGame: () => void;
    continueGame: () => void;
    setPlayerName: (name: string) => void;
    setDifficulty: (difficulty: Difficulty) => void;
    activatePowerUp: (mode: PowerUpMode) => void;
    handleTileClick: (tileId: string) => void;
    cancelPowerUp: () => void;
}

export function useGame(): UseGameReturn {
    const [tiles, setTiles] = useState<Tile[]>([]);
    const [score, setScore] = useState<number>(0);
    const [bestScore, setBestScore] = useState<number>(0);
    const [gameState, setGameState] = useState<GameState>('playing');
    const [playerName, setPlayerNameState] = useState<string>('');
    const [hasWonBefore, setHasWonBefore] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [difficulty, setDifficultyState] = useState<Difficulty>('easy');
    const [powerUps, setPowerUps] = useState<PowerUpState>(getDefaultPowerUps('easy'));
    const [undoState, setUndoState] = useState<{ tiles: Tile[]; score: number; powerUps: PowerUpState } | null>(null);

    // Memoize gridSize to prevent recalculation
    const gridSize = useMemo(() => GRID_SIZES[difficulty], [difficulty]);

    // Check for game over with new conditions
    const checkGameOver = useCallback((currentTiles: Tile[], currentPowerUps: PowerUpState) => {
        perfStart('checkGameOver');
        const noMoves = isGameOver(currentTiles, gridSize);
        const noPowerUps = (
            currentPowerUps.dividerLives <= 0 &&
            currentPowerUps.doublerLives <= 0 &&
            currentPowerUps.swapperLives <= 0
        );
        perfEnd('checkGameOver');
        return noMoves && noPowerUps;
    }, [gridSize]);

    // Load game state from localStorage on mount
    useEffect(() => {
        perfStart('useGame.loadState');
        if (typeof window === 'undefined') return;

        const savedName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
        const savedBest = localStorage.getItem(STORAGE_KEYS.BEST_SCORE);
        const savedState = localStorage.getItem(STORAGE_KEYS.GAME_STATE);

        if (savedName) setPlayerNameState(savedName);
        if (savedBest) setBestScore(parseInt(savedBest, 10));

        if (savedState) {
            try {
                const state: GameData = JSON.parse(savedState);
                const tilesWithNewIds = state.tiles.map((t, index) => ({
                    ...t,
                    id: `tile-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                }));
                setTiles(tilesWithNewIds);
                setScore(state.score);
                setGameState(state.gameState);
                setHasWonBefore(state.hasWonBefore || false);
                setDifficultyState(state.difficulty || 'easy');
                setPowerUps(state.powerUps || getDefaultPowerUps(state.difficulty || 'easy'));
            } catch {
                setTiles(initializeTiles('easy'));
                setPowerUps(getDefaultPowerUps('easy'));
            }
        } else {
            setTiles(initializeTiles('easy'));
            setPowerUps(getDefaultPowerUps('easy'));
        }

        setIsLoading(false);
        perfEnd('useGame.loadState');
        perfState('useGame', 'State loaded from localStorage');
    }, []);

    // Save game state to localStorage - debounced via dependency array
    useEffect(() => {
        if (isLoading || typeof window === 'undefined') return;

        // Use requestIdleCallback for non-blocking save
        const saveState = () => {
            perfStart('useGame.saveState');
            const state: GameData = {
                tiles,
                score,
                bestScore,
                gameState,
                playerName,
                hasWonBefore,
                difficulty,
                powerUps,
            };
            localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
            perfEnd('useGame.saveState');
        };

        if ('requestIdleCallback' in window) {
            (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(saveState);
        } else {
            saveState();
        }
    }, [tiles, score, gameState, hasWonBefore, isLoading, bestScore, playerName, difficulty, powerUps]);

    // Save best score separately
    useEffect(() => {
        if (isLoading || typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.BEST_SCORE, bestScore.toString());
    }, [bestScore, isLoading]);

    // Execute a move - optimized
    const executeMove = useCallback((direction: Direction) => {
        perfStart('executeMove');
        perfState('useGame', `executeMove: ${direction}`);

        if (gameState === 'over' || powerUps.activeMode !== 'none') {
            perfEnd('executeMove');
            return;
        }

        if (powerUps.undoLives > 0) {
            setUndoState({ tiles: [...tiles], score, powerUps: { ...powerUps } });
        }

        perfStart('move');
        const result = move(tiles, direction, gridSize);
        perfEnd('move');

        if (result.moved) {
            const newScore = score + result.scoreGained;
            let newTiles = result.tiles;

            perfStart('spawnTile');
            const spawned = spawnTile(newTiles, difficulty, newScore);
            perfEnd('spawnTile');

            if (spawned) {
                newTiles = [...newTiles, spawned];
            }

            // Batch state updates
            setTiles(newTiles);
            setScore(newScore);

            if (newScore > bestScore) {
                setBestScore(newScore);
            }

            if (!hasWonBefore && hasWon(newTiles)) {
                setGameState('won');
                setHasWonBefore(true);
                perfEnd('executeMove');
                return;
            }

            if (checkGameOver(newTiles, powerUps)) {
                setGameState('over');
            }
        }
        perfEnd('executeMove');
    }, [tiles, score, bestScore, gameState, hasWonBefore, powerUps, gridSize, difficulty, checkGameOver]);

    // Undo last move
    const undo = useCallback(() => {
        perfState('useGame', 'undo');
        if (!undoState || powerUps.undoLives <= 0) return;

        setTiles(undoState.tiles.map((t, i) => ({
            ...t,
            id: `tile-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        })));
        setScore(undoState.score);
        setGameState('playing');
        setPowerUps(prev => ({
            ...prev,
            undoLives: prev.undoLives - 1,
            activeMode: 'none',
            selectedTileId: null,
        }));
        setUndoState(null);
    }, [undoState, powerUps.undoLives]);

    // Start a new game
    const newGame = useCallback(() => {
        perfState('useGame', 'newGame');
        setTiles(initializeTiles(difficulty));
        setScore(0);
        setGameState('playing');
        setHasWonBefore(false);
        setPowerUps(getDefaultPowerUps(difficulty));
        setUndoState(null);
    }, [difficulty]);

    // Set difficulty and start new game
    const setDifficulty = useCallback((newDifficulty: Difficulty) => {
        perfState('useGame', `setDifficulty: ${newDifficulty}`);
        setDifficultyState(newDifficulty);
        setTiles(initializeTiles(newDifficulty));
        setScore(0);
        setGameState('playing');
        setHasWonBefore(false);
        setPowerUps(getDefaultPowerUps(newDifficulty));
        setUndoState(null);
    }, []);

    const continueGame = useCallback(() => {
        setGameState('playing');
    }, []);

    const setPlayerName = useCallback((name: string) => {
        setPlayerNameState(name);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
        }
    }, []);

    const activatePowerUp = useCallback((mode: PowerUpMode) => {
        perfState('useGame', `activatePowerUp: ${mode}`);
        if (mode === 'none') return;

        if (mode === 'divider' && powerUps.dividerLives <= 0) return;
        if (mode === 'doubler' && powerUps.doublerLives <= 0) return;
        if (mode === 'swapper' && powerUps.swapperLives <= 0) return;

        if (powerUps.activeMode === mode) {
            setPowerUps(prev => ({ ...prev, activeMode: 'none', selectedTileId: null }));
            return;
        }

        setPowerUps(prev => ({ ...prev, activeMode: mode, selectedTileId: null }));
    }, [powerUps]);

    const handleTileClick = useCallback((tileId: string) => {
        perfStart('handleTileClick');
        perfState('useGame', `handleTileClick: ${tileId}`);

        const tile = tiles.find(t => t.id === tileId);
        if (!tile) {
            perfEnd('handleTileClick');
            return;
        }

        if (powerUps.activeMode === 'divider') {
            if (tile.value <= 2) {
                perfEnd('handleTileClick');
                return;
            }

            setTiles(prev => prev.map(t =>
                t.id === tileId
                    ? { ...t, value: Math.floor(t.value / 2), isMerged: true, id: generateTileId() }
                    : t
            ));
            setPowerUps(prev => ({
                ...prev,
                dividerLives: prev.dividerLives - 1,
                activeMode: 'none',
            }));
        } else if (powerUps.activeMode === 'doubler') {
            setTiles(prev => prev.map(t =>
                t.id === tileId
                    ? { ...t, value: t.value * 2, isMerged: true, id: generateTileId() }
                    : t
            ));
            setPowerUps(prev => ({
                ...prev,
                doublerLives: prev.doublerLives - 1,
                activeMode: 'none',
            }));

            const updatedTiles = tiles.map(t =>
                t.id === tileId ? { ...t, value: t.value * 2 } : t
            );
            if (!hasWonBefore && hasWon(updatedTiles)) {
                setGameState('won');
                setHasWonBefore(true);
            }
        } else if (powerUps.activeMode === 'swapper') {
            if (!powerUps.selectedTileId) {
                setPowerUps(prev => ({ ...prev, selectedTileId: tileId }));
            } else if (powerUps.selectedTileId !== tileId) {
                const firstTile = tiles.find(t => t.id === powerUps.selectedTileId);
                const secondTile = tile;

                if (firstTile) {
                    setTiles(prev => prev.map(t => {
                        if (t.id === firstTile.id) {
                            return { ...t, row: secondTile.row, col: secondTile.col, id: generateTileId() };
                        }
                        if (t.id === secondTile.id) {
                            return { ...t, row: firstTile.row, col: firstTile.col, id: generateTileId() };
                        }
                        return t;
                    }));
                }

                setPowerUps(prev => ({
                    ...prev,
                    swapperLives: prev.swapperLives - 1,
                    activeMode: 'none',
                    selectedTileId: null,
                }));
            }
        }

        perfEnd('handleTileClick');

        // Defer game over check to next tick
        requestAnimationFrame(() => {
            setTiles(currentTiles => {
                setPowerUps(currentPowerUps => {
                    if (checkGameOver(currentTiles, currentPowerUps)) {
                        setGameState('over');
                    }
                    return currentPowerUps;
                });
                return currentTiles;
            });
        });
    }, [tiles, powerUps, hasWonBefore, checkGameOver]);

    const cancelPowerUp = useCallback(() => {
        setPowerUps(prev => ({ ...prev, activeMode: 'none', selectedTileId: null }));
    }, []);

    return {
        tiles,
        score,
        bestScore,
        gameState,
        playerName,
        hasWonBefore,
        isLoading,
        powerUps,
        difficulty,
        gridSize,
        executeMove,
        undo,
        newGame,
        continueGame,
        setPlayerName,
        setDifficulty,
        activatePowerUp,
        handleTileClick,
        cancelPowerUp,
    };
}
