import React from 'react'

export default function Overlay({ playState, setPlayState }) {
    return (
        <div className="overlay">
            <button
                type="button"
                className="play-button"
                onClick={() => setPlayState(prev => !prev)}
                title={playState ? "Pause" : "Play"}
                aria-label={playState ? 'Pause audio' : 'Play audio'}
                aria-pressed={playState}
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
            </button>
        </div>
    )
}
