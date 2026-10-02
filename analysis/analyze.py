"""TokSik MV — audio analysis.

Produces web/data.js with:
  * tempo / beat grid (fitted globally: the track sits on a fixed 170 BPM grid)
  * per-16th drum-hit strengths (kick / snare / hat) measured on the grid
  * 60 fps envelopes (rms, low, mid, high, flux), a 32-band spectrum and an
    oscilloscope snapshot per video frame
"""
import argparse
import base64
import json
import os
import numpy as np
from scipy.ndimage import maximum_filter1d, uniform_filter1d, gaussian_filter1d, percentile_filter
from audio_io import load_stereo, stft_mag, band_matrix, SR, SONG, ROOT

ap = argparse.ArgumentParser(description="Analyse the song and write web/data.js")
ap.add_argument("--audio", default=SONG, help="input audio file (default: web/audio/toksik.flac)")
ap.add_argument("--out", default=os.path.join(ROOT, "web", "data.js"), help="output data.js path")
args = ap.parse_args()
OUT = args.out
VFPS = 60

x = load_stereo(args.audio)
mono = x.mean(axis=1)
dur = len(mono) / SR
print(f"duration {dur:.3f}s")

# ---------------------------------------------------------------- onset (200 Hz)
OHOP = 240
OFPS = SR / OHOP
S = stft_mag(mono, 2048, OHOP)
edges = np.geomspace(30, 16000, 98)
centers = edges[1:-1]
Bl = np.log1p(100.0 * (S @ band_matrix(2048, SR, edges).T))
prev = maximum_filter1d(Bl, size=3, axis=1)
flux = np.maximum(0, Bl[2:] - prev[:-2])
flux = np.vstack([np.zeros((2, flux.shape[1]), np.float32), flux])


def detrend(e, win_s=1.0):
    e = e - uniform_filter1d(e, int(OFPS * win_s))
    return np.maximum(e, 0)


onset = detrend(flux.sum(1))
kick_env = detrend(flux[:, centers < 120].sum(1), 0.5)
snare_env = detrend(flux[:, (centers > 1200) & (centers < 5000)].sum(1)
                    + 0.5 * flux[:, (centers > 160) & (centers < 260)].sum(1), 0.5)
hat_env = detrend(flux[:, centers > 7000].sum(1), 0.5)
t_on = np.arange(len(onset)) / OFPS

# ---------------------------------------------------------------- tempo search
bpms = np.arange(60, 200, 0.05)
mags = np.array([abs((onset * np.exp(-2j * np.pi * b / 60 * t_on)).sum()) for b in bpms])
coarse = bpms[np.argmax(mags)]
# prefer the faster metrical level if the half-tempo is the argmax
if coarse < 100 and mags[np.argmin(abs(bpms - 2 * coarse))] > 0.6 * mags.max():
    coarse *= 2
sm = gaussian_filter1d(onset / onset.max(), 1.5)
best = (0, None, None)
for bpm in np.arange(coarse - 0.3, coarse + 0.3, 0.002):
    period = 60.0 / bpm
    phases = np.arange(0, period, 0.0005)
    bt = phases[:, None] + np.arange(0, dur / period - 1)[None, :] * period
    sc = np.interp(bt * OFPS, np.arange(len(sm)), sm).mean(1)
    j = int(np.argmax(sc))
    if sc[j] > best[0]:
        best = (sc[j], bpm, phases[j])
_, BPM, PHASE = best
BPM = round(BPM, 3)
PERIOD = 60.0 / BPM
print(f"tempo {BPM} BPM, phase {PHASE:.4f}s")

# local drift check: best local phase per 16-bar window
drift = []
for w0 in np.arange(0, dur - 20, 10):
    m = (t_on >= w0) & (t_on < w0 + 20)
    seg = sm[m]
    tt = t_on[m]
    offs = np.arange(-0.04, 0.0405, 0.0025)
    k0 = np.ceil((w0 - PHASE) / PERIOD)
    beats = PHASE + (k0 + np.arange(0, 20 / PERIOD - 1)) * PERIOD
    scs = [np.interp((beats + o) * OFPS, np.arange(len(sm)), sm).mean() for o in offs]
    drift.append(float(offs[int(np.argmax(scs))]))
print("local phase drift (ms):", " ".join(f"{d*1000:+.0f}" for d in drift))

# ---------------------------------------------------------------- downbeat
# Arrangement changes (stops, drops, section entries) happen on bar lines, so the
# right bar phase is the one whose bar-to-bar low-end energy is most contrasted.
def at(env, tt, w=0.025):
    i = np.round(tt * OFPS).astype(int)
    r = int(w * OFPS)
    return np.array([env[max(0, k - r): k + r + 1].max() if k < len(env) else 0 for k in i])


