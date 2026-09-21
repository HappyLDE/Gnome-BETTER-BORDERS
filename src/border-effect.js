import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

const DECLARATIONS = `
uniform float border_width;
uniform vec4 border_color;
uniform vec2 pixel_step;
`;

const CODE = `
    vec2 pixel = cogl_tex_coord0_in.xy / pixel_step;
    vec2 size = vec2(1.0 / pixel_step.x, 1.0 / pixel_step.y);

    float inside_left = step(border_width, pixel.x);
    float inside_right = step(border_width, size.x - pixel.x);
    float inside_top = step(border_width, pixel.y);
    float inside_bottom = step(border_width, size.y - pixel.y);
    float interior = inside_left * inside_right * inside_top * inside_bottom;
    float border = 1.0 - interior;

    vec4 original = cogl_color_out;
    vec4 border_pixel = vec4(border_color.rgb, 1.0);
    cogl_color_out = mix(original, border_pixel, border * border_color.a);
`;

export const BORDER_EFFECT_NAME = 'better-borders-border';

export const BorderEffect = GObject.registerClass({}, class BorderEffect extends Shell.GLSLEffect {
    constructor() {
        super();

        this._borderWidthLocation = this.get_uniform_location('border_width');
        this._borderColorLocation = this.get_uniform_location('border_color');
        this._pixelStepLocation = this.get_uniform_location('pixel_step');
    }

    vfunc_build_pipeline() {
        this.add_glsl_snippet(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE, false);
    }

    update(width, height, borderWidth, color) {
        if (width <= 0 || height <= 0)
            return;

        this.set_uniform_float(this._borderWidthLocation, 1, [borderWidth]);
        this.set_uniform_float(this._borderColorLocation, 4, color);
        this.set_uniform_float(this._pixelStepLocation, 2, [1 / width, 1 / height]);
        this.queue_repaint();
    }
});
