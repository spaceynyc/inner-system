precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uAverage;
uniform float uScroll;
uniform vec2 uResolution;
uniform float uDetail;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p, float octaves) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);

  for (int i = 0; i < 7; i++) {
    if (float(i) >= octaves) break;
    v += a * noise(p);
    p = rot(0.45) * p * 2.02 + shift;
    a *= 0.52;
  }

  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);

  float t = uTime * (0.08 + uBass * 0.08);
  float bassPulse = smoothstep(0.0, 1.0, uBass);

  float complexity = mix(2.8, 6.5, clamp(uScroll, 0.0, 1.0));
  complexity = min(complexity, uDetail);

  vec2 flow = vec2(
    fbm(p * 1.6 + vec2(t * 0.5, -t * 0.2), complexity),
    fbm(p * 1.6 + vec2(-t * 0.3, t * 0.45), complexity)
  );

  vec2 tendrilUv = p * (1.4 + uScroll * 1.6) + flow * (0.9 + bassPulse * 0.7);

  float nebula = fbm(tendrilUv + vec2(t * 0.7, -t * 0.35), complexity);
  float smoke = fbm(tendrilUv * 1.8 - vec2(t * 0.2, t * 0.4), max(2.0, complexity - 1.2));

  float radial = length(p);
  float core = smoothstep(1.45, 0.05, radial + (nebula - 0.5) * 0.7);

  float shimmer = fbm(p * 8.0 + flow * 3.0 + uTime * (0.35 + uHigh * 0.6), min(uDetail, 4.0));
  shimmer = pow(shimmer, 2.4) * (0.16 + uHigh * 0.55);

  vec3 deepPurple = vec3(0.05, 0.02, 0.15);
  vec3 purple = vec3(0.22, 0.08, 0.45);
  vec3 cyan = vec3(0.07, 0.48, 0.75);
  vec3 warm = vec3(0.95, 0.35, 0.14);

  float colorMix = clamp(nebula * 0.9 + smoke * 0.35 + uMid * 0.35, 0.0, 1.0);
  vec3 base = mix(deepPurple, purple, colorMix);
  vec3 cool = mix(base, cyan, clamp(smoke + uHigh * 0.6, 0.0, 1.0));

  float bassFlash = smoothstep(0.35, 1.0, uBass) * (0.15 + uAverage * 0.28);
  vec3 color = mix(cool, warm, bassFlash * (0.6 + core * 0.4));

  float density = clamp(core * (0.55 + nebula * 0.8) + smoke * 0.25, 0.0, 1.0);
  float vignette = smoothstep(1.35, 0.25, radial);

  vec3 finalColor = color * density * vignette;
  finalColor += shimmer * (0.6 + uScroll * 0.4);
  finalColor *= 0.9 + uAverage * 0.3;

  gl_FragColor = vec4(finalColor, 1.0);
}
