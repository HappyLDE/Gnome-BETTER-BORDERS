# Gate 1 research notes

This extension targets GNOME Shell 49 and 50 using the post-GNOME-45 ES module
APIs. Shell code should use `resource:///org/gnome/shell/...` imports, while
preferences run in their separate GTK4/libadwaita process. The extension does
not use legacy `ExtensionUtils`, `imports.*`, `Mainloop`, or Shell imports from
`prefs.js`.

## Local API inventory

The validation host currently provides GNOME Shell 50.1, Mutter 50.1, GJS
1.88.0, GTK 4.22.4, Libadwaita 1.9.1, and GLib 2.88.0. The installed Mutter
18/GNOME Shell typelibs expose the following APIs needed by the future
renderer:

- `Meta.WindowActor`: `get_meta_window()`, `get_texture()`,
  `paint_to_content()`, and `is_destroyed()`.
- `Clutter.Actor`: effect ownership (`add_effect()`, `remove_effect()`), clip
  ownership (`set_clip()`, `remove_clip()`), and `get_resource_scale()`.
- `Shell.GLSLEffect`: GLSL snippet creation plus uniform lookup and uniform
  setters.
- `Meta.Window`: `appears_focused`, `has_focus`, maximization state, and
  window-type queries.

## Gate 2 renderer direction

The current upstream pattern is to obtain `MetaWindowActor` instances from
the Shell compositor window group, attach a `Shell.GLSLEffect` to the window
actor, and keep any separately-created shadow actor under explicit ownership.
The same rounded geometry must be used for the window clip and for shadow
masking. Effect and actor removal must happen before the corresponding window
actor is destroyed, and all window/actor signals must be disconnected from the
per-window owner.

Focus updates should be driven by the display focus signal and per-window
state, with `Meta.Window.appears_focused` used where the compositor's visual
focus semantics matter. New and existing actors need the same setup path;
window creation/removal and actor destruction are separate lifecycle events.

For the light/dark color sets, the stable cross-version source for the future
manager is the `org.gnome.desktop.interface` GSettings `color-scheme` key,
observed through `changed::color-scheme`. Treat `default` as the light/default
branch unless the shell's effective color-scheme API says otherwise, and keep
the color-scheme connection owned by the manager. GNOME Shell 50 also exposes
an `St.Settings:color-scheme` property, but the GSettings observation is a
smaller 49/50-compatible seam for this extension.

## Fractional scaling constraints

The renderer must not assume that stage coordinates are integer device pixels.
Window geometry and corner radii are configured in logical pixels, while an
offscreen effect is rasterized at the actor/output resource scale. Gate 2
should therefore:

- use the actor's resource scale and framebuffer dimensions when converting
  radius, border width, and anti-aliasing distances to shader space;
- preserve fractional window geometry instead of rounding actor bounds;
- refresh effect uniforms and any shadow allocation when the actor's resource
  scale or monitor changes; and
- test 100%, 125%, 150%, and 200% scales, including a window moved between
  monitors with different scales.

This gate intentionally does not implement the shader, clipping, custom
shadows, or monitor-scale handling.

## References

- [GNOME JavaScript preferences guide](https://gjs.guide/extensions/development/preferences.html)
- [GNOME 49 developer notes](https://release.gnome.org/49/developers/)
- [GNOME 50 developer notes](https://release.gnome.org/50/developers/)
- [Mutter `Meta.Window`](https://gnome.pages.gitlab.gnome.org/mutter/meta/class.Window.html)
- [Mutter `Clutter.Actor`](https://gnome.pages.gitlab.gnome.org/mutter/clutter/method.Actor.set_offscreen_redirect.html)
- [Shell `Global.get_window_actors()`](https://gnome.pages.gitlab.gnome.org/gnome-shell/shell/method.Global.get_window_actors.html)
- [Rounded Windows implementation overview](https://github.com/Nathanaelrc/rounded-windows)
