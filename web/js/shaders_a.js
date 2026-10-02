// Scenes A: burning sky over churning water, the eye / hills-have-eyes, reaction–diffusion plague.
window.SH = window.SH || {};

// ---------------------------------------------------------------------------- SKY
// uCue.x sun flare, uCue.y build, uCue.z trefoil rotation, uCue.w churn; uCue2.x alarm
SH.sky = SH.common + `
vec4 sunLayer(vec2 p, float px){
  float R = .27 * (1. + .05 * uKick + .22 * uCue.x);
  vec2 sp = p - vec2(0., .2);
  float r = length(sp);
  float sy = (sp.y + R) / (2. * R);
  vec3 c = mix(vec3(1., .06, .55), vec3(1., .95, .15), smoothstep(.1, .95, sy));
  float gap = sat((.56 - sy) / .56) * .8;
  float slit = step(fract(sy * 11. + uTime * .35), gap) * step(sy, .56);
  float m = aa(r - R, px) * (1. - slit);
  float s = R * .78;
  float tr = trefoilD(rot(uCue.z) * sp / s) * s;
  c = mix(c, vec3(.07, 0., .1), aa(tr, px) * .93);
  c += vec3(1., .7, .3) * exp(-abs(r - R) * 90.) * .6;
  return vec4(c, m);
}

vec3 skyCol(vec2 p, float px){
  float y = p.y;
  vec3 col = mix(vec3(1., .32, .08), vec3(.62, 0., .5), smoothstep(0., .22, y));
  col = mix(col, vec3(.07, 0., .16), smoothstep(.18, .78, y));
  vec2 sp = p - vec2(0., .2);
  float r = length(sp);
  float R = .27 * (1. + .05 * uKick + .22 * uCue.x);
  float sv = spec(.04 + .9 * abs(atan(sp.x, sp.y)) / PI);
  float rays = pow(sv, 2.2) * exp(-max(r - R, 0.) * 2.4) * step(R, r) * (.55 + .45 * cos(atan(sp.y, sp.x) * 90.));
  float glow = exp(-max(r - R, 0.) * 5.) * (.5 + .6 * uLow);
  col += (MAG * glow + mix(ORNG, YEL, sv) * rays * 1.4) * (1. + uCue.x * 2.5);
  vec4 sun = sunLayer(p, px);
  col = mix(col, sun.rgb * 1.6, sun.a);
  // burning, domain-warped cloud band
  float spd = 1. + uCue.y * 2.2;
  vec2 q = p * vec2(1.2, 3.) + vec2(uTime * .03, 0.);
  vec2 w1 = vec2(fbm(q * 1.5 + vec2(0., -uTime * .2 * spd)), fbm(q * 1.5 + vec2(5.2, 1.3) + uTime * .12));
  float n = fbm(q * 2.2 + 2.6 * w1 + vec2(0., -uTime * .45 * spd));
  float band = smoothstep(.02, .3, y) * (1. - smoothstep(.55, .95, y));
  float cl = smoothstep(.42, .8, n) * band;
  vec3 cc = acid(n * 1.2 + w1.x * .7 + uTime * .02 + .1) * (.45 + n);
  col = mix(col, cc, cl * .8);
  float burn = pow(sat((n - .5) * 2.4), 3.) * band;
  col += mix(ORNG, YEL, n) * burn * (1.4 + 3. * uCue.y + 1.5 * uKick);
  return col;
}

vec3 water(vec2 p, float px){
  float z = .32 / max(-p.y, .002);
  vec2 wp = vec2(p.x * z, z + uTime * 2.4 * (1. + uCue.y));
  float churn = .35 + uCue.w * .9 + uLow * .3;
  float e = .15;
  vec2 q = wp * .28 + vec2(uTime * .1 * churn, uTime * .15);
  float h0 = fbm(q), hx = fbm(q + vec2(e, 0.)), hz = fbm(q + vec2(0., e));
  vec2 g = vec2(hx - h0, hz - h0) / e * churn;
  vec2 rp = vec2(p.x + g.x * .07, -p.y * (1. + g.y * .9) + .004);
  vec3 refl = skyCol(rp, px);
  float fres = .3 + .7 * pow(1. - sat(-p.y * 3.), 3.);
  vec3 col = refl * fres * vec3(.8, .85, 1.);
  vec2 gp = wp * .5 + g * .45;
  vec2 gl = abs(fract(gp) - .5) / max(fwidth(gp), 1e-4);
  float line = 1. - min(min(gl.x, gl.y), 1.);
  float fade = exp(-z * .05);
  float roll = exp(-abs(fract(gp.y * .25 - uBeat * .5) - .5) * 14.);
  col += mix(TOXIC, CYAN, sat(g.x * 2. + .5)) * line * fade * (.3 + 1.2 * uBeatPulse + roll * .8);
  col = mix(col, vec3(1., .3, .1) * .55, 1. - exp(-z * .018));
  return col;
}

vec3 embers(vec2 p){
  vec3 c = vec3(0.);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float sc = 9. + fi * 7.;
    vec2 q = p * sc + vec2(fi * 3.1, -uTime * (.6 + fi * .25) * sc * .12);
    vec2 id = floor(q); vec2 f = fract(q) - .5;
    vec2 r = hv2(id + fi * 17.);
    if (r.x > .86){
      vec2 o = (r - .5) * .6 + .15 * vec2(sin(uTime * 2. + r.y * 9.), 0.);
      float d = length(f - o);
      c += mix(ORNG, YEL, r.y) * exp(-d * d * 260.) * (.6 + .9 * uBeatPulse);
    }
  }
  return c;
}

void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  p += (vec2(h1(uTime * 60.), h1(uTime * 60. + 7.)) - .5) * .012 * uCue2.x;
  p /= 1. + .025 * uKick;
  p.y += .06;
  vec3 col = p.y > 0. ? skyCol(p, px) : water(p, px);
  col += vec3(1., .45, .2) * exp(-abs(p.y) * 90.) * .9;
  col += embers(p);
  col = mix(col, col * vec3(1.5, .25, .3), uCue2.x * (.5 + .5 * cos(uBeat * TAU)));
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- EYE
// uCue.xy look, uCue.z lid openness, uCue.w pupil dilation
// uCue2.x vortex twist, uCue2.y hills mix, uCue2.z toxification, uCue2.w hills clock
// uCue3.x zoom
SH.eye = SH.common + `
vec4 eyeShade(vec2 q, float open, vec2 look, float seed, float dil, float tox, float px){
  float h = max(.62 * open, .002);
  float R = (1. + h * h) / (2. * h);
  float dU = length(q - vec2(0., h - R)) - R;
  float dL = length(q - vec2(0., R - h)) - R;
  float d = max(dU, dL);
  float m = aa(d, px);
  vec3 rim = mix(MAG, TOXIC, tox) * exp(-abs(d) * 55.) * 1.5 * step(.01, open);
  if (d > .08) return vec4(rim, 0.);
  float vein = pow(ridge(q * 2.3 + seed * 7.), 10.);
  vec3 scl = vec3(.04, .02, .06) + mix(vec3(.95, .05, .15), TOXIC, tox) * vein * (.35 + .6 * tox) * smoothstep(.15, 1., length(q));
  vec2 iq = q - look * vec2(.38, .22);
  float r = length(iq);
  float ir = .47, pr = .12 + dil * .14;
  vec2 dir = iq / max(r, 1e-4);
  float fib = fbm(dir * 5.5 + seed * 3.1 + vec2(r * 1.3, 0.));
  float strands = vn(dir * 38. + seed * 11.) * .55;
  vec3 ic = acid(r * 1.1 + fib * .9 + seed + uTime * .04);
  ic = mix(ic, TOXIC * 1.2, tox * .7);
  ic *= .45 + strands + .6 * fib;
  ic *= smoothstep(ir, ir * .75, r) * .8 + .22;
  ic += MAG * exp(-abs(r - pr * 1.75) * 40.) * .8;
  float irisM = aa(r - ir, px);
  float pd = mix(r - pr, trefoilD(rot(uTime * .5) * iq / (pr * 1.7)) * pr * 1.7, tox);
  float pupM = aa(pd, px);
  vec3 col = mix(scl, ic, irisM);
  col = mix(col, vec3(0.), pupM);
  col += (CYAN * .6 + MAG * .4) * exp(-abs(pd) * 110.) * .9 * irisM;
  vec2 cl = iq - vec2(-.16, .15);
  col += vec3(1.) * aa(length(cl * vec2(1., 1.4)) - .045, px) * .9 * irisM;
  col *= smoothstep(0., -.14, d) * .7 + .3;
  return vec4(col * m + rim, m);
}

