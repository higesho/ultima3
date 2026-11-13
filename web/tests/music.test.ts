import { describe, it, expect } from 'vitest';
import { MusicPlayer } from '../src/ui/music.ts';

// The Mac's songs (QuickTime music) are not in this branch, which ships none of the original's: the parser is not
// tested against them here.

describe('the music player', () => {
  /** A stand-in AudioContext: the player only needs a gain node and a state. */
  class FakeContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    static last: FakeContext | null = null;
    constructor() {
      FakeContext.last = this;
    }
    createGain() {
      return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
    }
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    }
  }

  async function player(): Promise<MusicPlayer> {
    (globalThis as { AudioContext?: unknown }).AudioContext = FakeContext;
    (globalThis as { fetch?: unknown }).fetch = () => Promise.reject(new Error('no files in tests'));
    return new MusicPlayer();
  }

  it('stays silent while off, whatever the game asks for, and resumes the wanted track when turned on', async () => {
    const m = await player();
    m.enabled = false;
    m.play(1); // Sosaria, asked for while music is off
    m.unlock(); // the first key press
    expect(m.active).toBe(0); // off means off, even after the unlock
    m.enabled = true;
    expect(m.active).toBe(1); // on resumes the track the game wanted
    m.enabled = false;
    expect(m.active).toBe(0);
  });

  it('holds the audio clock while the game is paused, and a key during the pause does not restart it', async () => {
    const m = await player();
    m.play(1);
    m.unlock();
    const ctx = FakeContext.last!;
    expect(ctx.state).toBe('running');
    m.pause();
    expect(ctx.state).toBe('suspended');
    m.unlock(); // a gamepad press while the window is unfocused
    expect(ctx.state).toBe('suspended');
    m.resume();
    expect(ctx.state).toBe('running');
    expect(m.active).toBe(1); // the same tune, from where it stopped
  });

  it('plays at the Music level, stops at Off and starts again with a level, and is heard over a pause while dialled', async () => {
    const m = await player();
    m.play(1);
    m.unlock();
    const gain = () => (m as unknown as { master: { gain: { value: number } } }).master.gain.value;
    expect(m.volume).toBeCloseTo(0.35, 5); // the full level: as loud as the music always was
    m.level = 5;
    expect(m.volume).toBeCloseTo(0.35 / 4, 5);
    expect(gain()).toBeCloseTo(0.35 / 4, 5);
    m.level = 0;
    expect(m.active).toBe(0);
    m.level = 3;
    expect(m.active).toBe(1);
    const ctx = FakeContext.last!;
    m.pause(); // the Pause menu
    expect(ctx.state).toBe('suspended');
    m.hear(true); // its Music level dial
    expect(ctx.state).toBe('running');
    m.hear(false);
    expect(ctx.state).toBe('suspended');
    m.resume();
    expect(ctx.state).toBe('running');
  });

  it('waits for the unlock, then follows the track the game wants', async () => {
    const m = await player();
    m.play(2);
    expect(m.active).toBe(0); // no audio before a user gesture
    m.unlock();
    expect(m.active).toBe(2);
    m.play(2);
    expect(m.active).toBe(2); // asking again changes nothing
    m.play(5);
    expect(m.active).toBe(5);
    m.play(0);
    expect(m.active).toBe(0);
  });

  it('fades from one track into another, at once with nothing playing, and a play cuts a fade short', async () => {
    const m = await player();
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    m.unlock();
    m.fadeTo(3);
    expect(m.active).toBe(3);
    m.fadeTo(5, 0.01);
    expect(m.active).toBe(3); // still sounding as it fades
    await wait(40);
    expect(m.active).toBe(5);
    m.fadeTo(1, 0.01);
    m.play(7);
    expect(m.active).toBe(7);
    await wait(40);
    expect(m.active).toBe(7);
    // Music off: the track is remembered, for when it comes on.
    m.enabled = false;
    m.fadeTo(2);
    expect(m.active).toBe(0);
    m.enabled = true;
    expect(m.active).toBe(2);
  });
});
