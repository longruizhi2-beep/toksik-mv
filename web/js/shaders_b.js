// Scenes B: radioactive tunnel, TOKSIK feed, parade of fools, blast (globe + mushroom cloud).
window.SH = window.SH || {};

// ---------------------------------------------------------------------------- TUNNEL
// uCue.x twist, uCue.y palette offset, uCue.z melt, uCue.w sick wobble
// uCue2.x camera roll, uCue2.y camera z, uCue2.z speed lines, uCue2.w molten amount (colour)
SH.tunnel = SH.common + `
float mapT(vec3 p){
  vec2 xy = rot(p.z * uCue.x * .09) * p.xy;
  if (uCue.z > .01) xy += (vec2(vn3(p * 1.3 + vec3(0., uTime, 0.)), vn3(p * 1.3 + vec3(5., 1., uTime))) - .5) * uCue.z * .45;
  float hx = hexD(xy);
  float d = 1.7 - hx;
  float zr = mod(p.z, 2.) - 1.;
  float rib = max(1.43 - hx, abs(zr) - .1);
  d = min(d, rib);
  // wall grooves
  float gz = abs(mod(p.z, .5) - .25);
  d += .012 * smoothstep(.02, .0, gz) * step(1.6, hx);
  return d;
}
float holoD(vec3 p){
  float zh = mod(p.z + 4., 8.) - 4.;
  float gi = floor((p.z + 4.) / 8.);
  vec2 xy = rot(uTime * .7 + gi * 1.3) * p.xy;
  float d2 = trefoilD(xy / 1.1) * 1.1;
  return max(abs(d2) - .01, abs(zh) - .02);
}
vec3 nrmT(vec3 p){
  const vec2 e = vec2(.0025, -.0025);
  return normalize(e.xyy * mapT(p + e.xyy) + e.yyx * mapT(p + e.yyx) + e.yxy * mapT(p + e.yxy) + e.xxx * mapT(p + e.xxx));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float cz = uCue2.y;
  vec3 ro = vec3(sin(uTime * .7) * .22, cos(uTime * .53) * .18, cz);
  vec3 rd = normalize(vec3(uv * (1. + .08 * uKick), 1.15));
  rd.xy = rot(uCue2.x + sin(uTime * .3) * .05) * rd.xy;
  if (uCue.w > .01) rd.xy += vec2(sin(uTime * 2.1 + rd.y * 3.), cos(uTime * 1.7 + rd.x * 3.)) * .08 * uCue.w;
  rd = normalize(rd);
  float t = .05, d = 1.;
  float glow = 0.;
  vec3 p = ro;
  for (int i = 0; i < 110; i++){
    p = ro + rd * t;
    d = mapT(p);
    float hd = holoD(p);
    glow += exp(-hd * 16.) * .035;
    if (d < .0015 || t > 42.) break;
    t += d * .85;
  }
  vec3 pal = acid(uCue.y + uTime * .03);
  vec3 fogC = mix(vec3(.03, 0., .07), mix(pal, ORNG, uCue2.w) * .25, .5);
  vec3 col = fogC;
  if (d < .02){
    vec3 n = nrmT(p);
    vec2 xy = rot(p.z * uCue.x * .09) * p.xy;
    float hx = hexD(xy);
    float ang = atan(xy.y, xy.x);
    float dc = abs(mod(ang + PI / 6., PI / 3.) - PI / 6.);
    float zr = mod(p.z, 2.) - 1.;
    float ri = floor(p.z / 2. + .5);
    vec3 ec = acid(p.z * .018 + uCue.y + uTime * .04);
    ec = mix(ec, mix(ORNG, vec3(1., .1, .05), sat(sin(p.z) * .5 + .5)), uCue2.w);
    float lam = max(dot(n, -rd), 0.);
    vec3 base = vec3(.05, .04, .08) * (.3 + lam) + vec3(.2, .1, .3) * pow(1. - lam, 4.);
    // panels showing the spectrum
    float seg = floor((ang + PI) / TAU * 24.);
    float sv = spec(fract(seg / 24. * 1.7 + .05));
    float panelY = fract(p.z * .5);
    float eq = step(1.6, hx) * step(panelY, sv) * step(.08, abs(zr));
    col = base + ec * eq * .35;
    // corner light strips with a chase travelling toward the camera
    float strip = exp(-dc * 40.) * step(1.55, hx);
    float chase = pow(.5 + .5 * cos((p.z - uBeat * 4.) * PI * .5), 10.);
    col += ec * strip * (1. + 3.5 * chase);
    // rib edges, the rib 6 units ahead flashes on every beat
    float ribEdge = exp(-abs(abs(zr) - .1) * 60.) * step(hx, 1.64);
    float flash = uBeatPulse * exp(-abs(ri * 2. - cz - 6.) * .7) * 3.;
    col += mix(ec, vec3(1.), .3) * ribEdge * (.7 + flash + uSnare * 1.2);
    col += ec * exp(-abs(hx - 1.43) * 40.) * step(abs(zr), .1) * (1. + flash);
    // molten cracks
    if (uCue2.w > .01) col += mix(ORNG, YEL, .3) * pow(ridge(vec2(ang * 3., p.z * .8) + uTime * .2), 14.) * uCue2.w * 2.5;
  }
  col = mix(col, fogC, 1. - exp(-t * .045));
  vec3 hc = mix(mix(TOXIC, YEL, .3), vec3(1., .5, .1), uCue2.w);
  col += hc * glow * (1.6 + 3. * uBarPulse);
  // speed streaks
  if (uCue2.z > .01){
    float a = atan(uv.y, uv.x);
    float s = h1(floor(a * 60.) + floor(uTime * 20.));
    col += vec3(.8, .9, 1.) * step(.85, s) * smoothstep(.25, 1., length(uv)) * uCue2.z * .5;
  }
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- FEED
// uCue.x scroll (posts), uCue.y crack, uCue.z wall scroll speed, uCue.w logo strength
// uCue2.x phone scale, uCue2.y shake
SH.feed = SH.common + `
float heartD(vec2 q){
  q.y += .03;
  vec2 a = abs(q);
  float c1 = length(vec2(a.x - .078, q.y - .058)) - .1;
  vec2 s = rot(PI * .25) * (q - vec2(0., .0));
  float sq = boxD(s, vec2(.1));
  return min(c1, sq);
}
vec3 postContent(float idx, vec2 q, float px){
  // q in [-.5,.5] x [-1.08,1.08] roughly (card aspect)
  float k = mod(idx, 8.);
  float hh = h1(idx * 13.);
  vec3 bg = mix(acid(hh + uTime * .05) * .25, vec3(.02, 0., .05), .5);
  vec3 c = bg;
  if (k < 1.){
    float s = .42 * (1. + .12 * uKick);
    float tr = trefoilD(rot(floor(uBeat) * PI / 3. + easeOut(fract(uBeat) * 3.) * PI / 3.) * q / s) * s;
    c = mix(YEL * .9, vec3(.03, 0., .05), aa(tr, px));
    c = mix(c, bg, step(.46, length(q)));
  } else if (k < 2.){
    float r = length(q); vec2 dir = q / max(r, 1e-4);
    vec3 ic = acid(r + fbm(dir * 5. + idx) * .8 + uTime * .1) * (.4 + vn(dir * 30.));
    c = mix(vec3(.05), ic, aa(r - .38, px));
    c = mix(c, vec3(0.), aa(r - .1 - .06 * uKick, px));
  } else if (k < 3.){
    float b = texture(uSim, q * vec2(.6, .5) + .5).y;
    c = mix(bg, acid(b * 2. + uTime * .1), smoothstep(.1, .3, b));
  } else if (k < 4.){
    float st = segD(q, vec2(0., -.6), vec2(0., .05)) - .07 - .08 * exp(-(q.y + .6) * 6.);
    float cap = length((q - vec2(0., .2)) * vec2(1., 1.6)) - .3;
    float m = min(st, cap);
    vec3 fire = mix(ORNG, YEL, sat(.5 - m * 5.));
    c = mix(bg, fire, aa(m + .02 * fbm(q * 12. - uTime * 2.), px));
    c += ORNG * exp(-max(m, 0.) * 10.) * .5;
  } else if (k < 5.){
    float ph = uBeat * PI;
    vec2 hip = vec2(0., -.15);
    float body = segD(q, hip, vec2(0., .25));
    float arms = min(segD(q, vec2(0., .2), vec2(-.25, .2 + .25 * sin(ph))), segD(q, vec2(0., .2), vec2(.25, .2 + .25 * cos(ph))));
    float legs = min(segD(q, hip, vec2(-.15 + .08 * sin(ph), -.6)), segD(q, hip, vec2(.15 - .08 * sin(ph), -.6)));
    float head = length(q - vec2(0., .38)) - .11;
    float m = min(min(body, arms), legs) - .035;
    m = min(m, head);
    c = mix(bg, TOXIC, aa(m, px));
    c += TOXIC * exp(-abs(m) * 30.) * .4;
  } else if (k < 6.){
    float bi = floor((q.x + .5) * 12.) / 12.;
    float hgt = spec(bi * .9 + .05) * 1.6 - .8;
    c = mix(bg, mix(TOXIC, MAG, (q.y + .8) / 1.6), step(q.y, hgt) * step(.15, fract((q.x + .5) * 12.)));
  } else if (k < 7.){
    float face = length(q) - .38;
    c = mix(bg, vec3(.35, .8, .1), aa(face, px));
    vec2 e1 = abs(q - vec2(-.13, .1)), e2 = abs(q - vec2(.13, .1));
    float x1 = min(abs(e1.x - e1.y), 1.) + step(.06, max(e1.x, e1.y));
    float x2 = min(abs(e2.x - e2.y), 1.) + step(.06, max(e2.x, e2.y));
    c = mix(c, vec3(0.), aa(min(x1, x2) - .018, px));
    float mouth = abs(q.y + .14 - .03 * sin(q.x * 60.)) - .012;
    c = mix(c, vec3(0.), aa(max(mouth, abs(q.x) - .18), px));
  } else {
    c = vec3(h2(q * 90. + uTime * 70.)) * .7;
    c *= .6 + .4 * step(.5, fract(q.y * 40. + uTime * 3.));
  }
  return c;
}
vec3 wall(vec2 p){
  vec2 g = p * 5. + vec2(0., uTime * uCue.z);
  vec2 id = floor(g), f = fract(g);
  float r = h2(id + floor(uBeat * .5) * vec2(3., 7.));
  vec2 q = f - .5;
  vec3 c = vec3(0.);
  if (r < .22) c = acid(r * 4. + uTime * .1) * aa(trefoilD(rot(uBeat * PI / 3.) * q / .38) * .38, .012);
  else if (r < .42) c = vec3(h2(f * 70. + uTime * 60.)) * .6;
  else if (r < .58){ float b = floor(f.x * 8.) / 8.; c = mix(TOXIC, MAG, f.y) * step(f.y, spec(b)) * step(.2, fract(f.x * 8.)); }
  else if (r < .76) c = MAG * aa(heartD(q * 1.3), .015) * (.6 + uBeatPulse);
  else c = UVC * .6 * step(.5, fract(f.y * 10. + uTime));
  c *= 1. - smoothstep(.43, .46, max(abs(q.x), abs(q.y)));
  float fl = step(.8, h2(id + floor(uTime * 16.)));
  return c * (.28 + .5 * fl * (.3 + uHat));
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  float asp = uRes.x / uRes.y;
  p += (vec2(h1(uTime * 50.), h1(uTime * 50. + 3.)) - .5) * .02 * uCue2.y;
  vec3 col = wall(p) * (1. - .5 * uCue.w);
  // giant wordmark from the text layer, sliced
  float row = floor(vUv.y * 24.);
  float sh = (h1(row + floor(uTime * 12.)) - .5) * .06 * (uSnare + .2);
  vec2 tuv = vec2(vUv.x + sh, vUv.y);
  float tm = texture(uText, tuv).a;
  float tmR = texture(uText, tuv + vec2(.006, 0.)).a, tmB = texture(uText, tuv - vec2(.006, 0.)).a;
  col = mix(col, vec3(tmR, tm * .1, tmB) * vec3(1., .2, 1.) + TOXIC * tm * .6, max(tm, max(tmR, tmB)) * uCue.w);
  // phone
  float s = uCue2.x * (1. + .025 * uKick);
  vec2 half_ = vec2(.2075, .45) * s;
  float dP = boxD(p, half_ - .045 * s) - .045 * s;
  float inP = aa(dP, px);
  col *= 1. - .6 * exp(-max(dP, 0.) * 18.);
  if (dP < .01){
    vec2 sq = (p + half_) / (2. * half_);
    float ps = uCue.x + (1. - sq.y);
    float idx = floor(ps);
    float ly = 1. - fract(ps);
    vec2 q = vec2((sq.x - .5), (ly - .5) * 2.17);
    vec3 sc = postContent(idx, q, px / (2. * half_.x));
    sc *= .75 + .25 * smoothstep(0., .02, abs(fract(ps) - 0.)) ;
    // crack
    if (uCue.y > .01){
      float cr = pow(ridge(sq * vec2(4., 8.) + 3.), 22.) * uCue.y;
      sc = mix(sc, vec3(1.), sat(cr * 3.));
      sc = mix(sc, sc.gbr, step(.5, cr));
    }
    col = mix(col, sc, inP);
  }
  col += mix(MAG, TOXIC, .5 + .5 * sin(uTime * 2.)) * exp(-abs(dP) * 260.) * 1.6;
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- PARADE
// uCue.x bow, uCue.y march steps, uCue.z den glow / push, uCue.w palette offset
SH.parade = SH.common + `
float figure(vec2 q, float ph, float kind, float bow, out float headD){
  q.y -= abs(sin(ph * PI)) * .045;
  vec2 hip = vec2(0., .42);
  vec2 qu = q - hip; qu = rot(-bow * 1.2) * qu; qu += hip;
  float sw = sin(ph * PI);
  float body = segD(qu, hip, vec2(0., .76)) - .085;
  float legs = min(segD(q, hip, vec2(sw * .17, .02)), segD(q, hip, vec2(-sw * .17, .02))) - .055;
  float arms = min(segD(qu, vec2(0., .72), vec2(-sw * .2, .44)), segD(qu, vec2(0., .72), vec2(sw * .2, .44))) - .045;
  vec2 hq = qu - vec2(0., .93);
  headD = boxD(hq, vec2(.1, .085)) - .02;
  float d = min(min(body, legs), min(arms, headD));
  if (kind < 1.) d = min(d, triD(qu - vec2(0., 1.16), .12));
  else if (kind < 2.) d = min(d, min(boxD(qu - vec2(0., 1.13), vec2(.08, .1)), boxD(qu - vec2(0., 1.04), vec2(.15, .015))));
  else if (kind < 3.){ vec2 wq = qu - vec2(sw * .2, .44); d = min(d, min(segD(wq, vec2(0.), vec2(.05, .28)) - .025, abs(length(wq - vec2(.06, .31)) - .06) - .02)); }
  else d = min(d, min(segD(qu, vec2(0., 1.02), vec2(.07, 1.16)) - .012, length(qu - vec2(.07, 1.17)) - .03));
  return d;
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  float asp = uRes.x / uRes.y;
  p /= 1. + .03 * uKick + uCue.z * .15;
  p.x += uCue.z * .12;
  vec2 den = vec2(asp * .5 - .28, -.02);
  // sunburst centred on the den
  vec2 dc = p - den;
  float a = atan(dc.y, dc.x);
  float ray = step(.5, fract(a / TAU * 18. + uTime * .03));
  vec3 A = acid(uCue.w + .05), B = acid(uCue.w + .55);
  vec3 col = mix(A * .22, B * .45, ray);
  col = mix(col, vec3(.02, 0., .05), smoothstep(.2, 1.6, length(dc)) * .6);
  // halftone
  vec2 hp = rot(PI / 4.) * gl_FragCoord.xy / 8.;
  float lum = dot(col, vec3(.3, .59, .11));
  col *= 1. - .45 * step(length(fract(hp) - .5), .5 * sqrt(sat(1. - lum * 1.5)));
  // ground
  float gy = -.43;
  col = mix(col, vec3(.03, 0., .06), aa(p.y - gy, px));
  vec2 gp = vec2(p.x * 6. / (1.5 - (p.y - gy) * 3.) - uCue.y * .9, p.y);
  col += TOXIC * .4 * step(p.y, gy) * exp(-abs(fract(gp.x) - .5) * 30.) * (.5 + uBeatPulse);
  // three rows of marchers, back to front
  for (int L = 0; L < 3; L++){
    float fl = float(L);
    float sc = .2 + fl * .1;
    float ground = -.02 - fl * .19;
    float spacing = sc * .95;
    float off = uCue.y * sc * .36 + fl * .31;
    float xx = p.x - off;
    float cell = floor(xx / spacing);
    vec2 q = vec2((xx - (cell + .5) * spacing) / sc, (p.y - ground) / sc);
    float kind = floor(h1(cell * 3.7 + fl * 11.) * 4.);
    float hd;
    float ph = uBeat + fl * .0 + h1(cell) * .08;
    float fd = figure(q, ph, kind, uCue.x, hd);
    float m = aa(fd, px / sc);
    vec3 rowC = acid(uCue.w + fl * .22 + .6);
    vec3 fc = mix(vec3(.02, 0., .04), rowC * .15, .5);
    float screen = aa(hd, px / sc);
    vec3 scr = mix(rowC, vec3(1.), .3) * (.7 + .8 * uBeatPulse) * (.6 + .4 * step(.5, fract(q.y * 30.)));
    fc = mix(fc, scr, screen);
    col = mix(col, fc, m);
    col += rowC * exp(-abs(fd) * 55. / sc * .2) * .55 * (1. - m);
    col = mix(col, col * .5, step(p.y, ground) * (1. - m) * .0);
  }
  // the den: dark maw with teeth and eyes
  float R = .42 + .03 * uKick;
  float dr = length(dc);
  float inside = aa(dr - R, px);
  float n = 16.;
  float ta = fract((a + uTime * .08) / TAU * n);
  float tooth = R - dr - .13 * (1. - abs(ta - .5) * 2.);
  vec3 maw = mix(vec3(0.), MAG * .25, exp(-dr * 4.) * uCue.z);
  col = mix(col, maw, inside);
  col = mix(col, vec3(.95, .92, .85), aa(tooth, px) * inside);
  col += mix(MAG, YEL, .3) * exp(-abs(dr - R) * 120.) * (1. + uCue.z);
  for (int k = 0; k < 2; k++){
    vec2 ep = den + vec2(k == 0 ? -.1 : .1, .12);
    float ed = length((p - ep) * vec2(1., 2.2)) - .035 * (.5 + uCue.z);
    col += YEL * (aa(ed, px) + exp(-max(ed, 0.) * 40.) * .6) * (.4 + uCue.z);
  }
  fragColor = vec4(col, 1.);
}`;

// ---------------------------------------------------------------------------- BLAST
// uCue.x 0 globe -> 1 mushroom, uCue.y seconds since detonation, uCue.z camera push, uCue.w flash
SH.blast = SH.common + `
vec3 globe(vec2 p, float px){
  vec3 ro = vec3(0., 0., -3.2);
  vec3 rd = normalize(vec3(p, 1.6));
  vec3 col = vec3(.01, 0., .03) + vec3(1.) * step(.996, h2(p * 400.)) * .8;
  float b = dot(ro, rd), c = dot(ro, ro) - 1.;
  float disc = b * b - c;
  if (disc > 0.){
    float t = -b - sqrt(disc);
    vec3 n = ro + rd * t;
    vec3 np = n;
    np.xz = rot(uTime * .25) * np.xz;
    np.yz = rot(.35) * np.yz;
    float land = smoothstep(.5, .53, fbm3(np * 1.7 + 3.));
    float lat = asin(clamp(np.y, -1., 1.)), lon = atan(np.z, np.x);
    float gl = min(abs(fract(lat / (PI / 12.) + .5) - .5), abs(fract(lon / (PI / 12.) + .5) - .5));
    vec3 surf = mix(vec3(.02, 0., .12), TOXIC * .45, land);
    surf += land * TOXIC * .4 * step(.5, fract((np.x + np.y) * 70.));
    surf += CYAN * .7 * exp(-gl * 60.);
    float fres = pow(1. - sat(dot(-rd, n)), 3.);
    surf *= .35 + .9 * sat(dot(n, normalize(vec3(-.6, .5, -.6))));
    surf += MAG * fres * 1.6;
    col = surf;
  }
  float r = length(p);
  col += MAG * exp(-abs(r - .527) * 40.) * .9;
  float ring = .53 + fract(uBeat) * .9;
  col += CYAN * exp(-abs(r - ring) * 90.) * (1. - fract(uBeat)) * 1.2;
  return col;
}
float densM(vec3 p, float h, out float heat){
  float H = 1.1 + min(h, 3.2) * .85;
  vec3 q = p - vec3(0., H, 0.);
  float Rt = .75 + h * .12, rt = .48 + h * .06;
  vec2 tq = vec2(length(q.xz) - Rt, q.y);
  tq = rot(-h * 1.3) * tq;
  float dT = length(tq * vec2(1., 1.2)) - rt;
  float dC = length(q * vec3(1., 1.5, 1.) - vec3(0., .28, 0.)) - Rt * .85;
  float stemR = .2 + .03 * h + .55 * exp(-p.y * 3.2);
  float dS = max(length(p.xz) - stemR, p.y - H);
  float d = smin(min(dT, dC), dS, .35);
  float Rs = .6 + h * 1.15;
  float dR = length(vec2(length(p.xz) - Rs, p.y * 2.4)) - .22 - h * .03;
  d = min(d, dR);
  float n = fbm3(p * 1.7 - vec3(0., h * .9, 0.) + vec3(tq.y, 0., tq.x) * .6);
  heat = sat(-d * 1.6 + .2) * exp(-h * .22);
  return sat(-d * 2.4 + (n - .5) * 1.8);
}
vec3 mushroom(vec2 p){
  float h = max(uCue.y, 0.);
  vec3 ro = vec3(sin(uTime * .15) * .8, 0.8 + h * .22, -7.6 - min(h, 4.) * .6 + uCue.z * 1.2);
  vec3 ta = vec3(0., 1.4 + min(h, 3.2) * .5, 0.);
  vec3 fw = normalize(ta - ro), rt = normalize(cross(vec3(0., 1., 0.), fw)), up = cross(fw, rt);
  vec3 rd = normalize(p.x * rt + p.y * up + 1.25 * fw);
  vec3 col = mix(vec3(.25, 0., .2), vec3(.02, 0., .06), sat(rd.y * 2.5 + .3));
  col += ORNG * .35 * exp(-abs(rd.y + .02) * 20.);
  if (rd.y < 0.){
    float tg = -ro.y / rd.y;
    vec3 gp = ro + rd * tg;
    vec2 g = abs(fract(gp.xz * .8) - .5) / max(fwidth(gp.xz * .8), 1e-4);
    float line = 1. - min(min(g.x, g.y), 1.);
    float fade = exp(-tg * .06);
    vec3 gc = vec3(.03, 0., .05) + TOXIC * line * .35 * fade;
    float rr = length(gp.xz);
    float Rsh = h * 2.6;
    gc += mix(YEL, MAG, sat(h * .3)) * exp(-abs(rr - Rsh) * 5.) * exp(-h * .35) * 2.5 * fade;
    gc += ORNG * exp(-rr * .8) * exp(-h * .3) * 1.5;
    col = gc;
  }
  // volume
  vec3 cc = vec3(0., 2., 0.);
  vec3 oc = ro - cc;
  float b = dot(oc, rd), c = dot(oc, oc) - 20.;
  float disc = b * b - c;
  if (disc > 0. && h > 0.){
    float t0 = max(-b - sqrt(disc), 0.), t1 = -b + sqrt(disc);
    float st = (t1 - t0) / 64.;
    float T = 1.;
    vec3 acc = vec3(0.);
    float t = t0 + st * h1(gl_FragCoord.x + gl_FragCoord.y * 1920.);
    for (int i = 0; i < 64; i++){
      vec3 pos = ro + rd * t;
      float heat;
      float den = densM(pos, h, heat);
      if (den > .001){
        vec3 smoke = mix(UVC * .45, MAG * .7, sat(pos.y * .28 + .1 * sin(pos.x * 3. + uTime))) * (.35 + .65 * sat(1. - pos.y * .18));
        smoke += TOXIC * .25 * sat(1. - abs(pos.y - .3) * 2.);
        vec3 fire = mix(vec3(1., .12, .25), mix(ORNG, YEL, heat), heat);
        vec3 em = mix(smoke, fire * 2.4, heat);
        float al = sat(den * st * 3.2);
        acc += T * em * al;
        T *= 1. - al;
        if (T < .02) break;
      }
      t += st;
    }
    col = col * T + acc;
  }
  return col;
}
void main(){
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float px = 1.5 / uRes.y;
  p /= 1. + .04 * uKick;
  vec3 col;
  if (uCue.x < .5) col = globe(p / (1. + uSecT * .08), px);
  else col = mushroom(p);
  col += vec3(1., .95, .9) * uCue.w;
  fragColor = vec4(col, 1.);
}`;
