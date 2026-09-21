/*
 * Window lifecycle ownership boundary for the future renderer.
 *
 * Gate 1 intentionally does not track or modify windows. Gate 2 can add
 * window-created/window-removed handling here and delegate per-window visual
 * ownership to EffectManager without turning extension.js into a monolith.
 */
export default class WindowManager {
    constructor(settings, effectManager) {
        this._settings = settings;
        this._effectManager = effectManager;
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        // Gate 2 will disconnect window signals and release per-window state here.
        this._enabled = false;
        this._effectManager = null;
        this._settings = null;
    }
}
