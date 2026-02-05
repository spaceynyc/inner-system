import React, { useEffect, useRef } from 'react'
import { Scroll } from '@react-three/drei'
import { scrollState } from '../scrollState'

const TOTAL_SECTIONS = 4

function AnimatedSection({ index, children, className, style }) {
    const ref = useRef()

    useEffect(() => {
        let rafId
        function animate() {
            if (ref.current) {
                const center = (index + 0.5) / TOTAL_SECTIONS
                const dist = Math.abs(scrollState.offset - center)
                const opacity = Math.max(0, 1 - dist * 3.5)
                const ty = (1 - opacity) * 40

                ref.current.style.opacity = opacity
                ref.current.style.transform = `translateY(${ty}px)`
            }
            rafId = requestAnimationFrame(animate)
        }
        animate()
        return () => cancelAnimationFrame(rafId)
    }, [index])

    return (
        <section
            ref={ref}
            className={`content-section ${className || ''}`}
            style={{ top: `${index * 100}vh`, ...style }}
        >
            {children}
        </section>
    )
}

export default function ScrollContent() {
    return (
        <Scroll html>
            <div className="scroll-content">
                {/* Section 0: Intro */}
                <AnimatedSection index={0} className="section-intro">
                    <div className="content-card">
                        <p className="section-description intro-tagline">
                            Sound becomes form. Light becomes feeling.
                        </p>
                        <div className="scroll-indicator">
                            <span className="scroll-text">SCROLL</span>
                            <svg className="scroll-arrow" viewBox="0 0 24 24">
                                <path d="M12 4v16M12 20l-4-4M12 20l4-4" />
                            </svg>
                        </div>
                    </div>
                </AnimatedSection>

                {/* Section 1: Explore */}
                <AnimatedSection index={1} className="section-explore">
                    <div className="content-card">
                        <span className="section-label">01 / EXPLORE</span>
                        <h2 className="section-heading">Listen with your eyes</h2>
                        <p className="section-description">
                            Every frequency paints the glass. Bass bends the surface,
                            highs sharpen the edge. The shape breathes with the sound.
                        </p>
                        <span className="section-cta">
                            Press play and watch it respond
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </span>
                    </div>
                </AnimatedSection>

                {/* Section 2: Discover */}
                <AnimatedSection index={2} className="section-discover">
                    <div className="content-card">
                        <span className="section-label">02 / DISCOVER</span>
                        <h2 className="section-heading">Three forms. One system.</h2>
                        <p className="section-description">
                            Icosahedron. Dodecahedron. Octahedron. Each geometry
                            refracts the sound differently. Click the shape to shift between states.
                        </p>
                        <span className="section-cta">
                            Click the shape to transform it
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </span>
                    </div>
                </AnimatedSection>

                {/* Section 3: Transcend */}
                <AnimatedSection index={3} className="section-transcend">
                    <div className="content-card">
                        <span className="section-label">03 / TRANSCEND</span>
                        <h2 className="section-heading">Beyond the surface</h2>
                        <p className="section-description">
                            Transmission. Refraction. Chromatic aberration.
                            The glass responds to every beat, every frequency, every touch.
                        </p>
                        <span className="section-cta section-cta-final">
                            Scroll back up to begin again
                        </span>
                    </div>
                </AnimatedSection>
            </div>
        </Scroll>
    )
}
