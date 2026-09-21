import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

const DECLARATIONS = `
uniform float border_width;
uniform vec4 border_color;
uniform vec2 pixel_step;
uniform float rounded_enabled;
uniform float corner_radius;
`;

const CODE = `
    vec2 pixel = cogl_tex_coord0_in.xy / pixel_step;
    vec2 size = vec2(1.0 / pixel_step.x, 1.0 / pixel_step.y);

    vec2 point = pixel - (size * 0.5);
    vec2 outer_half_size = size * 0.5;
    float radius = min(corner_radius, min(outer_half_size.x, outer_half_size.y));

    vec2 outer_q = abs(point) - outer_half_size + vec2(radius);
    float outer_distance = length(max(outer_q, vec2(0.0))) +
        min(max(outer_q.x, outer_q.y), 0.0) - radius;

    float outer_alpha = 1.0;
    float outer_aa = 1.0;
    float border = 0.0;
    if (rounded_enabled > 0.5) {
        vec2 inner_half_size = max(outer_half_size - vec2(border_width), vec2(0.0));
        float inner_radius = max(radius - border_width, 0.0);
        vec2 inner_q = abs(point) - inner_half_size + vec2(inner_radius);
        float inner_distance = length(max(inner_q, vec2(0.0))) +
            min(max(inner_q.x, inner_q.y), 0.0) - inner_radius;

        outer_aa = max(fwidth(outer_distance), 0.75);
        float inner_aa = max(fwidth(inner_distance), 0.75);
        outer_alpha = 1.0 - smoothstep(0.0, outer_aa, outer_distance);
        float inner_alpha = 1.0 - smoothstep(0.0, inner_aa, inner_distance);
        border = clamp(outer_alpha - inner_alpha, 0.0, 1.0);
    } else {
        float inside_left = step(border_width, pixel.x);
        float inside_right = step(border_width, size.x - pixel.x);
        float inside_top = step(border_width, pixel.y);
        float inside_bottom = step(border_width, size.y - pixel.y);
        float interior = inside_left * inside_right * inside_top * inside_bottom;
        border = 1.0 - interior;
    }

    if (rounded_enabled > 0.5 && outer_distance > outer_aa)
        discard;

    vec4 original = cogl_color_out;
    vec4 border_pixel = vec4(border_color.rgb, 1.0);
    cogl_color_out = mix(original, border_pixel, border * border_color.a);
    cogl_color_out.a *= outer_alpha;
`;

export const BORDER_EFFECT_NAME = 'better-borders-border';

export const BorderEffect = GObject.registerClass({}, class BorderEffect extends Shell.GLSLEffect {
    constructor() {
        super();

        this._borderWidthLocation = this.get_uniform_location('border_width');
        this._borderColorLocation = this.get_uniform_location('border_color');
        this._pixelStepLocation = this.get_uniform_location('pixel_step');
        this._roundedEnabledLocation = this.get_uniform_location('rounded_enabled');
        this._cornerRadiusLocation = this.get_uniform_location('corner_radius');
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(width, height, borderWidth, color, rounded, cornerRadius) {
        if (width <= 0 || height <= 0)
            return;

        this.set_uniform_float(this._borderWidthLocation, 1, [borderWidth]);
        this.set_uniform_float(this._borderColorLocation, 4, color);
        this.set_uniform_float(this._pixelStepLocation, 2, [1 / width, 1 / height]);
        this.set_uniform_float(this._roundedEnabledLocation, 1, [rounded ? 1 : 0]);
        this.set_uniform_float(this._cornerRadiusLocation, 1, [Math.max(0, cornerRadius)]);
        this.queue_repaint();
    }
});
