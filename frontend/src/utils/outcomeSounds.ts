/** Синтетические звуки + голос WIN/LOSE (Web Audio + Speech). */

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  dest: AudioNode,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noiseBurst(ac: AudioContext, start: number, dur: number, gain: number, dest: AudioNode) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  const filt = ac.createBiquadFilter();
  filt.type = "bandpass";
  filt.frequency.value = 1200;
  filt.Q.value = 0.6;
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(dest);
  src.start(start);
  src.stop(start + dur);
}

function speakAnnouncer(word: "WIN" | "LOSE", delayMs: number) {
  window.setTimeout(() => {
    if (!("speechSynthesis" in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = 0.78;
      u.pitch = word === "WIN" ? 0.85 : 0.55;
      u.volume = 1;
      const voices = speechSynthesis.getVoices();
      const en = voices.find((v) => /en/i.test(v.lang) && /male|daniel|fred|google us english/i.test(v.name));
      if (en) u.voice = en;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* Telegram WebView may block TTS */
    }
  }, delayMs);
}

export function playWinOutcomeSounds(): void {
  const ac = ctx();
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);

  noiseBurst(ac, t + 0.05, 0.35, 0.25, master);
  noiseBurst(ac, t + 0.2, 0.28, 0.18, master);
  tone(ac, 392, t + 0.08, 0.25, "square", 0.12, master);
  tone(ac, 523, t + 0.14, 0.3, "square", 0.14, master);
  tone(ac, 659, t + 0.22, 0.45, "sawtooth", 0.1, master);
  tone(ac, 784, t + 0.32, 0.55, "triangle", 0.12, master);
  speakAnnouncer("WIN", 420);
}

export function playLoseOutcomeSounds(): void {
  const ac = ctx();
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.value = 0.5;
  master.connect(ac.destination);

  tone(ac, 180, t + 0.02, 0.5, "sawtooth", 0.2, master);
  tone(ac, 140, t + 0.12, 0.55, "square", 0.16, master);
  tone(ac, 95, t + 0.28, 0.7, "triangle", 0.14, master);
  noiseBurst(ac, t + 0.05, 0.4, 0.22, master);
  speakAnnouncer("LOSE", 380);
}
