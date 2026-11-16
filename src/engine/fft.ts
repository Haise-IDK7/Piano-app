// FFT radix-2 con ventana de Hann. Devuelve el espectro de magnitudes.
const cache = new Map<number, { cos: Float32Array; sin: Float32Array; rev: Uint32Array; hann: Float32Array }>();

function tables(n: number) {
  let t = cache.get(n);
  if (!t) {
    const cos = new Float32Array(n / 2), sin = new Float32Array(n / 2), rev = new Uint32Array(n), hann = new Float32Array(n);
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
      rev[i] = r;
    }
    for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    t = { cos, sin, rev, hann };
    cache.set(n, t);
  }
  return t;
}

/** `input.length` debe ser potencia de 2. Devuelve n/2 magnitudes normalizadas. */
export function magnitudeSpectrum(input: Float32Array, offset = 0, n = input.length): Float32Array {
  const { cos, sin, rev, hann } = tables(n);
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[rev[i]] = input[offset + i] * hann[i];
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const tr = re[i + j + half] * cos[k] + im[i + j + half] * sin[k];
        const ti = im[i + j + half] * cos[k] - re[i + j + half] * sin[k];
        re[i + j + half] = re[i + j] - tr; im[i + j + half] = im[i + j] - ti;
        re[i + j] += tr; im[i + j] += ti;
      }
    }
  }
  const out = new Float32Array(n / 2);
  const norm = 4 / n; // compensa Hann: un seno de amplitud 1 ≈ 1
  for (let i = 0; i < n / 2; i++) out[i] = Math.hypot(re[i], im[i]) * norm;
  return out;
}
