export interface CameraState {
  /**
   * Independent zoom for the falling-note highway only — the keyboard and
   * overall scene scale never change with this. Lower values compress more
   * upcoming notes into view with a slower-looking fall; higher values
   * spread notes out with a faster-looking fall. Purely a rendering scale
   * (pixels-per-second), so it never touches playback timing or sync.
   */
  highwayZoom: number;
}
