// Shared control bus so DOM buttons (overlay, scroll cards) can drive scene actions
// owned by React state in App and by refs inside the R3F tree.
export const controls = {
    play: null,     // () => void — start playback (registered by App)
    morph: null,    // () => void — cycle the glass form (registered by GlassShape)
    announce: null  // (message: string) => void — screen-reader status line (registered by Overlay)
}

export function requestPlay() {
    controls.play?.()
}

export function requestMorph() {
    controls.morph?.()
}

export function announce(message) {
    controls.announce?.(message)
}
