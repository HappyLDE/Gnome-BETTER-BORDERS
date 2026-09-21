export default class WindowManager {
    constructor(settings, effectManager) {
        this._settings = settings;
        this._effectManager = effectManager;
        this._enabled = false;
        this._actors = new Set();
        this._pendingWindows = new Map();
        this._actorSignals = new Map();
        this._signals = [];
    }

    enable() {
        if (this._enabled)
            return;

        this._enabled = true;
        this._connect(global.display, 'window-created', (_display, metaWindow) => {
            this._trackWindow(metaWindow);
        });
        this._connect(global.window_manager, 'destroy', (_manager, actor) => {
            this._untrackActor(actor);
        });

        for (const actor of global.get_window_actors())
            this._trackActor(actor);
    }

    _trackWindow(metaWindow) {
        const actor = metaWindow.get_compositor_private();
        if (actor) {
            this._trackActor(actor);
            return;
        }

        let compositorSignalId = 0;
        let unmanagedSignalId = 0;
        try {
            const clearPending = () => {
                if (compositorSignalId)
                    metaWindow.disconnect(compositorSignalId);
                if (unmanagedSignalId)
                    metaWindow.disconnect(unmanagedSignalId);
                this._pendingWindows.delete(metaWindow);
            };

            compositorSignalId = metaWindow.connect('notify::compositor-private', () => {
                const currentActor = metaWindow.get_compositor_private();
                if (!currentActor)
                    return;

                clearPending();
                this._trackActor(currentActor);
            });
            unmanagedSignalId = metaWindow.connect('unmanaged', clearPending);
            this._pendingWindows.set(metaWindow, {compositorSignalId, unmanagedSignalId});
        } catch (error) {
            console.error(`Better Borders could not observe a new window actor: ${error.message}`);
        }
    }

    _trackActor(actor) {
        if (!this._enabled || !actor || this._actors.has(actor))
            return;

        this._actors.add(actor);
        const destroyId = actor.connect('destroy', () => this._untrackActor(actor));
        this._actorSignals.set(actor, destroyId);
        this._effectManager.addWindow(actor);
    }

    _untrackActor(actor) {
        if (!actor || !this._actors.has(actor))
            return;

        const destroyId = this._actorSignals.get(actor);
        if (destroyId) {
            actor.disconnect(destroyId);
            this._actorSignals.delete(actor);
        }
        this._actors.delete(actor);
        this._effectManager.removeWindow(actor);
    }

    _connect(object, signal, callback) {
        this._signals.push({object, id: object.connect(signal, callback)});
    }

    _disconnectAll() {
        for (const connection of this._signals)
            connection.object.disconnect(connection.id);
        this._signals = [];
    }

    disable() {
        if (!this._enabled)
            return;

        this._enabled = false;
        this._disconnectAll();

        for (const [metaWindow, signals] of this._pendingWindows) {
            metaWindow.disconnect(signals.compositorSignalId);
            metaWindow.disconnect(signals.unmanagedSignalId);
        }
        this._pendingWindows.clear();

        for (const actor of this._actors)
            this._effectManager.removeWindow(actor);
        this._actors.clear();

        this._effectManager = null;
        this._settings = null;
    }
}
