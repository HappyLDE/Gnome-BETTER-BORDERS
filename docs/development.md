# Development workflow

## Isolated GNOME Shell testing

Use the GNOME Shell Devkit workflow for renderer development. Ubuntu systems
need the `mutter-dev-bin` package installed first:

```sh
./scripts/run-nested.sh -- sh -c 'gnome-calculator & gnome-text-editor & wait'
```

The script starts GNOME Shell 50 with `--devkit --wayland`. It deliberately
does not pass `--display-server` or `--replace`; the primary Shell remains the
compositor that owns the visible Devkit window. The Devkit creates a separate
nested compositor and private `dbus-run-session`.

At startup the script copies the current repository runtime files into a
temporary per-user data directory and compiles the schema there. Restarting
the script therefore imports fresh JavaScript modules without touching the
installed primary-session extension. Temporary XDG data, config, cache, and
state directories are used. `GSETTINGS_BACKEND=keyfile` keeps nested settings
out of the primary dconf database; the temporary state is removed on exit.

The Devkit control surface uses the existing parent Wayland display, while
applications passed after `--` inherit the nested Wayland socket, an empty
`DISPLAY`, `GDK_BACKEND=wayland`, and the private D-Bus session. Test
applications belong to the nested compositor and are terminated when the
nested test ends. Multiple applications can be launched through `sh -c`, as
shown above.

Set `KEEP_NESTED_STATE=1` when preserving the nested Shell log and temporary
state is useful for diagnosis. Stop the workflow with Ctrl+C in the terminal
running the script; this only stops the nested Shell and its test applications.

The script prints the nested Shell extension information after startup. The
primary Shell PID is checked before launch and again during cleanup.
