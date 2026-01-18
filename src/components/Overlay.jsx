import React from 'react'

export default function Overlay({ playState, setPlayState }) {
    return (
        <div className="overlay">
            {/* Scroll indicator */}
            <div className="scroll-indicator">
                <span className="scroll-text">SCROLL</span>
                <svg className="scroll-arrow" viewBox="0 0 24 24">
                    <path d="M12 4v16M12 20l-4-4M12 20l4-4" />
                </svg>
            </div>

            <div
                className="play-button"
                onClick={() => setPlayState(!playState)}
                title={playState ? "Pause" : "Play"}
            >
                {playState ? (
                    <svg className="play-icon" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                    </svg>
                ) : (
                    <svg className="play-icon" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                )}
            </div>
        </div>
    )
}