vec3 eyeBG(vec2 p){
  float r = length(p), a = atan(p.y, p.x);
  vec3 c = vec3(.02, 0., .05) + UVC * .1 * sat(1.4 - r);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float rr = 1.16 + fi * .15;
    float n = 48. + fi * 24.;
    float ticks = step(.55, fract((a + uBeat * .1309 * (fi - 1.)) / TAU * n));
    c += mix(CYAN, MAG, fi * .5) * exp(-abs(r - rr) * 260.) * (.35 + .65 * ticks);
  }
  float wv = wave(fract(a / TAU + .5));
  c += TOXIC * exp(-abs(r - (1.04 + wv * .09 * (.5 + uRms))) * 200.) * 1.3;
  float scan = fract(-a / TAU + uTime * .25);
  c += TOXIC * .25 * pow(scan, 14.) * smoothstep(1.7, .4, r);
  // particles pulled into the pupil
  if (uCue2.x > .01){
    float lr = log(max(r, 1e-3));
    vec2 g = vec2(a / TAU * 36., lr * 7. + uTime * 3.5 * (.5 + uCue2.x));
    vec2 id = floor(g), f = fract(g) - .5;
    float hh = h2(id);
    c += mix(MAG, YEL, hh) * step(.8, hh) * exp(-dot(f, f) * 40.) * sat(uCue2.x) * 1.5;
  }
  return c;
}

