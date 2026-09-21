import St from 'gi://St';

import WindowBorder from './window-border.js';

export default class EffectManager {
    constructor(settings) {
        this._settings = settings;
        this._windows = new Map();
        this._enabled = false;
        this._settingsChangedId = 0;
        this._colorSchemeChangedId = 0;
        this._stSettings = null;
    }

    enable() {
        if (this._enabled)
            return;

        this._enabled = true;
        this._stSettings = St.Settings.get();
        this._settingsChangedId = this._settings.connect('changed', () => this._refreshAll());
        this._colorSchemeChangedId = this._stSettings.connect('notify::color-scheme', () => this._refreshAll());
        this._refreshAll();
    }

    addWindow(actor) {
        if (!this._enabled || this._windows.has(actor))
            return;

        const window = new WindowBorder(actor, () => this._getConfig());
        this._windows.set(actor, window);
        window.enable();
        window.refresh(this._getConfig(), this._isDarkMode());
    }

    removeWindow(actor) {
        const window = this._windows.get(actor);
        if (!window)
            return;

        window.disable();
        this._windows.delete(actor);
    }

    _refreshAll() {
        if (!this._enabled)
            return;

        const config = this._getConfig();
        const darkMode = this._isDarkMode();
        for (const window of this._windows.values())
            window.refresh(config, darkMode);
    }

    _getConfig() {
        return {
            enabled: this._settings.get_boolean('border-enabled'),
            width: this._settings.get_int('border-width'),
            roundedCornersEnabled: this._settings.get_boolean('rounded-corners-enabled'),
            cornerRadius: this._settings.get_int('corner-radius'),
            roundMaximizedWindows: this._settings.get_boolean('round-maximized-windows'),
            darkActive: this._settings.get_string('dark-active-border-color'),
            darkInactive: this._settings.get_string('dark-inactive-border-color'),
            lightActive: this._settings.get_string('light-active-border-color'),
            lightInactive: this._settings.get_string('light-inactive-border-color'),
        };
    }

    _isDarkMode() {
        return this._stSettings.color_scheme === St.SystemColorScheme.PREFER_DARK;
    }

    disable() {
        if (!this._enabled)
            return;

        for (const actor of [...this._windows.keys()])
            this.removeWindow(actor);

        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = 0;
        }

        if (this._stSettings && this._colorSchemeChangedId) {
            this._stSettings.disconnect(this._colorSchemeChangedId);
            this._colorSchemeChangedId = 0;
        }

        this._enabled = false;
        this._stSettings = null;
        this._settings = null;
    }
}
