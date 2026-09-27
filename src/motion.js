// Single source of truth for the user's motion preference. The WebGL scene and
// the DOM both read it so "reduce motion" stops the idle animation everywhere,
// not just the CSS keyframes.
const query = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null

export const motionState = {
    reduce: query ? query.matches : false
}

if (query) {
    const update = (event) => { motionState.reduce = event.matches }
    if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', update)
    } else if (typeof query.addListener === 'function') {
        query.addListener(update)
    }
}

export function prefersReducedMotion() {
    return motionState.reduce
}
