import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import EffectManager from './src/effect-manager.js';
import WindowManager from './src/window-manager.js';

export default class BetterBordersExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._effectManager = new EffectManager(this._settings);
        this._windowManager = new WindowManager(this._settings, this._effectManager);

        this._effectManager.enable();
        this._windowManager.enable();
    }

    disable() {
        this._windowManager?.disable();
        this._effectManager?.disable();

        this._windowManager = null;
        this._effectManager = null;
        this._settings = null;
    }
}