vec2 lookFor(float seed){
  float b = floor(uBeat);
  vec2 j = vec2(h1(b * 3. + seed * 91.), h1(b * 5. + seed * 37.)) - .5;
  return uCue.xy * .5 + j * .9;
}

vec3 hills(vec2 p, float px){
  vec3 c = mix(vec3(.5, 0., .38), vec3(.06, 0., .14), smoothstep(-.3, .5, p.y));
  c += MAG * .3 * exp(-abs(p.y - .1) * 4.);
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = .1 + fl * .065;
    float base = .22 - fl * .27;
    float f1 = 2.2 - fl * .4;
    float ridgeY = base + .08 * sin(p.x * f1 + fl * 2.) + .05 * sin(p.x * 5.3 + fl);
    float inHill = aa(p.y - ridgeY, px);
    c = mix(c, vec3(.03, 0., .06) + UVC * .05 * fl, inHill);
    c += mix(MAG, TOXIC, fl * .5) * exp(-abs(p.y - ridgeY) * 150.) * 1.1;
    float spc = sc * 3.1;
    float cx = floor(p.x / spc);
    for (int k = -1; k <= 1; k++){
      float cid = cx + float(k);
      float ex = (cid + .5) * spc + (h1(cid * 3. + fl * 50.) - .5) * spc * .3;
      float ey = base + .08 * sin(ex * f1 + fl * 2.) + .05 * sin(ex * 5.3 + fl) - sc * 1.05 - h1(cid + fl * 9.) * sc * .8;
      vec2 q = (p - vec2(ex, ey)) / sc;
      if (abs(q.x) > 1.35 || abs(q.y) > 1.1) continue;
      float seed = h1(cid * 7. + fl * 13.);
      float op = sat((uCue2.w - seed * .7 - (2. - fl) * .2) * 4.);
      float bl = step(.94, h1(floor(uBeat) + seed * 71.)) * (1. - uBeatPulse);
      vec4 e = eyeShade(q, op * (1. - bl * .9), lookFor(seed), seed, .25 + uKick * .3, uCue2.z, px / sc);
      c = c * (1. - e.a) + e.rgb;
    }
  }
  return c;
}

