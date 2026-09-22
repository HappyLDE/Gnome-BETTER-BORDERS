import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

const DECLARATIONS = `
uniform vec4 border_color;
uniform vec2 pixel_step;
uniform vec4 frame_rect;
uniform vec4 stroke_outer_rect;
uniform vec4 stroke_inner_rect;
uniform float rounded_enabled;
uniform float frame_radius;
uniform float stroke_outer_radius;
uniform float stroke_inner_radius;
`;

const CODE = `
    vec2 pixel = cogl_tex_coord0_in.xy / pixel_step;
    vec2 frame_point = pixel - frame_rect.xy - (frame_rect.zw * 0.5);
    vec2 frame_half_size = frame_rect.zw * 0.5;
    float safe_frame_radius = min(frame_radius,
        min(frame_half_size.x, frame_half_size.y));
    vec2 frame_q = abs(frame_point) - frame_half_size + vec2(safe_frame_radius);
    float frame_distance = length(max(frame_q, vec2(0.0))) +
        min(max(frame_q.x, frame_q.y), 0.0) - safe_frame_radius;

    vec2 outer_point = pixel - stroke_outer_rect.xy -
        (stroke_outer_rect.zw * 0.5);
    vec2 outer_half_size = stroke_outer_rect.zw * 0.5;
    float safe_outer_radius = min(stroke_outer_radius,
        min(outer_half_size.x, outer_half_size.y));
    vec2 outer_q = abs(outer_point) - outer_half_size + vec2(safe_outer_radius);
    float outer_distance = length(max(outer_q, vec2(0.0))) +
        min(max(outer_q.x, outer_q.y), 0.0) - safe_outer_radius;

    vec2 inner_point = pixel - stroke_inner_rect.xy -
        (stroke_inner_rect.zw * 0.5);
    vec2 inner_half_size = stroke_inner_rect.zw * 0.5;
    float safe_inner_radius = min(stroke_inner_radius,
        min(inner_half_size.x, inner_half_size.y));
    vec2 inner_q = abs(inner_point) - inner_half_size + vec2(safe_inner_radius);
    float inner_distance = length(max(inner_q, vec2(0.0))) +
        min(max(inner_q.x, inner_q.y), 0.0) - safe_inner_radius;

    float outer_aa = max(fwidth(outer_distance), 0.75);
    float inner_aa = max(fwidth(inner_distance), 0.75);
    float frame_aa = max(fwidth(frame_distance), 0.75);
    float outer_alpha = 1.0 - smoothstep(0.0, outer_aa, outer_distance);
    float inner_alpha = 1.0 - smoothstep(0.0, inner_aa, inner_distance);
    float frame_alpha = 1.0 - smoothstep(0.0, frame_aa, frame_distance);
    float border = 0.0;

    if (rounded_enabled > 0.5) {
        border = clamp(outer_alpha - inner_alpha, 0.0, 1.0);
    } else {
        float inside_outer = step(stroke_outer_rect.x, pixel.x) *
            step(stroke_outer_rect.y, pixel.y) *
            step(pixel.x, stroke_outer_rect.x + stroke_outer_rect.z) *
            step(pixel.y, stroke_outer_rect.y + stroke_outer_rect.w);
        float inside_inner = step(stroke_inner_rect.x, pixel.x) *
            step(stroke_inner_rect.y, pixel.y) *
            step(pixel.x, stroke_inner_rect.x + stroke_inner_rect.z) *
            step(pixel.y, stroke_inner_rect.y + stroke_inner_rect.w);
        border = inside_outer * (1.0 - inside_inner);
    }

    if (rounded_enabled > 0.5 && outer_distance > outer_aa)
        discard;

    vec4 original = cogl_color_out;
    if (rounded_enabled > 0.5) {
        original.a *= frame_alpha;
        if (frame_distance > frame_aa && border < 0.5)
            discard;
    }

    vec4 border_pixel = vec4(border_color.rgb, 1.0);
    cogl_color_out = mix(original, border_pixel, border * border_color.a);
`;

export const BORDER_EFFECT_NAME = 'better-borders-border';

export const BorderEffect = GObject.registerClass({}, class BorderEffect extends Shell.GLSLEffect {
    constructor() {
        super();

        this._borderColorLocation = this.get_uniform_location('border_color');
        this._pixelStepLocation = this.get_uniform_location('pixel_step');
        this._frameRectLocation = this.get_uniform_location('frame_rect');
        this._strokeOuterRectLocation = this.get_uniform_location('stroke_outer_rect');
        this._strokeInnerRectLocation = this.get_uniform_location('stroke_inner_rect');
        this._roundedEnabledLocation = this.get_uniform_location('rounded_enabled');
        this._frameRadiusLocation = this.get_uniform_location('frame_radius');
        this._strokeOuterRadiusLocation = this.get_uniform_location('stroke_outer_radius');
        this._strokeInnerRadiusLocation = this.get_uniform_location('stroke_inner_radius');
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(width, height, frameRect, strokeOuterRect, strokeInnerRect,
        frameRadius, strokeOuterRadius, strokeInnerRadius, color, rounded) {
        if (width <= 0 || height <= 0)
            return;

        this.set_uniform_float(this._borderColorLocation, 4, color);
        this.set_uniform_float(this._pixelStepLocation, 2, [1 / width, 1 / height]);
        this.set_uniform_float(this._frameRectLocation, 4, frameRect);
        this.set_uniform_float(this._strokeOuterRectLocation, 4, strokeOuterRect);
        this.set_uniform_float(this._strokeInnerRectLocation, 4, strokeInnerRect);
        this.set_uniform_float(this._roundedEnabledLocation, 1, [rounded ? 1 : 0]);
        this.set_uniform_float(this._frameRadiusLocation, 1, [Math.max(0, frameRadius)]);
        this.set_uniform_float(this._strokeOuterRadiusLocation, 1,
            [Math.max(0, strokeOuterRadius)]);
        this.set_uniform_float(this._strokeInnerRadiusLocation, 1,
            [Math.max(0, strokeInnerRadius)]);
        this.queue_repaint();
    }
});
