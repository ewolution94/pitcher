// Keys, the Camelot wheel, tempo ratios, the address and the text Copy writes.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestMultiple,
  camelot,
  formatPercent,
  formatShift,
  keyFromCamelot,
  keyName,
  parseBpm,
  semitonesOf,
  shortestShift,
  transpose,
} from '../src/lib/music.ts';
import { addressFor, readAddress, summaryText } from '../src/lib/share.ts';
import { isAllowedHost } from '../server/relay.mjs';

const Fsm = { pc: 6, minor: true };

test('the Camelot wheel: 8A is A minor, 8B is C major, 11A is F♯ minor', () => {
  assert.equal(camelot({ pc: 9, minor: true }), '8A');
  assert.equal(camelot({ pc: 0, minor: false }), '8B');
  assert.equal(camelot(Fsm), '11A');
  assert.equal(camelot({ pc: 8, minor: true }), '1A');
  assert.equal(camelot({ pc: 11, minor: false }), '1B');
  for (let n = 1; n <= 12; n++) {
    for (const minor of [true, false]) assert.equal(camelot(keyFromCamelot(n, minor)), `${n}${minor ? 'A' : 'B'}`);
  }
});

test('a semitone up from F♯ minor is G minor; the shortest way between keys', () => {
  assert.equal(keyName(transpose(Fsm, 1)), 'Gm');
  assert.equal(keyName(transpose(Fsm, -12)), 'F♯m');
  assert.equal(shortestShift(Fsm, { pc: 7, minor: true }), 1);
  assert.equal(shortestShift(Fsm, { pc: 1, minor: true }), -5);
  assert.equal(shortestShift(Fsm, { pc: 0, minor: true }), 6);
});

test('Resample: 116 to 128 BPM moves the pitch 1.70 semitones', () => {
  assert.equal(semitonesOf(128 / 116).toFixed(2), '1.70');
  assert.equal(semitonesOf(2), 12);
});

test('half and double time: the reading closest to the target', () => {
  assert.equal(bestMultiple(116, 128), 1);
  assert.equal(bestMultiple(116, 174), 2);
  assert.equal(bestMultiple(87, 174), 2);
  assert.equal(bestMultiple(174, 87), 0.5);
  assert.equal(bestMultiple(120, 120), 1);
});

test('how the numbers are written', () => {
  assert.equal(formatPercent(128 / 116), '+10.3%');
  assert.equal(formatPercent(174 / 232), '−25.0%');
  assert.equal(formatPercent(1), '±0.0%');
  assert.equal(formatShift(0), '±0 st');
  assert.equal(formatShift(2), '+2 st');
  assert.equal(formatShift(-1.16), '−1.16 st');
  assert.equal(parseBpm('128,5'), 128.5);
  assert.equal(parseBpm(' 140 '), 140);
  assert.equal(parseBpm('12'), null);
  assert.equal(parseBpm('fast'), null);
});

test('the address carries the video and its settings, and reads back', () => {
  const path = addressFor('5NV6Rdv1a3I', { tempo: 128, shift: 1, mode: 'keep' });
  assert.equal(path, '/?v=5NV6Rdv1a3I&bpm=128&st=1');
  const back = readAddress(new URL(path, 'https://pitcher.ewolution.cloud'));
  assert.deepEqual(back, { id: '5NV6Rdv1a3I', settings: { tempo: 128, shift: 1 } });
  assert.equal(addressFor('5NV6Rdv1a3I', { tempo: 128, shift: 1.7, mode: 'resample' }), '/?v=5NV6Rdv1a3I&bpm=128&mode=resample');
  // Read as double time: the link carries it, so it plays at the same speed wherever it's opened.
  const doubled = addressFor('5NV6Rdv1a3I', { tempo: 174, shift: 0, mode: 'keep', mult: 2 });
  assert.equal(doubled, '/?v=5NV6Rdv1a3I&bpm=174&m=2');
  assert.deepEqual(readAddress(new URL(doubled, 'https://x')).settings, { tempo: 174, mult: 2 });
});

test('YouTube addresses swapped onto Pitcher, and plain YouTube links, name the video', () => {
  assert.equal(readAddress(new URL('https://pitcher.ewolution.cloud/watch?v=5NV6Rdv1a3I')).id, '5NV6Rdv1a3I');
  assert.equal(readAddress(new URL('https://youtu.be/5NV6Rdv1a3I?t=30')).id, '5NV6Rdv1a3I');
  assert.equal(readAddress(new URL('https://pitcher.ewolution.cloud/')).id, null);
  assert.equal(readAddress(new URL('https://pitcher.ewolution.cloud/?v=nope')).id, null);
  assert.deepEqual(readAddress(new URL('https://x/?v=5NV6Rdv1a3I&bpm=999&st=40&m=3')).settings, {});
});

test('Copy writes the numbers a DAW needs and the link back', () => {
  const text = summaryText({
    title: 'Get Lucky',
    channel: 'Daft Punk',
    source: 116,
    base: 116,
    tempo: 128,
    key: Fsm,
    shift: 1,
    mode: 'keep',
    link: 'https://pitcher.ewolution.cloud/?v=5NV6Rdv1a3I&bpm=128&st=1',
  });
  assert.equal(
    text,
    'Get Lucky – Daft Punk\n116.0 → 128.0 BPM (+10.34%) · F♯m → Gm (+1 st) · Keep key\nhttps://pitcher.ewolution.cloud/?v=5NV6Rdv1a3I&bpm=128&st=1',
  );
  const doubled = summaryText({ title: 'X', channel: '', source: 87, base: 174, tempo: 174, key: Fsm, shift: 0, mode: 'resample', link: null });
  assert.equal(doubled, 'X\n87.0 (read as 174) → 174.0 BPM (±0.00%) · F♯m · Resample');
});

test('the relay only reaches YouTube', () => {
  for (const host of ['www.youtube.com', 'rr3---sn-4g5e6nzz.googlevideo.com', 'i.ytimg.com', 'youtubei.googleapis.com']) assert.ok(isAllowedHost(host), host);
  for (const host of ['example.com', 'youtube.com.evil.net', 'googleapis.com', '192.168.178.36', 'census']) assert.ok(!isAllowedHost(host), host);
});
