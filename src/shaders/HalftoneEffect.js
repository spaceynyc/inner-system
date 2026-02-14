import { Effect } from 'postprocessing'
import { Uniform, Vector2 } from 'three'

const fragmentShader = /* glsl */ `
uniform float uGridSize;
uniform float uRadius;
uniform float uSoftness;
uniform float uMode;
uniform float uStagger;
uniform float uColorMode;
uniform vec2 uResolution;
uniform float uIntensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Aspect-correct cell size
    float aspect = uResolution.x / uResolution.y;
    vec2 cellSize = vec2(uGridSize / uResolution.x, uGridSize / uResolution.y);

    // Staggered (honeycomb) grid
    vec2 coord = uv;
    float rowIndex = floor(coord.y / cellSize.y);
    if (uStagger > 0.5 && mod(rowIndex, 2.0) == 1.0) {
        coord.x += cellSize.x * 0.5;
    }

    // Snap to cell center for color sampling
    vec2 cellUV = floor(coord / cellSize) * cellSize + cellSize * 0.5;
    vec4 sampled = texture2D(inputBuffer, cellUV);

    // Luma
    float luma = dot(vec3(0.2126, 0.7152, 0.0722), sampled.rgb);

    // Position within cell (0-1)
    vec2 cellPos = fract(coord / cellSize);
    float dist = length(cellPos - 0.5);

    // Luma-driven radius: brighter = larger dots
    float r = uRadius * luma;

    // Color to use
    vec3 dotColor = uColorMode > 0.5 ? vec3(luma) : sampled.rgb;

    float mask = 0.0;
    int mode = int(uMode + 0.5);

    if (mode == 0) {
        // Dot mode
        mask = 1.0 - smoothstep(r - uSoftness, r + uSoftness, dist);
    } else if (mode == 1) {
        // Ring mode
        float innerR = r * 0.5;
        float outer = 1.0 - smoothstep(r - uSoftness, r + uSoftness, dist);
        float inner = 1.0 - smoothstep(innerR - uSoftness, innerR + uSoftness, dist);
        mask = outer - inner;
    } else {
        // Dot + square hybrid
        if (luma < 0.4) {
            // Dark areas: colored square with white dot cutout
            float dotMask = 1.0 - smoothstep(r - uSoftness, r + uSoftness, dist);
            vec3 squareColor = dotColor;
            vec3 result = mix(squareColor, vec3(0.0), dotMask);
            outputColor = mix(inputColor, vec4(result, 1.0), uIntensity);
            return;
        } else {
            mask = 1.0 - smoothstep(r - uSoftness, r + uSoftness, dist);
        }
    }

    vec3 halftoned = dotColor * mask;
    outputColor = mix(inputColor, vec4(halftoned, inputColor.a), uIntensity);
}
`

export class HalftoneEffect extends Effect {
    constructor({
        gridSize = 48.0,
        radius = 0.4,
        softness = 0.02,
        mode = 0,
        stagger = true,
        colorMode = 0,
    } = {}) {
        super('HalftoneEffect', fragmentShader, {
            uniforms: new Map([
                ['uGridSize', new Uniform(gridSize)],
                ['uRadius', new Uniform(radius)],
                ['uSoftness', new Uniform(softness)],
                ['uMode', new Uniform(mode)],
                ['uStagger', new Uniform(stagger ? 1.0 : 0.0)],
                ['uColorMode', new Uniform(colorMode)],
                ['uResolution', new Uniform(new Vector2(1, 1))],
                ['uIntensity', new Uniform(1.0)],
            ]),
        })
    }
}
