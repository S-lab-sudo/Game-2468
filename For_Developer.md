# 2468 Game: Comprehensive Developer Documentation

This document serves as the definitive technical manual for the **2468 Puzzle Game**. It details the algorithmic implementation, challenges faced, optimizations applied, and the robust logic ensuring a bug-free experience.

---

## 1. Core Logic & Implementation Details

### 🟢 Robust Collision-Free Spawning
One of the most critical aspects of a grid-based puzzle game is ensuring new tiles **never** overwrite existing ones.

**Implementation Strategy:**
Instead of guessing a random coordinate and checking if it's empty (which gets slow as the board fills up), we use a **deterministic available-slot lookup**.

1.  **Scan Phase**: We iterate through every cell in the Grid (Size × Size).
2.  **Filter Phase**: We build an array of `EmptyPosition` objects for cells that have no tile ID in the `tiles` state array.
3.  **Selection Phase**:
    *   If `emptyPositions.length === 0`: Game Over check triggers.
    *   Else: We pick a random index from this array: `emptyPositions[Math.floor(Math.random() * length)]`.
4.  **Spawn**: The new tile is assigned this coordinate.

**Why this is robust**: It guarantees valid placement in O(N) time, where N is grid size. It fundamentally cannot collision.

### 🔄 The Movement Algorithm (Slide & Merge)
The movement logic is pure vector mathematics, decoupled from the UI.

1.  **Vector Mapping**:
    *   `Up` = `(-1, 0)`
    *   `Down` = `(1, 0)`
    *   `Left` = `(0, -1)`
    *   `Right` = `(0, 1)`
2.  **Traversal Order**:
    *   To prevent tiles from "skipping" over others, we process the grid in the **opposite** direction of movement.
    *   *Example*: Moving **Right**? We process the **rightmost** column first, then moving left.
3.  **The "Farthest Position" Check**:
    *   For every tile, we cast a ray in the movement vector direction.
    *   We store:
        *   `farthest`: The last empty cell found.
        *   `next`: The first occupied cell found after `farthest`.
4.  **Merge Logic**:
    *   If `next` exists AND `next.value === tile.value` AND `!next.isMerged`:
        *   **MERGE**: Move tile to `next` position.
        *   Mark as `isMerged: true` (prevents double-merging in one turn, e.g., 2-2-4 → 4-4, not 8).
        *   Remove old tiles, create new tile with `value * 2`.
    *   Else:
        *   **SLIDE**: Move tile to `farthest`.

### 🧮 Logarithmic Spawn Difficulty
Standard RNG (Random Number Generation) feels unfair. We implemented a **Difficulty Scalar**:

$$ D = \min( \log_{10}(\text{Score} + \text{MaxTile} \times 20), 7 ) $$

*   **Implementation**: `getSpawnValue(difficulty, score)` in `gameEngine.ts`.
*   **Result**: Weights for spawning [2, 4, 8, 16] change dynamically.
    *   Score 0 → D=1.0 → 95% chance of `2`.
    *   Score 10k → D=4.0 → `4` becomes the "base" tile (50% chance).
    *   Score 100k → D=5.0 → `16` starts appearing to punish the player.

---

## 2. Challenges & Solutions

### Challenge 1: Mobile "Jank" & Lag 🐢
**The Problem**: React re-renders were too slow (16ms+) on older phones when animating 36 tiles (6x6 grid) simultaneously.
**The Fix**:
*   **React.memo**: We explicitly memoized the `Tile` component. It *only* re-renders if its specific `value` or `position` changes.
*   **CSS vs JS Animations**: We removed heavy Framer Motion keyframes for the "wiggle" and "pulse" effects and replaced them with **native CSS animations**.
*   **Containment**: Added `contain: layout style` to the board container. This tells the browser "changes inside this box won't affect the outer page layout," saving massive recalculations.
*   **Will-Change**: Added `will-change: transform` to tiles, promoting them to their own GPU layers.

### Challenge 2: Touch Sensitivity vs Scrolling 👆
**The Problem**: Swiping to move tiles would sometimes scroll the page, or clicking a button would trigger a game move.
**The Fix**:
*   **Passive Listeners**: Used `touch-action: none` in CSS to disable browser scrolling on the board.
*   **Thresholding**: Implemented a 50px swipe threshold in `useSwipe.ts`. Move < 50px? Ignored (prevents accidental jitters).
*   **Vector Analysis**: We calculate `Math.abs(deltaX)` vs `Math.abs(deltaY)` to lock the swipe axis (Horizontal or Vertical).

### Challenge 3: Hydration Mismatch 💧
**The Problem**: Next.js server-side rendering (SSR) would generate random IDs for tiles, which didn't match the client-side IDs, causing "Text content does not match" errors.
**The Fix**:
*   **useEffect Loader**: We force the game to remain in an `isLoading` state until the component mounts on the client. Only then do we generate IDs and render the board.

---

## 3. Optimizations Implemented

| Optimization | Impact | Description |
| :--- | :--- | :--- |
| **Debounced Resize** | ⚡ High | `useBoardSize` waits 100ms after window resize to recalculate math. Prevents layout thrashing. |
| **RequestIdleCallback** | ⚡ Medium | Saving to `localStorage` happens during browser idle time, never blocking the animation frame. |
| **CSS Variables** | 🎨 High | Theming (Dark/Light) is handled by CSS variables (`--bg-color`), not Javascript state. Prevents full-app re-renders on theme switch. |
| **Unique IDs** | 🛡️ Critical | Tile IDs use `Date.now() + Random`. React uses these as list `key` props to track movement efficiently without destroying DOM nodes. |

---

## 4. Responsiveness Logic 📱

Responsive design here isn't just media queries; it's **Javascript-controlled geometry**.

**The Formula**:
```typescript
BoardWidth = Math.min(ScreenWidth - 32px, MaxWidth)
Gap = BoardWidth * (GridSizeScalingFactor)
CellSize = (BoardWidth - (Gap * (GridSize + 1))) / GridSize
```

*   **Why use JS?**: CSS `fr` units cause sub-pixel rendering (e.g., 100.33px) which makes tiles blurry or misaligned by 1px.
*   **Our Solution**: `useBoardSize` calculates exact integer pixels for perfect sharpness on all screens.
*   **Max Widths**:
    *   Easy (4x4): 520px
    *   Medium (5x5): 560px
    *   Hard (6x6): 600px

---

## 5. Room for Improvement (Future Roadmap)

1.  **Web Workers for AI**:
    *   Implementing an "Auto-Play" bot would block the main thread. We should offload the Minimax algorithm to a Web Worker.
2.  **Server-Side Leaderboards**:
    *   Currently, high scores are local. Moving to Supabase/Firebase would enable global competition.
3.  **Undo History Stack**:
    *   Currently, `undo` only saves 1 state. Using a Linked List or Stack data structure would allow infinite undo (if we wanted to allow that).
4.  **Asset Preloading**:
    *   The font is optimized, but preloading sound effects (if added) would be crucial for low-latency audio feedback.

---

## 6. How to Build & Run

```bash
# Install dependencies
npm install

# Run development server with TurboPack
npm run dev

# Build for production (analyzes bundle size)
npm run build
```

This project represents a modern, optimized approach to browser-based gaming, balancing React's declarative nature with raw performance optimizations usually found in canvas games.
