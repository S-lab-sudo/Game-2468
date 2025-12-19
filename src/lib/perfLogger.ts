// Performance logging utility for debugging mobile lag
// Enable/disable via localStorage: localStorage.setItem('PERF_DEBUG', 'true')

const IS_BROWSER = typeof window !== 'undefined';
const IS_DEV = process.env.NODE_ENV === 'development';

// Check if performance debugging is enabled
function isEnabled(): boolean {
    if (!IS_BROWSER) return false;
    return IS_DEV && localStorage.getItem('PERF_DEBUG') === 'true';
}

// Color codes for different log types
const COLORS = {
    render: '#4CAF50',    // Green - component renders
    animation: '#2196F3', // Blue - animations
    state: '#FF9800',     // Orange - state changes
    event: '#9C27B0',     // Purple - user events
    timer: '#F44336',     // Red - timing measurements
} as const;

type LogType = keyof typeof COLORS;

// Performance timers storage
const timers: Map<string, number> = new Map();

/**
 * Log a performance event with timing
 */
export function perfLog(type: LogType, message: string, data?: unknown): void {
    if (!isEnabled()) return;

    const timestamp = performance.now().toFixed(2);
    const color = COLORS[type];

    console.log(
        `%c[PERF ${type.toUpperCase()}] ${timestamp}ms%c ${message}`,
        `color: ${color}; font-weight: bold;`,
        'color: inherit;',
        data ?? ''
    );
}

/**
 * Start a performance timer
 */
export function perfStart(label: string): void {
    if (!isEnabled()) return;
    timers.set(label, performance.now());
}

/**
 * End a performance timer and log the duration
 */
export function perfEnd(label: string, warnThreshold = 16): void {
    if (!isEnabled()) return;

    const start = timers.get(label);
    if (start === undefined) {
        console.warn(`[PERF] Timer "${label}" was never started`);
        return;
    }

    const duration = performance.now() - start;
    timers.delete(label);

    // Warn if operation took longer than threshold (default 16ms = 1 frame at 60fps)
    const isWarning = duration > warnThreshold;

    console.log(
        `%c[PERF TIMER] %c${label}%c took %c${duration.toFixed(2)}ms`,
        `color: ${COLORS.timer}; font-weight: bold;`,
        'color: inherit; font-weight: bold;',
        'color: inherit;',
        isWarning ? 'color: red; font-weight: bold;' : 'color: green;'
    );
}

/**
 * Track component renders
 */
export function perfRender(componentName: string, props?: Record<string, unknown>): void {
    if (!isEnabled()) return;

    const propsStr = props
        ? Object.entries(props)
            .map(([k, v]) => `${k}=${typeof v === 'object' ? '[obj]' : v}`)
            .join(', ')
        : '';

    perfLog('render', `<${componentName}> ${propsStr}`);
}

/**
 * Log state changes
 */
export function perfState(hookName: string, action: string, data?: unknown): void {
    perfLog('state', `[${hookName}] ${action}`, data);
}

/**
 * Log animation events
 */
export function perfAnimation(element: string, event: string): void {
    perfLog('animation', `${element} - ${event}`);
}

/**
 * Log user events
 */
export function perfEvent(event: string, details?: string): void {
    perfLog('event', `${event}${details ? ` - ${details}` : ''}`);
}

/**
 * Enable performance debugging (call in browser console)
 */
export function enablePerfDebug(): void {
    if (IS_BROWSER) {
        localStorage.setItem('PERF_DEBUG', 'true');
        console.log('%c[PERF] Performance debugging ENABLED. Refresh the page.', 'color: green; font-weight: bold;');
    }
}

/**
 * Disable performance debugging
 */
export function disablePerfDebug(): void {
    if (IS_BROWSER) {
        localStorage.removeItem('PERF_DEBUG');
        console.log('%c[PERF] Performance debugging DISABLED.', 'color: red; font-weight: bold;');
    }
}

// Expose to window for easy console access
if (IS_BROWSER) {
    (window as unknown as { enablePerfDebug: () => void; disablePerfDebug: () => void }).enablePerfDebug = enablePerfDebug;
    (window as unknown as { enablePerfDebug: () => void; disablePerfDebug: () => void }).disablePerfDebug = disablePerfDebug;
}