void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  p /= 1. + .07 * uKick + uCue3.x;
  float r = length(p);
  p = rot(uCue2.x * 2.2 * exp(-r * 1.6)) * p;
  vec3 col = vec3(0.);
  if (uCue2.y < .999){
    float s = .6;
    vec3 bg = eyeBG(p / s);
    vec4 e = eyeShade(p / s, uCue.z, uCue.xy, .37, uCue.w, uCue2.z, px / s);
    col = bg * (1. - e.a) + e.rgb;
  }
  if (uCue2.y > .001) col = mix(col, hills(p * 1.1, px * 1.1), uCue2.y);
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- GRAY–SCOTT SIM
SH.sim = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uState;
uniform sampler2D uText;
uniform vec2 uSimRes;
uniform float uF, uK, uDt, uReset, uTextSeed, uDrift;
uniform vec4 uSeeds[6];
void main(){
  vec2 e = 1. / uSimRes;
  vec2 uv = vUv + vec2(0., uDrift * e.y);
  vec2 c = texture(uState, uv).xy;
  vec2 lap = -c
    + .2 * (texture(uState, uv + vec2(e.x, 0.)).xy + texture(uState, uv - vec2(e.x, 0.)).xy
          + texture(uState, uv + vec2(0., e.y)).xy + texture(uState, uv - vec2(0., e.y)).xy)
    + .05 * (texture(uState, uv + e).xy + texture(uState, uv - e).xy
           + texture(uState, uv + vec2(e.x, -e.y)).xy + texture(uState, uv + vec2(-e.x, e.y)).xy);
  float A = c.x, B = c.y;
  float r = A * B * B;
  A += (1.0 * lap.x - r + uF * (1. - A)) * uDt;
  B += (.5 * lap.y + r - (uK + uF) * B) * uDt;
  float asp = uSimRes.x / uSimRes.y;
  for (int i = 0; i < 6; i++){
    vec4 s = uSeeds[i];
    if (s.z > 0.){
      vec2 d = (vUv - s.xy) * vec2(asp, 1.);
      if (length(d) < s.z) { B = max(B, s.w); A = min(A, .5); }
    }
  }
  if (uTextSeed > 0.){
    float m = texture(uText, vUv).a;
    if (m > .5) { B = max(B, uTextSeed); }
  }
  if (uReset > .5){ A = 1.; B = 0.; }
  fragColor = vec4(clamp(A, 0., 1.), clamp(B, 0., 1.), 0., 1.);
}`;

// ---------------------------------------------------------------------------- PLAGUE (display of the sim)
// uCue.x palette offset, uCue.y darkness (quiet variant), uCue.z zoom, uCue.w lab-HUD amount
SH.plague = SH.common + `
void main(){
  vec2 uv = vUv;
  vec2 c = uv - .5;
  c /= 1. + .05 * uKick + uCue.z;
  uv = c + .5;
  vec2 e = 1. / uSimRes;
  float B = texture(uSim, uv).y;
  float bx = texture(uSim, uv + vec2(e.x, 0.)).y - texture(uSim, uv - vec2(e.x, 0.)).y;
  float by = texture(uSim, uv + vec2(0., e.y)).y - texture(uSim, uv - vec2(0., e.y)).y;
  vec3 n = normalize(vec3(-bx * 7., -by * 7., 1.));
  vec3 L = normalize(vec3(-.45, .55, .75));
  float dif = max(dot(n, L), 0.);
  float sp = pow(max(dot(reflect(-L, n), vec3(0., 0., 1.)), 0.), 36.);
  float body = smoothstep(.12, .32, B);
  vec3 base = acid(B * 2.2 + uTime * .05 + uv.x * .35 + uCue.x);
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 bg = vec3(.02, 0., .05) + UVC * .06 * (1. - length(p));
  vec2 gp = gl_FragCoord.xy / (uRes.y / 12.);
  vec2 gl = abs(fract(gp) - .5) / fwidth(gp);
  bg += CYAN * .12 * (1. - min(min(gl.x, gl.y), 1.)) * uCue.w;
  vec3 col = mix(bg, base * (.25 + 1.1 * dif), body);
  col += vec3(1.) * sp * body * .9;
  float edge = exp(-abs(B - .2) * 30.) * (1. - body * .6);
  col += TOXIC * edge * (.7 + 1.3 * uBeatPulse);
  col = mix(col, col * .35, uCue.y);
  // petri-dish ring
  float r = length(p);
  col += CYAN * exp(-abs(r - .47) * 300.) * .5 * uCue.w;
  fragColor = vec4(col, 1.);
}`;