low_db = 10 * np.log10((S[:, :7] ** 2).sum(1) + 1e-9)  # < ~160 Hz
contrast = []
for off in range(4):
    starts = PHASE + (off + 4 * np.arange(int(dur / (4 * PERIOD)))) * PERIOD
    bars = [low_db[int(a * OFPS): int((a + 4 * PERIOD) * OFPS)].mean() for a in starts if a + 4 * PERIOD < dur]
    contrast.append(np.abs(np.diff(bars)).mean())
DOWNBEAT = int(np.argmax(contrast))
print("bar-contrast per offset", np.round(contrast, 3), "-> downbeat offset", DOWNBEAT)

# ---------------------------------------------------------------- grid hits
n16 = int((dur - PHASE) / (PERIOD / 4)) + 1
g_t = PHASE + np.arange(n16) * PERIOD / 4


def grid_strength(env):
    v = at(env, g_t, 0.03)
    # normalise against a rolling high percentile (~8 bars) so quiet parts still read
    ref = percentile_filter(v, 95, size=128)
    ref = np.maximum(ref, np.percentile(v, 60))
    return np.clip(v / (ref + 1e-9), 0, 1.5) / 1.5


kick_g = grid_strength(kick_env)
snare_g = grid_strength(snare_env)
hat_g = grid_strength(hat_env)
acc_g = grid_strength(onset)


def q8(a):
    return base64.b64encode(np.clip(np.round(a * 255), 0, 255).astype(np.uint8).tobytes()).decode()


# ---------------------------------------------------------------- 60 fps features
VH = SR // VFPS  # 800
Sv = stft_mag(mono, 4096, VH)
freqs = np.fft.rfftfreq(4096, 1 / SR)
P = Sv ** 2
n_v = int(np.ceil(dur * VFPS))
P = P[:n_v]


def db_norm(e, lo_pct=5, hi_pct=99.5):
    d = 10 * np.log10(e + 1e-10)
    lo, hi = np.percentile(d, lo_pct), np.percentile(d, hi_pct)
    return np.clip((d - lo) / (hi - lo + 1e-9), 0, 1)


def band_e(lo, hi):
    return P[:, (freqs >= lo) & (freqs < hi)].sum(1)


rms = db_norm(P.sum(1))
low = db_norm(band_e(25, 160))
mid = db_norm(band_e(160, 2500))
high = db_norm(band_e(2500, 16000))
fl = np.interp(np.arange(n_v) / VFPS, t_on, gaussian_filter1d(onset, 2))
flux_v = np.clip(fl / np.percentile(fl, 99.5), 0, 1)

sp_edges = np.geomspace(40, 16000, 34)
fb = band_matrix(4096, SR, sp_edges)
spec = 10 * np.log10(P @ fb.T + 1e-10)
lo_s = np.percentile(spec, 8, axis=0)
hi_s = np.percentile(spec, 99.7, axis=0)
spec = np.clip((spec - lo_s) / (hi_s - lo_s + 1e-9), 0, 1)

# oscilloscope: 128 points spanning 1024 samples centred on each video frame
WN, WP = 1024, 128
lp = uniform_filter1d(mono, 8)
pad = np.pad(lp, (WN, WN))
idx = (np.arange(n_v) * VH + WN - WN // 2)[:, None] + np.linspace(0, WN - 1, WP).astype(int)[None, :]
wave = pad[idx]
wave = wave / (np.percentile(np.abs(wave), 99.9) + 1e-9)
wave_u8 = np.clip(np.round(wave * 127 + 128), 0, 255).astype(np.uint8)

data = {
    "duration": round(dur, 4),
    "bpm": BPM,
    "period": PERIOD,
    "phase": round(float(PHASE), 4),
    "downbeat": DOWNBEAT,
    "grid16": {"n": n16, "kick": q8(kick_g), "snare": q8(snare_g), "hat": q8(hat_g), "acc": q8(acc_g)},
    "fps": VFPS,
    "frames": n_v,
    "env": {"rms": q8(rms), "low": q8(low), "mid": q8(mid), "high": q8(high), "flux": q8(flux_v)},
    "spec": {"bands": 32, "data": q8(spec.reshape(-1))},
    "wave": {"points": WP, "data": base64.b64encode(wave_u8.reshape(-1).tobytes()).decode()},
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.TOKSIK_AUDIO=")
    json.dump(data, f, separators=(",", ":"))
    f.write(";\n")
print("wrote", OUT, f"{sum(len(v) for v in [json.dumps(data)])/1e6:.2f} MB")

# quick summary of grid hits for sanity
kicks = np.where(kick_g > 0.55)[0]
snares = np.where(snare_g > 0.55)[0]
print("kick hits", len(kicks), "snare hits", len(snares))
print("snare 16th-position histogram (mod 16 rel. downbeat):",
      np.bincount((snares - DOWNBEAT * 4) % 16, minlength=16))
print("kick  16th-position histogram (mod 16 rel. downbeat):",
      np.bincount((kicks - DOWNBEAT * 4) % 16, minlength=16))
