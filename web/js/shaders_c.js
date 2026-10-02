// Scenes C: reactor core meltdown, propaganda poster (rap bridge), cult sigil.
window.SH = window.SH || {};

// ---------------------------------------------------------------------------- REACTOR
// uCue.x meltdown 0..1, uCue.y rod phase, uCue.z orbit angle, uCue.w overload
SH.reactor = SH.common + `
float rodH(vec2 id){
  float hh = hi2(ivec2(id * 2.));
  return .35 + .55 * abs(sin(uCue.y * PI * .5 + hh * TAU)) + .15 * hh;
}
float mapR(vec3 p, out float gd, out float capD){
  float dFloor = p.y;
  float dWall = 3.4 - length(p.xz);
  vec4 hc = hexCell(p.xz / .55);
  vec2 lp = hc.xy * .55, id = hc.zw;
  float dRod = 1e3; gd = 1e3; capD = 1e3;
  if (length(id * vec2(.55, .55 * 1.732)) < 2.7){
    float rh = rodH(id);
    float rr = .14;
    dRod = max(length(lp) - rr, p.y - rh);
    gd = length(vec2(max(length(lp) - rr, 0.), max(p.y - rh, 0.)));
    capD = abs(p.y - rh);
  } else {
    dRod = .55 * .45;
  }
  return min(min(dFloor, dWall), dRod);
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  uv /= 1. + .04 * uKick;
  float ang = uCue.z;
  vec3 ro = vec3(sin(ang) * 3.3, 3.1 - uCue.w * .4, cos(ang) * 3.3);
  vec3 ta = vec3(0., .2, 0.);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(vec3(0., 1., 0.), fw)), up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.3 * fw);
  vec3 hot = mix(mix(CYAN, UVC, .35), mix(ORNG, vec3(1., .08, .05), .4), uCue.x);
  float t = .1, d = 1., gd, cd, glow = 0.;
  vec3 p;
  for (int i = 0; i < 100; i++){
    p = ro + rd * t;
    d = mapR(p, gd, cd);
    glow += exp(-gd * 9.) * .03;
    if (d < .002 || t > 14.) break;
    t += d * .8;
  }
  vec3 col = vec3(.01, 0., .02);
  if (d < .01){
    float gd2, cd2;
    vec2 e = vec2(.002, 0.);
    vec3 n = normalize(vec3(mapR(p + e.xyy, gd2, cd2) - mapR(p - e.xyy, gd2, cd2),
                            mapR(p + e.yxy, gd2, cd2) - mapR(p - e.yxy, gd2, cd2),
                            mapR(p + e.yyx, gd2, cd2) - mapR(p - e.yyx, gd2, cd2)));
    float lam = max(dot(n, normalize(vec3(.3, 1., .2))), 0.);
    col = vec3(.06, .05, .09) * (.2 + lam);
    if (p.y < .01){
      vec4 hc = hexCell(p.xz / .55);
      float edge = .5 - hexD(hc.xy);
      col += hot * exp(-edge * 60.) * .5;
      float cr = pow(ridge(p.xz * 1.8 + 7.), 16.) * uCue.x;
      col += mix(ORNG, YEL, .4) * cr * 3.;
    }
    col += hot * exp(-cd * 40.) * (1. + 2. * uBeatPulse);
    col += hot * .15 * pow(1. - max(dot(n, -rd), 0.), 3.);
  }
  col += hot * glow * (.7 + .8 * uLow + 1.5 * uCue.w);
  float fog = fbm(uv * 3. + vec2(uTime * .15, -uTime * .1));
  col += mix(hot, vec3(1.), .5) * .08 * fog * (1. + uCue.x);
  col = mix(col, vec3(.02, 0., .04), 1. - exp(-t * .03));
  col += hot * uCue.w * .6;
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- PROPAGANDA
// uCue.x palette index, uCue.y ray rotation, uCue.z emblem pulse, uCue.w text strength
SH.propaganda = SH.common + `
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  p /= 1. + .05 * uKick;
  vec2 c = p - vec2(0., -.04);
  float a = atan(c.y, c.x) + uCue.y;
  float r = length(c);
  float ray = step(.5, fract(a / TAU * 16.));
  vec3 A = acid(uCue.x * .37), B = acid(uCue.x * .37 + .5);
  vec3 col = mix(B * .18, A * .85, ray);
  col *= smoothstep(1.5, .05, r) * .75 + .25;
  // giant keyword layer, printed with misregistration
  vec2 tuv = vUv + vec2(sin(vUv.y * 40. + uTime * 3.) * .002, 0.);
  float tk = texture(uText, tuv).a;
  float tk2 = texture(uText, tuv + vec2(.005, -.004)).a;
  col = mix(col, vec3(.03, 0., .06), tk2 * uCue.w * .9);
  col = mix(col, mix(YEL, vec3(1.), .2), tk * uCue.w);
  // halftone
  vec2 hp = rot(PI / 4.) * gl_FragCoord.xy / 9.;
  float lum = dot(col, vec3(.3, .59, .11));
  col *= 1. - .4 * step(length(fract(hp) - .5), .55 * sqrt(sat(1. - lum)));
  // emblem: ring, cog teeth, trefoil
  float er = .26 * (1. + .08 * uCue.z);
  float ring = abs(r - er) - .018;
  float teeth = max(abs(r - er - .045) - .03, abs(fract(a / TAU * 20. + uBeat * .125) - .5) - .22);
  vec3 ink = vec3(.96, .92, .82);
  col = mix(col, vec3(.05, 0., .08), aa(r - er, px) * .85);
  col = mix(col, ink, aa(min(ring, teeth), px));
  float tr = trefoilD(rot(floor(uBeat) * PI / 3. + easeOut(fract(uBeat) * 4.) * PI / 3.) * c / (er * .78)) * er * .78;
  col = mix(col, mix(A, YEL, .5), aa(tr, px));
  col += A * exp(-abs(ring) * 80.) * .6;
  // paper grain + print speckle
  col *= .88 + .12 * vn(gl_FragCoord.xy * .8);
  col = mix(col, ink * .9, step(.996, h2(gl_FragCoord.xy * .5 + floor(uTime * 12.))) * .5);
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- CULT
// uCue.x ring rotation, uCue.y impact clock, uCue.z eye openness, uCue.w spiral speed
// uCue2.x bow (figures), uCue2.y sigil build 0..1
SH.cult = SH.common + `
float glyph(vec2 f, float id){
  // 3x5 procedural rune
  ivec2 c = ivec2(floor(f * vec2(3., 5.)));
  if (c.x < 0 || c.y < 0 || c.x > 2 || c.y > 4) return 0.;
  int bit = c.x + c.y * 3;
  uint hsh = hu(uint(id * 131.) + 7u);
  int mx = c.x == 2 ? 0 : c.x;
  bit = mx + c.y * 3;
  return float((hsh >> uint(bit)) & 1u);
}
float hood(vec2 q){
  float head = length(q - vec2(0., .62)) - .16;
  float robe = triD(q - vec2(0., .22), .38);
  float peak = triD((q - vec2(0., .82)) * vec2(1.6, 1.), .09);
  return min(min(head, robe), peak);
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  p /= 1. + .09 * uKick;
  float r = length(p), a = atan(p.y, p.x);
  float sp = fract(a / TAU * 3. + log(r + 1e-3) * 1.3 - uTime * uCue.w);
  vec3 col = mix(vec3(.02, 0., .05), acid(uTime * .03 + .1) * .35, smoothstep(.42, .58, sp) * smoothstep(1.6, .15, r));
  col += MAG * .25 * pow(abs(cos(a * 12. + uTime * .2)), 40.) * exp(-r * 1.6) * uCue2.y;
  // glyph rings
  for (int i = 0; i < 2; i++){
    float fi = float(i);
    float R = .62 + fi * .13;
    float N = 40. + fi * 16.;
    float rotA = (fi < .5 ? 1. : -1.) * uCue.x;
    float u = (a + rotA) / TAU * N;
    float cell = floor(u);
    vec2 f = vec2(fract(u), (r - R) / .07 + .5);
    float g = glyph((f - vec2(.2, .1)) / vec2(.6, .8), cell + fi * 100.);
    float band = step(abs(r - R), .035);
    vec3 gc = mix(YEL, MAG, fi);
    float lit = step(cell / N, uCue2.y) ;
    col += gc * g * band * (.35 + .9 * lit) * (.7 + .5 * uBeatPulse);
    col += gc * exp(-abs(abs(r - R) - .045) * 200.) * .5;
  }
  // sigil: triangle, inscribed circle, eye with trefoil pupil
  vec2 tp = p - vec2(0., -.02);
  float build = uCue2.y;
  float tri = abs(triD(tp, .44)) - .012;
  float circ = abs(length(tp) - .22) - .008;
  float sig = min(tri, circ);
  col = mix(col, YEL, aa(sig, px) * build);
  col += YEL * exp(-abs(sig) * 60.) * build * (.6 + uSnare);
  float op = uCue.z;
  float hgt = max(.11 * op, .002);
  float Rr = (.2 * .2 + hgt * hgt) / (2. * hgt);
  vec2 eq = tp;
  float almond = max(length(eq - vec2(0., hgt - Rr)) - Rr, length(eq - vec2(0., Rr - hgt)) - Rr);
  col = mix(col, vec3(.02, 0., .03), aa(almond, px));
  float pup = trefoilD(rot(uTime * .6) * eq / .09) * .09;
  col = mix(col, mix(TOXIC, YEL, uBeatPulse), aa(max(pup, almond), px));
  col += MAG * exp(-abs(almond) * 150.) * op;
  // ring of hooded figures, rim-lit by the sigil
  for (int k = 0; k < 12; k++){
    float th = TAU * float(k) / 12. + uTime * .06;
    float depth = sin(th);
    vec2 base = vec2(cos(th) * 1.02, depth * .2 - .5);
    float s = .2 - depth * .05;
    vec2 q = (p - base) / s;
    q.x += q.y * .0;
    vec2 qb = q; qb.y -= .1; qb = rot(uCue2.x * .6) * qb; qb.y += .1;
    float hd = hood(qb);
    float m = aa(hd, px / s);
    float lit = exp(-max(hd, 0.) * 12.);
    col = mix(col, vec3(.01, 0., .02) + MAG * .08 * (1. + depth), m);
    col += mix(YEL, MAG, .5) * lit * (1. - m) * .12 * (1. - depth);
  }
  float ir = uCue.y * 1.6;
  col += (MAG + YEL) * .7 * exp(-abs(r - ir) * 28.) * exp(-uCue.y * 1.8) * step(0., uCue.y);
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- COMPOSITE (feedback)
SH.comp = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uScene, uPrev;
uniform vec2 uRes;
uniform float uTime, uFb, uFbZoom, uFbRot, uMosh, uMoshProb, uDrip;
uniform vec2 uFbShift;
uint hu(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float hf(uint x){ return float(hu(x) >> 8) / 16777215.0; }
float h2(vec2 p){ ivec2 i = ivec2(floor(p)); return hf(uint(i.x) * 0x8DA6B343u ^ hu(uint(i.y) + 0x68E31DA4u)); }
void main(){
  vec2 uv = vUv;
  vec3 sc = texture(uScene, uv).rgb;
  float asp = uRes.x / uRes.y;
  vec2 c = uv - .5; c.x *= asp;
  float cs = cos(uFbRot), sn = sin(uFbRot);
  c = mat2(cs, sn, -sn, cs) * c / (1. + uFbZoom);
  c.x /= asp;
  vec2 fuv = c + .5 + uFbShift;
  vec2 blk = floor(uv * vec2(64., 36.));
  float tq = floor(uTime * 10.);
  vec2 flow = (vec2(h2(blk + tq), h2(blk.yx + tq + 9.)) - .5) * .012 * uMosh;
  // melting drips: columns slide downward
  float col_ = floor(uv.x * 160.);
  fuv.y += uDrip * (.002 + .012 * h2(vec2(col_, floor(uTime * 2.))));
  vec3 prev = texture(uPrev, fuv + flow).rgb;
  vec3 outc = max(sc, prev * uFb);
  float mb = step(1. - uMoshProb, h2(blk * 1.7 + tq * 3.1));
  outc = mix(outc, prev, mb * step(.001, uMosh));
  fragColor = vec4(outc, 1.);
}`;

