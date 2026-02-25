import { BitmapFont } from 'pixi.js';

/**
 * Install pixel art bitmap font for signpost text.
 * Must be called once at world init before any BitmapText is created.
 * Uses nearest-neighbor scaleMode for crisp pixel rendering.
 */
export function installPixelFont(): void {
  BitmapFont.install({
    name: 'PixelSignpost',
    style: {
      fontFamily: 'monospace',
      fontSize: 16,
      fill: '#ffffff',
    },
    chars: [
      ['a', 'z'],
      ['A', 'Z'],
      ['0', '9'],
      [' ', ' '],
      ['-', '-'],
      ['.', '.'],
      ['_', '_'],
      ['/', '/'],
      ['\\', '\\'],
    ],
    textureStyle: {
      scaleMode: 'nearest', // crisp pixels, no interpolation
    },
  });
}
