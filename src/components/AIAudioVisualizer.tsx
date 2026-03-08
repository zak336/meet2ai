import { useEffect, useRef } from 'react';

interface AIAudioVisualizerProps {
  isSpeaking: boolean;
  speechProgress?: number;
}

// ─── Speech synthesis engine ──────────────────────────────────────────────────
// Produces a 32-bin frequency array that mimics realistic speech:
//  • Fundamental pitch (F0) ~130 Hz with vibrato & micro-jitter
//  • Three formant bands (F1 ~700 Hz, F2 ~1300 Hz, F3 ~2500 Hz)
//  • Prosody envelope: voiced / unvoiced / pause transitions
//  • Breathiness noise floor
function computeSpeechBins(t: number, bins: number): Float32Array {
  const out = new Float32Array(bins);

  // Each bin covers ~250 Hz (8 kHz / 32 bins)
  const binHz = 8000 / (bins * 2);

  // ── Prosody: syllable rate ~4 Hz, word gaps every ~0.7 s ──────────────────
  const syllable = Math.pow(Math.max(0, Math.sin(t * 4.1 * Math.PI)), 2.2);
  const wordGap  = Math.pow(Math.max(0, Math.sin(t * 0.72 * Math.PI + 0.3)), 6);
  const voiced   = syllable * (1 - wordGap * 0.9);

  // ── F0 with vibrato + micro-jitter ─────────────────────────────────────────
  const vibrato = Math.sin(t * 5.3) * 4;
  const jitter  = Math.sin(t * 97.1) * 1.5;
  const f0 = 130 + vibrato + jitter;

  // ── Formant centres shift over time (vowel changes) ────────────────────────
  const f1 = 650  + Math.sin(t * 1.3)  * 150;
  const f2 = 1300 + Math.sin(t * 0.87) * 300;
  const f3 = 2500 + Math.sin(t * 0.54) * 200;
  const bw1 = 120, bw2 = 180, bw3 = 250;

  const amp = voiced * (0.7 + Math.sin(t * 2.7) * 0.15);

  for (let i = 0; i < bins; i++) {
    const hz = (i + 0.5) * binHz;

    // Harmonic series (8 harmonics, each 1/h amplitude)
    let harmonicEnergy = 0;
    for (let h = 1; h <= 8; h++) {
      const dist = Math.abs(hz - f0 * h);
      harmonicEnergy += (1 / h) * Math.exp(-(dist * dist) / (2 * 40 * 40));
    }

    // Formant resonances
    const res1 = 0.90 * Math.exp(-Math.pow(hz - f1, 2) / (2 * bw1 * bw1));
    const res2 = 0.65 * Math.exp(-Math.pow(hz - f2, 2) / (2 * bw2 * bw2));
    const res3 = 0.35 * Math.exp(-Math.pow(hz - f3, 2) / (2 * bw3 * bw3));

    // Breathiness / aspiration band at ~3 kHz
    const breath = 0.18 * Math.exp(-Math.pow(hz - 3000, 2) / (2 * 1200 * 1200));

    out[i] = amp * harmonicEnergy * (1 + res1 + res2 + res3) + breath * (0.3 + voiced * 0.5);
  }

  // Normalise to 0–240
  let peak = 0;
  for (let i = 0; i < bins; i++) if (out[i] > peak) peak = out[i];
  if (peak > 0) for (let i = 0; i < bins; i++) out[i] = Math.min(240, (out[i] / peak) * 240 * amp + 4);

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AIAudioVisualizer({ isSpeaking }: AIAudioVisualizerProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animationRef  = useRef<number>(0);
  const isSpeakingRef = useRef(isSpeaking);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  useEffect(() => {
    if (!isSpeaking || !canvasRef.current) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let usingRealAudio = false;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;

      for (const el of Array.from(document.querySelectorAll('audio'))) {
        if (!(el as HTMLAudioElement).paused) {
          try {
            audioContext.createMediaElementSource(el as HTMLAudioElement).connect(analyser!);
            analyser!.connect(audioContext.destination);
            usingRealAudio = true;
          } catch { /* already connected */ }
          break;
        }
      }
    } catch { /* AudioContext unavailable */ }

    const BINS      = 32;
    const dataArray = new Uint8Array(BINS);
    const canvas    = canvasRef.current!;
    const ctx       = canvas.getContext('2d')!;
    const startT    = performance.now();
    const smoothed  = new Float32Array(BINS).fill(0);

    const draw = () => {
      if (!isSpeakingRef.current) return;
      animationRef.current = requestAnimationFrame(draw);

      const elapsed = (performance.now() - startT) / 1000;

      // Prefer real audio; fall back to speech model
      let raw: ArrayLike<number> = dataArray;
      if (usingRealAudio && analyser) {
        try { analyser.getByteFrequencyData(dataArray); } catch { usingRealAudio = false; }
      }
      const hasSignal = usingRealAudio && Array.from(dataArray).some(v => v > 8);
      if (!hasSignal) raw = computeSpeechBins(elapsed, BINS);

      // VU-meter smoothing: fast attack, slow decay
      for (let i = 0; i < BINS; i++) {
        const target = raw[i] as number;
        smoothed[i] += (target - smoothed[i]) * (target > smoothed[i] ? 0.45 : 0.18);
      }

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const barW   = 3.5;
      const gap    = 2;
      const totalW = BINS * (barW + gap) - gap;
      let x = (W - totalW) / 2;

      for (let i = 0; i < BINS; i++) {
        const pct = Math.min(1, smoothed[i] / 240);
        const pos = (i / (BINS - 1) - 0.5) * 2;
        const env = Math.exp(-pos * pos * 1.8); // Gaussian spatial envelope

        const barH = Math.max(2, pct * H * 0.9 * Math.max(0.1, env));
        const y    = (H - barH) / 2;

        const hue   = 185 + (i / BINS) * 75;
        const sat   = 88 + pct * 12;
        const lit   = 48 + pct * 30;
        const alpha = 0.4 + pct * 0.6;

        ctx.fillStyle = `hsla(${hue},${sat}%,${lit}%,${alpha})`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, barW / 2);
        else ctx.rect(x, y, barW, barH);
        ctx.fill();

        x += barW + gap;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      try { audioContext?.close(); } catch { /* closed */ }
    };
  }, [isSpeaking]);

  if (!isSpeaking) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '5.5rem', left: '50%',
      transform: 'translateX(-50%)', zIndex: 50,
      fontFamily: "'DM Mono','Fira Code',monospace",
    }}>
      {/* Ambient glow halo */}
      <div style={{
        position: 'absolute', inset: '-8px', borderRadius: '9999px',
        background: 'radial-gradient(ellipse,rgba(56,189,248,0.22) 0%,transparent 70%)',
        filter: 'blur(10px)', pointerEvents: 'none',
      }} />

      {/* Main pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 20px 10px 16px', borderRadius: '9999px',
        background: 'linear-gradient(135deg,#0d1117 0%,#0f1f2e 50%,#0d1117 100%)',
        border: '1px solid rgba(56,189,248,0.3)',
        boxShadow: '0 0 0 1px rgba(56,189,248,0.07),0 8px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        animation: 'fadeSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Pulsing orb */}
        <div style={{ position:'relative', width:14, height:14, flexShrink:0 }}>
          <span style={{
            position:'absolute', inset:0, borderRadius:'50%',
            background:'rgba(56,189,248,0.35)',
            animation:'ping 1.4s cubic-bezier(0,0,0.2,1) infinite',
          }} />
          <span style={{
            position:'relative', display:'block',
            width:10, height:10, margin:2, borderRadius:'50%',
            background:'linear-gradient(135deg,#38bdf8,#818cf8)',
            boxShadow:'0 0 8px rgba(56,189,248,0.75)',
          }} />
        </div>

        <span style={{
          fontSize:11, fontWeight:600, letterSpacing:'0.12em',
          textTransform:'uppercase', color:'rgba(186,230,253,0.9)',
        }}>Speaking</span>

        <div style={{
          width:1, height:18,
          background:'linear-gradient(to bottom,transparent,rgba(56,189,248,0.3),transparent)',
        }} />

        <canvas ref={canvasRef} width={152} height={32} style={{ display:'block' }} />
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(12px) scale(0.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes ping {
          0%       { transform:scale(1);   opacity:0.75; }
          75%,100% { transform:scale(2.1); opacity:0;    }
        }
      `}</style>
    </div>
  );
}