import Meta from 'gi://Meta';

import {BORDER_EFFECT_NAME, BorderEffect} from './border-effect.js';

function parseColor(value) {
    const match = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
    if (!match)
        return [1, 1, 1, 1];

    const hex = match[1];
    const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
    return [
        Number.parseInt(hex.slice(0, 2), 16) / 255,
        Number.parseInt(hex.slice(2, 4), 16) / 255,
        Number.parseInt(hex.slice(4, 6), 16) / 255,
        alpha / 255,
    ];
}

export default class WindowBorder {
    constructor(actor, getConfig) {
        this._actor = actor;
        this._metaWindow = actor.get_meta_window();
        this._getConfig = getConfig;
        this._renderActor = null;
        this._texture = null;
        this._textureSignal = null;
        this._effect = null;
        this._signals = [];
        this._renderSignals = [];
        this._enabled = false;
        this._config = null;
        this._darkMode = false;
    }

    enable() {
        if (this._enabled)
            return;

        this._enabled = true;
        this._connect(this._actor, 'notify::first-child', () => this._refreshEffect());
        this._connect(this._actor, 'notify::size', () => this._updateEffect());
        this._connect(this._metaWindow, 'notify::fullscreen', () => this._refreshEffect());
        this._connect(this._metaWindow, 'notify::maximized-horizontally', () => this._refreshEffect());
        this._connect(this._metaWindow, 'notify::maximized-vertically', () => this._refreshEffect());
        this._connect(this._metaWindow, 'notify::appears-focused', () => this._updateEffect());
    }

    refresh(config, darkMode) {
        if (!this._enabled)
            return;

        this._config = config;
        this._darkMode = darkMode;
        this._refreshEffect();
    }

    disable() {
        if (!this._enabled)
            return;

        this._enabled = false;
        this._removeEffect();
        this._disconnectAll(this._signals);
        this._metaWindow = null;
        this._actor = null;
        this._getConfig = null;
    }

    _refreshEffect() {
        if (!this._enabled || !this._metaWindow)
            return;

        const config = this._config ?? this._getConfig();
        const borderEnabled = config.enabled && config.width > 0;
        const roundedEnabled = this._shouldRound(config);
        const shouldRender = this._isSupportedWindow() && (borderEnabled || roundedEnabled);
        if (!shouldRender) {
            this._removeEffect();
            return;
        }

        const renderActor = this._getRenderActor();
        if (!renderActor) {
            this._removeEffect();
            return;
        }

        if (renderActor !== this._renderActor) {
            this._removeEffect();
            this._renderActor = renderActor;
            this._connectRenderActorSignals();
        }

        if (!this._effect) {
            this._effect = new BorderEffect();
            this._renderActor.add_effect_with_name(BORDER_EFFECT_NAME, this._effect);
            this._effect.enabled = true;
        }

        this._updateEffect();
    }

    _updateEffect() {
        if (!this._effect || !this._renderActor || !this._config)
            return;

        const color = this._isFocused()
            ? (this._darkMode ? this._config.darkActive : this._config.lightActive)
            : (this._darkMode ? this._config.darkInactive : this._config.lightInactive);
        const rounded = this._shouldRound(this._config);
        const geometry = this._getFrameGeometry();
        this._effect.update(
            this._renderActor.get_width(),
            this._renderActor.get_height(),
            geometry.frameRect,
            this._config.enabled ? this._config.width * geometry.scale : 0,
            parseColor(color),
            rounded,
            this._config.cornerRadius * geometry.scale);
    }

    _getRenderActor() {
        if (this._metaWindow.get_client_type?.() === Meta.WindowClientType.X11)
            return this._actor.get_first_child();

        return this._actor;
    }

    _getFrameGeometry() {
        const renderWidth = this._renderActor.get_width();
        const renderHeight = this._renderActor.get_height();
        const frame = this._metaWindow.get_frame_rect();
        const buffer = this._metaWindow.get_buffer_rect();

        if (frame.width <= 0 || frame.height <= 0 || buffer.width <= 0 || buffer.height <= 0)
            return {frameRect: [0, 0, renderWidth, renderHeight], scale: 1};

        const scaleX = renderWidth / buffer.width;
        const scaleY = renderHeight / buffer.height;
        const renderX = this._renderActor === this._actor ? 0 : this._renderActor.get_x();
        const renderY = this._renderActor === this._actor ? 0 : this._renderActor.get_y();

        return {
            frameRect: [
                (frame.x - buffer.x) * scaleX - renderX,
                (frame.y - buffer.y) * scaleY - renderY,
                frame.width * scaleX,
                frame.height * scaleY,
            ],
            scale: (scaleX + scaleY) * 0.5,
        };
    }

    _isSupportedWindow() {
        return this._metaWindow.window_type === Meta.WindowType.NORMAL && !this._metaWindow.fullscreen;
    }

    _shouldRound(config) {
        if (!config.roundedCornersEnabled)
            return false;

        const maximized = this._metaWindow.maximized_horizontally ||
            this._metaWindow.maximized_vertically;
        return config.roundMaximizedWindows || !maximized;
    }

    _isFocused() {
        return this._metaWindow.appears_focused;
    }

    _connectRenderActorSignals() {
        this._connectTo(this._renderSignals, this._renderActor, 'notify::size', () => this._updateEffect());
        this._connectTo(this._renderSignals, this._renderActor, 'notify::texture', () => this._refreshTexture());
        this._refreshTexture();
    }

    _refreshTexture() {
        if (this._textureSignal) {
            this._textureSignal.object.disconnect(this._textureSignal.id);
            this._textureSignal = null;
        }

        this._texture = this._renderActor?.get_texture() ?? null;
        if (this._texture) {
            this._textureSignal = {
                object: this._texture,
                id: this._texture.connect('size-changed', () => this._updateEffect()),
            };
        }
    }

    _removeEffect() {
        this._disconnectAll(this._renderSignals);
        if (this._textureSignal) {
            this._textureSignal.object.disconnect(this._textureSignal.id);
            this._textureSignal = null;
        }

        if (this._renderActor && this._effect)
            this._renderActor.remove_effect_by_name(BORDER_EFFECT_NAME);

        this._effect = null;
        this._renderActor = null;
        this._texture = null;
    }

    _connect(object, signal, callback) {
        this._connectTo(this._signals, object, signal, callback);
    }

    _connectTo(collection, object, signal, callback) {
        collection.push({object, id: object.connect(signal, callback)});
    }

    _disconnectAll(collection) {
        while (collection.length > 0) {
            const connection = collection.pop();
            connection.object.disconnect(connection.id);
        }
    }
}
