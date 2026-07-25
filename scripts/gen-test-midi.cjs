const { Midi } = require('@tonejs/midi');
const fs = require('fs');
const path = require('path');

const midi = new Midi();
midi.header.setTempo(112);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
midi.header.keySignatures.push({ ticks: 0, key: 'C', scale: 'major' });
midi.header.name = 'PianoFlow Test Song';

// Right hand: a simple ascending/descending melody with a chord.
const rightHand = midi.addTrack();
rightHand.name = 'Right Hand';
rightHand.channel = 0;
const melody = [60, 62, 64, 65, 67, 69, 71, 72];
melody.forEach((midiNote, i) => {
  rightHand.addNote({ midi: midiNote, time: i * 0.4, duration: 0.38, velocity: 0.5 + (i % 4) * 0.1 });
});
// A chord (C major) held with sustain.
rightHand.addNote({ midi: 60, time: 4, duration: 2, velocity: 0.8 });
rightHand.addNote({ midi: 64, time: 4, duration: 2, velocity: 0.75 });
rightHand.addNote({ midi: 67, time: 4, duration: 2, velocity: 0.7 });

// Sustain pedal down through the chord, released after.
rightHand.addCC({ number: 64, value: 1, time: 3.9 });
rightHand.addCC({ number: 64, value: 0, time: 6.3 });

// Left hand: bass notes.
const leftHand = midi.addTrack();
leftHand.name = 'Left Hand';
leftHand.channel = 1;
const bass = [36, 43, 41, 43];
bass.forEach((midiNote, i) => {
  leftHand.addNote({ midi: midiNote, time: i * 0.8, duration: 0.75, velocity: 0.6 });
});
leftHand.addNote({ midi: 36, time: 4, duration: 2, velocity: 0.65 });

const bytes = midi.toArray();
const outPath = path.join(__dirname, '..', 'public', 'test.mid');
fs.writeFileSync(outPath, Buffer.from(bytes));
console.log('Wrote', outPath, bytes.length, 'bytes, duration', midi.duration.toFixed(2), 's');
