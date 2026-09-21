/*
 * Effect ownership boundary for the future renderer.
 *
 * Gate 1 intentionally does not add effects to MetaWindowActor instances.
 * Gate 2 can keep all GLSLEffect, clip, and shadow actor ownership here so
 * extension.js remains a lifecycle coordinator.
 */
export default class EffectManager {
    constructor(settings) {
        this._settings = settings;
        this._enabled = false;
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        // Gate 2 will remove effects and destroy shadow actors here.
        this._enabled = false;
        this._settings = null;
    }
}
