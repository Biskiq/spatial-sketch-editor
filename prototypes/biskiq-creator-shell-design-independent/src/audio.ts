let context: AudioContext | null = null;

export function primeAudio() {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    return context;
  } catch {
    return null;
  }
}

function tone(frequency: number, offset = 0, duration = 1.4) {
  const audio = primeAudio();
  if (!audio) return;
  // A short, decaying harmonic envelope gives the prototype an audible piano action.
  [1, 2, 3].forEach((harmonic, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * harmonic;
    const start = audio.currentTime + offset;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.11 / (index + 1), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  });
}

export function playNote() { tone([261.63, 329.63, 392, 523.25][Math.floor(Math.random() * 4)]); }
export function playPhrase() { [261.63, 329.63, 392, 523.25, 392, 329.63].forEach((frequency, i) => tone(frequency, i * 0.35, 1.3)); }
export function muteAudio() {
  if (context) void context.close();
  context = null;
}
