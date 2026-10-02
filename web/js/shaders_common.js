// Shared GLSL: uniforms every scene receives, hashing, noise, palette and small SDF helpers.
window.SH = window.SH || {};
SH.common = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;                 // song time, seconds
uniform float uBeat, uBar;           // continuous beat / bar index on the 170 BPM grid
uniform float uSecT, uSecP;          // seconds into section, 0..1 progress
uniform float uKick, uSnare, uHat, uAcc;   // decaying drum-hit envelopes
uniform float uLow, uMid, uHigh, uRms, uFlux;
uniform float uBeatPulse, uBarPulse;
uniform float uVar, uCut, uEnergy;
uniform vec4 uCue, uCue2, uCue3;
uniform sampler2D uSpec, uWave, uSim, uText;
uniform vec2 uSimRes;

#define PI 3.14159265359
#define TAU 6.28318530718
#define sat(x) clamp(x, 0., 1.)

uint hu(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float hf(uint x){ return float(hu(x) >> 8) / 16777215.0; }
float hi(int i){ return hf(uint(i) * 0x9E3779B9u + 0x2545F491u); }
float hi2(ivec2 i){ return hf(uint(i.x) * 0x8DA6B343u ^ hu(uint(i.y) + 0x68E31DA4u)); }
float hi3(ivec3 i){ return hf(uint(i.x) * 0x8DA6B343u ^ hu(uint(i.y) * 0xD8163841u ^ hu(uint(i.z) + 0xCB1AB31Fu))); }
float h1(float x){ return hi(int(floor(x))); }
float h2(vec2 p){ return hi2(ivec2(floor(p))); }
vec2 hv2(vec2 p){ ivec2 i = ivec2(floor(p)); return vec2(hi2(i), hi2(i + ivec2(1731, -977))); }

float vn(vec2 p){
  ivec2 i = ivec2(floor(p)); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = hi2(i), b = hi2(i + ivec2(1, 0)), c = hi2(i + ivec2(0, 1)), d = hi2(i + ivec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float vn3(vec3 p){
  ivec3 i = ivec3(floor(p)); vec3 f = fract(p);
  vec3 u = f * f * (3. - 2. * f);
  float a = hi3(i), b = hi3(i + ivec3(1,0,0)), c = hi3(i + ivec3(0,1,0)), d = hi3(i + ivec3(1,1,0));
  float e = hi3(i + ivec3(0,0,1)), f2 = hi3(i + ivec3(1,0,1)), g = hi3(i + ivec3(0,1,1)), h = hi3(i + ivec3(1,1,1));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f2, u.x), mix(g, h, u.x), u.y), u.z);
}
const mat2 FBM_M = mat2(1.62, 1.18, -1.18, 1.62);
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = FBM_M * p + vec2(3.1, 1.7); a *= .5; } return s; }
float fbm3(vec3 p){ float s = 0., a = .5; for (int i = 0; i < 4; i++){ s += a * vn3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.3); a *= .5; } return s; }
float ridge(vec2 p){ return 1. - abs(fbm(p) * 2. - 1.); }

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float aa(float d, float px){ return sat(.5 - d / px); }
float smin(float a, float b, float k){ float h = sat(.5 + .5 * (b - a) / k); return mix(b, a, h) - k * h * (1. - h); }
float easeOut(float x){ return 1. - pow(1. - sat(x), 3.); }

// six-stop cyclic acid palette: UV violet > hot magenta > burnt orange > acid yellow > toxic green > cyan
vec3 acid(float x){
  x = fract(x) * 6.; int i = int(x); float f = smoothstep(0., 1., fract(x));
  vec3 a, b;
  if (i == 0){ a = vec3(.40,.02,1.); b = vec3(1.,.02,.62); }
  else if (i == 1){ a = vec3(1.,.02,.62); b = vec3(1.,.38,.02); }
  else if (i == 2){ a = vec3(1.,.38,.02); b = vec3(.86,1.,.02); }
  else if (i == 3){ a = vec3(.86,1.,.02); b = vec3(.22,1.,.08); }
  else if (i == 4){ a = vec3(.22,1.,.08); b = vec3(0.,.9,1.); }
  else { a = vec3(0.,.9,1.); b = vec3(.40,.02,1.); }
  return mix(a, b, f);
}
const vec3 TOXIC = vec3(.30, 1., .08);
const vec3 MAG = vec3(1., .04, .58);
const vec3 UVC = vec3(.42, .06, 1.);
const vec3 CYAN = vec3(0., .88, 1.);
const vec3 YEL = vec3(.92, 1., .08);
const vec3 ORNG = vec3(1., .38, .04);

float spec(float x){ return texture(uSpec, vec2(clamp(x, 0., 1.), .5)).r; }
float wave(float x){ return texture(uWave, vec2(clamp(x, 0., 1.), .5)).r * 2. - 1.; }

// radiation trefoil, outer radius 1 (hub .18, blades .3..1, 60 deg wide)
float trefoilD(vec2 p){
  float r = length(p);
  float a = atan(p.y, p.x) - PI * .5;
  float s = TAU / 3.;
  a = mod(a + s * .5, s) - s * .5;
  vec2 q = r * vec2(cos(a), sin(a));
  float blade = max(max(.3 - r, r - 1.), abs(q.y) * .8660254 - q.x * .5);
  return min(blade, r - .18);
}
float hexD(vec2 p){ p = abs(p); return max(dot(p, vec2(.8660254, .5)), p.y); }
// hex tiling: xy = local coords, zw = cell id
vec4 hexCell(vec2 p){
  const vec2 s = vec2(1., 1.7320508);
  vec4 hc = floor(vec4(p, p - vec2(.5, 1.)) / s.xyxy) + .5;
  vec4 h = vec4(p - hc.xy * s, p - (hc.zw + .5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hc.xy) : vec4(h.zw, hc.zw + .5);
}
float boxD(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float segD(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * sat(dot(pa, ba) / dot(ba, ba))); }
float triD(vec2 p, float r){ // equilateral triangle, point up
  const float k = 1.7320508; p.x = abs(p.x) - r; p.y = p.y + r / k;
  if (p.x + k * p.y > 0.) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.;
  p.x -= clamp(p.x, -2. * r, 0.); return -length(p) * sign(p.y);
}
vec3 hueShift(vec3 c, float a){ // rotate hue around the grey axis
  const vec3 k = vec3(.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca);
}
`;
