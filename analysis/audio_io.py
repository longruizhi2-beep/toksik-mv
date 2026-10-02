"""Shared audio helpers: decoding through ffmpeg and a small STFT."""
import os
import shutil
import subprocess
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONG = os.path.join(ROOT, "web", "audio", "toksik.flac")
SR = 48000


def find_ffmpeg():
    """$FFMPEG, then ffmpeg on PATH, then the binary bundled with the imageio-ffmpeg package."""
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit("ffmpeg not found: install it, set $FFMPEG, or `pip install imageio-ffmpeg`")


def load_stereo(path=SONG, sr=SR):
    raw = subprocess.run(
        [find_ffmpeg(), "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(sr), "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def stft_mag(x, n_fft, hop):
    """Centered STFT magnitude, frame i is centred on sample i*hop."""
    pad = n_fft // 2
    xp = np.pad(x, (pad, pad + n_fft))
    n_frames = 1 + (len(x)) // hop
    win = np.hanning(n_fft).astype(np.float32)
    out = np.empty((n_frames, n_fft // 2 + 1), dtype=np.float32)
    chunk = 2048
    for s in range(0, n_frames, chunk):
        e = min(n_frames, s + chunk)
        idx = (np.arange(s, e) * hop)[:, None] + np.arange(n_fft)[None, :]
        frames = xp[idx] * win
        out[s:e] = np.abs(np.fft.rfft(frames, axis=1))
    return out


def band_matrix(n_fft, sr, edges_hz):
    """Rectangular-ish (triangular overlap) filterbank from band edges."""
    freqs = np.fft.rfftfreq(n_fft, 1.0 / sr)
    n = len(edges_hz) - 2
    fb = np.zeros((n, len(freqs)), dtype=np.float32)
    for i in range(n):
        lo, c, hi = edges_hz[i], edges_hz[i + 1], edges_hz[i + 2]
        up = (freqs - lo) / max(c - lo, 1e-9)
        dn = (hi - freqs) / max(hi - c, 1e-9)
        fb[i] = np.clip(np.minimum(up, dn), 0, None)
        if fb[i].sum() == 0:  # guarantee at least one bin
            fb[i, np.argmin(np.abs(freqs - c))] = 1.0
    return fb