// ---------------------------------------------------------------------------- BLOOM
SH.bright = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh;
void main(){
  vec3 c = vec3(0.);
  c += texture(uSrc, vUv + uTexel * vec2(-1., -1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 1., -1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(-1.,  1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 1.,  1.)).rgb;
  c *= .25;
  float br = max(c.r, max(c.g, c.b));
  float k = max(br - uThresh, 0.);
  k = k * k / (k + .35);
  fragColor = vec4(c * k / max(br, 1e-4), 1.);
}`;
SH.down = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uTexel;
void main(){
  vec3 c = texture(uSrc, vUv).rgb * .5;
  c += texture(uSrc, vUv + uTexel * vec2(-1., -1.)).rgb * .125;
  c += texture(uSrc, vUv + uTexel * vec2( 1., -1.)).rgb * .125;
  c += texture(uSrc, vUv + uTexel * vec2(-1.,  1.)).rgb * .125;
  c += texture(uSrc, vUv + uTexel * vec2( 1.,  1.)).rgb * .125;
  fragColor = vec4(c, 1.);
}`;
SH.up = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 fragColor;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uGain;
void main(){
  vec3 c = vec3(0.);
  c += texture(uSrc, vUv + uTexel * vec2(-1., -1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 0., -1.)).rgb * 2.;
  c += texture(uSrc, vUv + uTexel * vec2( 1., -1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2(-1.,  0.)).rgb * 2.;
  c += texture(uSrc, vUv).rgb * 4.;
  c += texture(uSrc, vUv + uTexel * vec2( 1.,  0.)).rgb * 2.;
  c += texture(uSrc, vUv + uTexel * vec2(-1.,  1.)).rgb;
  c += texture(uSrc, vUv + uTexel * vec2( 0.,  1.)).rgb * 2.;
  c += texture(uSrc, vUv + uTexel * vec2( 1.,  1.)).rgb;
  fragColor = vec4(c / 16. * uGain, 1.);
}`;

// ---------------------------------------------------------------------------- FINAL POST
SH.post = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uComp, uBloom, uHud;
uniform vec2 uRes;
uniform float uTime, uGlitch, uChroma, uInvert, uFlash, uGrain, uScan, uVig, uHue, uSat, uPoster,
  uPixel, uTile, uKaleido, uOff, uZoom, uBloomAmt, uStatic, uExposure, uHudZoom, uTear, uFlip;
uniform vec2 uShake;
uniform vec3 uTint;
#define PI 3.14159265359
#define TAU 6.28318530718
uint hu(uint x){ x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float hf(uint x){ return float(hu(x) >> 8) / 16777215.0; }
float h1(float x){ return hf(uint(int(floor(x))) * 0x9E3779B9u + 0x2545F491u); }
float h2(vec2 p){ ivec2 i = ivec2(floor(p)); return hf(uint(i.x) * 0x8DA6B343u ^ hu(uint(i.y) + 0x68E31DA4u)); }
vec3 hueShift(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca); }
vec3 sceneAt(vec2 uv){
  vec2 u = uv;
  if (uTile > 1.001) u = fract(u * uTile);
  if (uKaleido > .5){
    float asp = uRes.x / uRes.y;
    vec2 c = (u - .5) * vec2(asp, 1.);
    float a = atan(c.y, c.x), r = length(c);
    float s = TAU / uKaleido;
    a = abs(mod(a + uTime * .2, s) - s * .5);
    c = r * vec2(cos(a), sin(a));
    u = c / vec2(asp, 1.) + .5;
  }
  if (uFlip > .5) u.x = 1. - u.x;
  return texture(uComp, u).rgb + texture(uBloom, u).rgb * uBloomAmt;
}
void main(){
  vec2 uv = vUv;
  float asp = uRes.x / uRes.y;
  // CRT power-off: squeeze to a line, then a dot
  float offY = 1. - smoothstep(0., .55, uOff) * .996;
  float offX = 1. - smoothstep(.55, 1., uOff) * .995;
  vec2 cuv = (uv - .5) / vec2(offX, offY) + .5;
  if (uOff > 0. && (cuv.x < 0. || cuv.x > 1. || cuv.y < 0. || cuv.y > 1.)){
    vec4 hc = texture(uHud, vUv);
    fragColor = vec4(hc.rgb * smoothstep(.97, 1., uOff), 1.);
    return;
  }
  uv = cuv;
  vec2 base = (uv - .5) / (1. + uZoom) + .5 + uShake;
  vec2 hudUv = (uv - .5) / (1. + uHudZoom) + .5 + uShake * .5;
  // block glitch
  float tq = floor(uTime * 24.);
  float bs = 1. + floor(h1(floor(uTime * 12.)) * 3.);
  vec2 blk = floor(base * vec2(16., 9.) * bs);
  float gr = h2(blk + tq * vec2(7., 3.));
  float gOn = step(1. - uGlitch * .4, gr);
  vec2 goff = vec2((h2(blk * 1.3 + tq) - .5) * .22, (h2(blk * 2.1 + tq) - .5) * .02) * uGlitch * gOn;
  // VHS line tear
  float row = floor(base.y * uRes.y / 3.);
  float tear = (h1(row + tq * 13.) - .5) * .03 * uTear * step(.6, h1(floor(base.y * 20.) + tq));
  vec2 suv = base + goff + vec2(tear, 0.);
  if (uPixel > 1.) suv = (floor(suv * uRes / uPixel) + .5) * uPixel / uRes;
  vec2 dir = suv - .5;
  float ca = uChroma * (.002 + .012 * dot(dir, dir)) + gOn * uGlitch * .012;
  vec3 col;
  col.r = sceneAt(suv + dir * ca * 3. + vec2(ca, 0.)).r;
  col.g = sceneAt(suv).g;
  col.b = sceneAt(suv - dir * ca * 3. - vec2(ca, 0.)).b;
  // channel swap inside glitch blocks
  if (gOn > .5 && h2(blk + tq + 5.) > .6) col = col.brg;
  col *= uExposure;
  col = col * (1. + col / 9.) / (1. + col);   // soft shoulder
  col = hueShift(col, uHue);
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat);
  col *= uTint;
  if (uPoster > .01){ float lv = mix(24., 4., uPoster); col = floor(col * lv + .5) / lv; }
  // HUD layer (premultiplied), with its own small RGB split during glitches
  vec2 huv = hudUv + goff * .6 + vec2(tear, 0.);
  vec4 hud = texture(uHud, huv);
  float hs = .0015 + uGlitch * .004;
  float hr = texture(uHud, huv + vec2(hs, 0.)).a, hb = texture(uHud, huv - vec2(hs, 0.)).a;
  col = col * (1. - hud.a) + hud.rgb;
  col += vec3(hr - hud.a, 0., hb - hud.a) * .6 * max(0., 1. - hud.a) ;
  col = mix(col, 1. - col, uInvert);
  col += uFlash;
  // static
  if (uStatic > .001){ float s = h2(gl_FragCoord.xy + floor(uTime * 60.) * vec2(17., 31.)); col = mix(col, vec3(s), uStatic); }
  // scanlines, vignette, grain
  col *= 1. - uScan * (.5 + .5 * step(1.5, mod(gl_FragCoord.y, 3.)));
  vec2 vq = vUv - .5;
  col *= 1. - uVig * dot(vq, vq) * 1.6;
  col += (h2(floor(gl_FragCoord.xy * .5) + floor(uTime * 24.) * vec2(37., 91.)) - .5) * uGrain;
  if (uOff > 0.) col += vec3(.8, .9, 1.) * smoothstep(.3, .6, uOff) * (1. - smoothstep(.9, 1., uOff)) * .6;
  fragColor = vec4(clamp(col, 0., 1.), 1.);
}`;
