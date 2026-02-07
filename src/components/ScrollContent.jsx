import React, { useCallback, useEffect, useRef } from 'react'
import { Scroll } from '@react-three/drei'
import { scrollState } from '../scrollState'

const TOTAL_SECTIONS = 4

function AnimatedSection({ index, children, className, style, registerSection }) {
    return (
        <section
            ref={(node) => registerSection(index, node)}
            className={`content-section ${className || ''}`}
            style={{ top: `${index * 100}vh`, ...style }}
        >
            {children}
        </section>
    )
}

export default function ScrollContent() {
    const sectionRefs = useRef([])
    const lastStyles = useRef([])

    const registerSection = useCallback((index, node) => {
        sectionRefs.current[index] = node
    }, [])

    useEffect(() => {
        let rafId

        const animate = () => {
            const offset = scrollState.offset

            for (let index = 0; index < TOTAL_SECTIONS; index++) {
                const section = sectionRefs.current[index]
                if (!section) continue

                const center = (index + 0.5) / TOTAL_SECTIONS
                const dist = Math.abs(offset - center)
                const opacity = Math.max(0, 1 - dist * 3.5)
                const ty = (1 - opacity) * 40

                const last = lastStyles.current[index]
                if (!last || Math.abs(last.opacity - opacity) > 0.001 || Math.abs(last.ty - ty) > 0.1) {
                    section.style.opacity = String(opacity)
                    section.style.transform = `translateY(${ty}px)`
                    lastStyles.current[index] = { opacity, ty }
                }
            }

            rafId = requestAnimationFrame(animate)
        }

        animate()

        return () => {
            cancelAnimationFrame(rafId)
        }
    }, [])

    return (
        <Scroll html>
            <div className="scroll-content">
                {/* Section 0: Intro */}
                <AnimatedSection index={0} className="section-intro" registerSection={registerSection}>
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
                <AnimatedSection index={1} className="section-explore" registerSection={registerSection}>
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
                <AnimatedSection index={2} className="section-discover" registerSection={registerSection}>
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
                <AnimatedSection index={3} className="section-transcend" registerSection={registerSection}>
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
