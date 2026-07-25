import type { Container } from 'pixi.js';

/**
 * Centers the note-highway/keyboard content horizontally in the viewport.
 * There is only ever one fixed "classic" framing — straight-on, no tilt,
 * no perspective, no pan — so this has nothing left to smooth or animate.
 */
export class Camera {
  apply(container: Container, worldWidth: number, strikeLineY: number, viewportWidth: number): void {
    container.pivot.set(worldWidth / 2, strikeLineY);
    container.position.set(viewportWidth / 2, strikeLineY);
    container.scale.set(1);
    container.rotation = 0;
    container.skew.set(0, 0);
  }
}
