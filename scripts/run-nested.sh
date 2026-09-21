#!/usr/bin/env bash
set -Eeuo pipefail

readonly UUID='better-borders@leosilver.dev'
readonly REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly PARENT_WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-}"
readonly PARENT_DISPLAY="${DISPLAY:-}"
readonly RUNTIME_DIR="${XDG_RUNTIME_DIR:-}"
readonly PRIMARY_SHELL_PID="$(pgrep -xo gnome-shell || true)"
readonly DEVKIT_BIN='/usr/libexec/mutter-devkit'

fail() {
    printf 'run-nested.sh: %s\n' "$1" >&2
    exit 1
}

[[ -n "$PARENT_WAYLAND_DISPLAY" ]] || fail 'WAYLAND_DISPLAY is not set; run this inside a Wayland session.'
[[ -n "$RUNTIME_DIR" ]] || fail 'XDG_RUNTIME_DIR is not set.'
[[ -n "$PRIMARY_SHELL_PID" ]] || fail 'Could not identify the primary GNOME Shell process.'
kill -0 "$PRIMARY_SHELL_PID" 2>/dev/null || fail 'The primary GNOME Shell process is not running.'
[[ -x "$DEVKIT_BIN" ]] || fail 'Mutter Devkit is missing; install the mutter-dev-bin package first.'

if [[ "${1:-}" == '--' ]]; then
    shift
fi
test_command=("$@")

state_dir="$(mktemp -d "${TMPDIR:-/tmp}/better-borders-nested.XXXXXX")"
data_home="$state_dir/data"
config_home="$state_dir/config"
cache_home="$state_dir/cache"
state_home="$state_dir/state"
extension_dir="$data_home/gnome-shell/extensions/$UUID"
log_file="$state_dir/gnome-shell.log"

cleanup() {
    local status=$?
    trap - EXIT INT TERM

    if [[ "${KEEP_NESTED_STATE:-0}" != '1' ]]; then
        rm -rf -- "$state_dir"
    else
        printf 'Nested state preserved at %s\n' "$state_dir" >&2
    fi

    if ! kill -0 "$PRIMARY_SHELL_PID" 2>/dev/null; then
        printf 'run-nested.sh: primary GNOME Shell exited unexpectedly (pid %s)\n' "$PRIMARY_SHELL_PID" >&2
        status=1
    fi

    exit "$status"
}
trap cleanup EXIT INT TERM

mkdir -p "$extension_dir"
cp -- "$REPO_ROOT/metadata.json" "$REPO_ROOT/extension.js" "$REPO_ROOT/prefs.js" "$extension_dir/"
cp -a -- "$REPO_ROOT/src" "$extension_dir/src"
cp -a -- "$REPO_ROOT/schemas" "$extension_dir/schemas"
glib-compile-schemas --strict "$extension_dir/schemas"

export XDG_DATA_HOME="$data_home"
export XDG_CONFIG_HOME="$config_home"
export XDG_CACHE_HOME="$cache_home"
export XDG_STATE_HOME="$state_home"
export GSETTINGS_BACKEND=keyfile
export WAYLAND_DISPLAY="$PARENT_WAYLAND_DISPLAY"
export DISPLAY="$PARENT_DISPLAY"
export GDK_BACKEND=wayland

gsettings set org.gnome.shell allow-extension-installation true
gsettings set org.gnome.shell enabled-extensions "['$UUID']"
gsettings set org.gnome.shell disabled-extensions '[]'

GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders border-enabled true
GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders border-width 4
GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders dark-active-border-color "'#1e90ffff'"
GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders dark-inactive-border-color "'#7f8c8dff'"
GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders light-active-border-color "'#0057ffff'"
GSETTINGS_SCHEMA_DIR="$extension_dir/schemas" gsettings set \
    org.gnome.shell.extensions.better-borders light-inactive-border-color "'#888888ff'"

printf 'Starting isolated nested GNOME Shell.\n'
printf 'Primary Shell PID: %s\n' "$PRIMARY_SHELL_PID"
printf 'Nested log: %s\n' "$log_file"

dbus-run-session -- bash -c '
    set -Eeuo pipefail

    log_file=$1
    shift
    uuid=better-borders@leosilver.dev
    shell_pid=
    app_pid=
    nested_display=
    info_file="${log_file}.extension-info"

    cleanup_nested() {
        local status=$?
        trap - EXIT INT TERM

        if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then
            kill "$app_pid" 2>/dev/null || true
            wait "$app_pid" 2>/dev/null || true
        fi
        if [[ -n "$shell_pid" ]] && kill -0 "$shell_pid" 2>/dev/null; then
            kill "$shell_pid" 2>/dev/null || true
            wait "$shell_pid" 2>/dev/null || true
        fi

        exit "$status"
    }
    trap cleanup_nested EXIT INT TERM

    /usr/bin/gnome-shell --devkit --wayland >"$log_file" 2>&1 &
    shell_pid=$!

    ready=0
    for _ in {1..100}; do
        if [[ -z "$nested_display" ]]; then
            display_line=$(rg -o "Using Wayland display name .*" "$log_file" | tail -1 || true)
            quote=$(printf "\\x27")
            if [[ "$display_line" == *"$quote"* ]]; then
                nested_display="${display_line#*"$quote"}"
                nested_display="${nested_display%%"$quote"*}"
            fi
        fi

        if [[ -n "$nested_display" ]] && gdbus call --session \
            --dest org.gnome.Shell \
            --object-path /org/gnome/Shell \
            --method org.gnome.Shell.Extensions.GetExtensionInfo \
            "$uuid" >"$info_file" 2>&1; then
            ready=1
            break
        fi
        if ! kill -0 "$shell_pid" 2>/dev/null; then
            wait "$shell_pid" || true
            printf "Nested GNOME Shell exited before exposing its extension service.\n" >&2
            cat "$log_file" >&2 || true
            exit 1
        fi
        sleep 0.1
    done

    if [[ "$ready" != 1 ]]; then
        printf "Nested GNOME Shell did not expose its extension service.\n" >&2
        cat "$log_file" >&2 || true
        exit 1
    fi

    nested_info=$(cat "$info_file")
    rm -f -- "$info_file"
    printf "Nested Better Borders: %s\n" "$nested_info"
    printf "Nested Wayland socket: %s\n" "$nested_display"

    if (( $# > 0 )); then
        WAYLAND_DISPLAY="$nested_display" DISPLAY= GDK_BACKEND=wayland "$@" &
        app_pid=$!
        printf "Test application PID: %s\n" "$app_pid"
    fi

    wait "$shell_pid"
' _ "$log_file" "${test_command[@]}"
