import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BetterBordersPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._bindings = [];
        this._connections = [];

        const page = new Adw.PreferencesPage({
            title: 'GNOME Better Borders',
        });

        page.add(this._createBordersGroup());
        page.add(this._createCornersGroup());
        page.add(this._createShadowsGroup());
        window.add(page);

        const closeRequestId = window.connect('close-request', () => {
            this._cleanup();
            return false;
        });
        this._connections.push({object: window, id: closeRequestId});
    }

    _createBordersGroup() {
        const group = new Adw.PreferencesGroup({title: 'Borders'});

        group.add(this._bindSwitch('border-enabled', 'Enable'));
        group.add(this._bindSpin('border-width', 'Width', 0, 16, 1));
        group.add(this._createColorRow(
            'dark-active-border-color', 'Dark mode active color'));
        group.add(this._createColorRow(
            'dark-inactive-border-color', 'Dark mode inactive color'));
        group.add(this._createColorRow(
            'light-active-border-color', 'Light mode active color'));
        group.add(this._createColorRow(
            'light-inactive-border-color', 'Light mode inactive color'));

        return group;
    }

    _createCornersGroup() {
        const group = new Adw.PreferencesGroup({title: 'Corners'});

        group.add(this._bindSwitch('rounded-corners-enabled', 'Enable'));
        group.add(this._bindSpin('corner-radius', 'Radius', 0, 64, 1));
        group.add(this._bindSwitch('round-maximized-windows', 'Round maximized windows'));

        return group;
    }

    _createShadowsGroup() {
        const group = new Adw.PreferencesGroup({title: 'Shadows'});

        group.add(this._bindSwitch('shadows-enabled', 'Enable'));
        group.add(this._bindSpin(
            'active-shadow-strength', 'Active window strength', 0, 1, 0.05, 2));
        group.add(this._bindSpin(
            'inactive-shadow-strength', 'Inactive window strength', 0, 1, 0.05, 2));

        return group;
    }

    _bindSwitch(key, title) {
        const row = new Adw.SwitchRow({title});
        this._bind(key, row, 'active');
        return row;
    }

    _bindSpin(key, title, lower, upper, step, digits = 0) {
        const adjustment = new Gtk.Adjustment({
            lower,
            upper,
            step_increment: step,
            page_increment: step * 5,
        });
        const row = new Adw.SpinRow({
            title,
            adjustment,
            digits,
            numeric: true,
        });
        this._bind(key, row, 'value');
        return row;
    }

    _createColorRow(key, title) {
        const row = new Adw.ActionRow({title});
        const dialog = new Gtk.ColorDialog({with_alpha: true});
        const button = new Gtk.ColorDialogButton({dialog});

        button.set_rgba(this._rgbaFromSetting(key));
        row.add_suffix(button);
        row.set_activatable_widget(button);

        const colorChangedId = button.connect('notify::rgba', () => {
            this._settings.set_string(key, button.get_rgba().to_string());
        });
        const settingChangedId = this._settings.connect(`changed::${key}`, () => {
            button.set_rgba(this._rgbaFromSetting(key));
        });
        this._connections.push({object: button, id: colorChangedId});
        this._connections.push({object: this._settings, id: settingChangedId});

        return row;
    }

    _rgbaFromSetting(key) {
        const rgba = new Gdk.RGBA();
        if (!rgba.parse(this._settings.get_string(key)))
            rgba.parse('#000000ff');
        return rgba;
    }

    _bind(key, object, property) {
        this._settings.bind(key, object, property, Gio.SettingsBindFlags.DEFAULT);
        this._bindings.push({key, object, property});
    }

    _cleanup() {
        if (!this._settings)
            return;

        for (const {object, id} of this._connections)
            object.disconnect(id);
        for (const {object, property} of this._bindings)
            Gio.Settings.unbind(object, property);

        this._connections = [];
        this._bindings = [];
        this._settings = null;
    }
}
