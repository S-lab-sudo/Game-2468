# For Developers: 2468 Game Architecture & Logic

This document provides a deep dive into the internal mechanics, algorithmic logic, and technical architecture of the **2468 Puzzle Game**. It is intended for developers who want to understand *how* the game works under the hood.

---

## 1. Core Mechanics & Rules

### The Grid System
Unlike the standard 2048 game, **2468** scales difficulty by grid size:
*   **Easy**: 4×4 Grid (16 tiles)
*   **Medium**: 5×5 Grid (25 tiles)
*   **Hard**: 6×6 Grid (36 tiles)

### The Mathematical Spawn Model (Logarithmic Difficulty)
We moved away from static RNG (random number generation) to a **performance-based spawn system**. 

**The Problem**: In standard 2048, only `2`s and rarely `4`s spawn. This makes the late-game tedious.
**The Function**: We use a **Difficulty Scalar (D)** driven by the user's "Effective Score".

$$ D = \log_{10}(\text{Score} + \text{MaxTile} \times 20) $$

This scalar `D` determines the probability weights for spawning new tiles:

| Difficulty Scalar (D) | Approx. Score | Spawn Weights (2 / 4 / 8 / 16) | Gameplay Phase |
| :--- | :--- | :--- | :--- |
| **< 2.0** | < 100 | **95%** / 5% / 0% / 0% | **Early Game**: Mostly 2s, easy merging. |
| **~ 3.0** | ~ 1,000 | **40%** / **45%** / 15% / 0% | **Mid Game**: 4s dominate, 8s appear. Speed increases. |
| **> 4.5** | > 10,000 | **15%** / **50%** / **25%** / 10% | **Late Game**: Aggressive. 16s spawn as "punishment". |

**Implementation in `src/lib/gameEngine.ts`**:
```typescript
const w2 = Math.max(1, 100 - 20 * D);  // Decays
const w4 = Math.max(1, 5 + 30 * D);    // Ramps up
const w8 = Math.max(0, (D - 3) * 25);  // Appears later
```

### Power-up System
The game manages a separate state for power-ups (`PowerUpState`).

1.  **Divider (`÷`)**:
    *   **Logic**: `Math.floor(tile.value / 2)`.
    *   **Constraint**: Cannot divide a `2` tile.
    *   **Visual**: Uses `PowerUpMode = 'divider'`.
2.  **Doubler (`×2`)**:
    *   **Logic**: `tile.value * 2`.
    *   **Effect**: Can instantly trigger a win if 1024 → 2048.
3.  **Swapper (`⇄`)**:
    *   **Logic**: Swaps `row`/`col` of two selected tiles.
    *   **State**: Requires two clicks (`selectedTileId` tracks the first click).
4.  **Undo (`↩`)**:
    *   **Logic**: Restores the *entire* previous game state (tiles + score + lives).
    *   **Constraint**: Limited to 3 uses per difficulty level (Easy=3, Medium=2, Hard=1).

### Game Over Conditions
The game ends **only if**:
1.  The grid is full.
2.  No adjacent tiles can merge (classic check).
3.  **AND** all power-up lives (Divider, Doubler, Swapper) are exhausted.

This gives players a "last chance" mechanic to use their power-ups to save the game.

---

## 2. Technical Architecture

### Tech Stack
*   **Framework**: Next.js 15 (App Router) - Server Components + Client Hooks.
*   **Language**: TypeScript - Strict typing for GameState and Tiles.
*   **Styling**: CSS Modules (Zero runtime overhead, distinct standard CSS).
*   **State**: React `useState` + `useReducer` pattern (inside `useGame`).
*   **Persistence**: `localStorage` handles save states, best scores, and player names.

### Key Components
*   **`useGame.ts` (The Brain)**: 
    *   Manages the game loop.
    *   Handles `executeMove`, `checkGameOver`, and `activatePowerUp`.
    *   Debounces state saves to `localStorage` using `requestIdleCallback`.
*   **`gameEngine.ts` (The Logic)**:
    *   Pure functions only. No React dependencies.
    *   `move(tiles, direction)`: Calculates the new grid state.
    *   `spawnTile()`: Implements the logarithmic probability logic.
*   **`GameBoard.tsx` (The View)**:
    *   **Optimized**: Uses `React.memo` to prevent re-renders unless props change.
    *   **Responsive**: `useBoardSize` hook calculates pixels based on window width.
*   **`Tile.tsx` (The Atom)**:
    *   **Performance**: CSS-based animations (wiggle, merge flash) instead of JS animations for mobile FPS.
    *   **Memory**: Memoized to avoid unnecessary diffing.

### Performance Optimizations (Mobile First)
We implemented aggressive optimizations effectively making the game run at 60fps on mobile:
1.  **CSS Containment**: `contain: layout style` on the board prevents browser reflows going up the DOM tree.
2.  **`will-change: transform`**: Hints the GPU to handle tile movements.
3.  **Debounced Resize**: Board resizing logic waits 100ms before recalculating.
4.  **Animation Simplification**: Disabled heavy `box-shadow` and `backdrop-filter` effects on mobile devices.

---

## 3. Directory Structure

```
src/
├── app/                 # Next.js App Router
├── components/          # React Components
│   └── styles/          # CSS Modules per component
├── hooks/               # Custom Hooks
│   ├── useGame.ts       # Core Game Controller
│   ├── useSwipe.ts      # Touch/Swipe Detection
│   └── useKeyboard.ts   # Keyboard Listeners
├── lib/
│   ├── gameEngine.ts    # Pure Game Logic (Move/Merge/Spawn)
│   ├── perfLogger.ts    # Performance Profiling Utilities
│   └── constants.ts     # Config (Colors, Probabilities)
└── types/               # TypeScript Definitions
```

---

## 4. How to Extend

### Adding a new Power-up
1.  Add type to `PowerUpMode` in `types/game.ts`.
2.  Add life counter to `PowerUpState`.
3.  Add button in `PowerUpBar.tsx`.
4.  Implement logic in `useGame.ts` -> `handleTileClick`.
5.  Add condition to `checkGameOver`.

### Tuning Difficulty
Modify `src/lib/gameEngine.ts` inside `getSpawnValue()` function. Adjust the `D` scalar or the weight multipliers to make the game harder or easier.
