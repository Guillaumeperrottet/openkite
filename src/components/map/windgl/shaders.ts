// GLSL ES 3.00 shaders for GPU-accelerated wind particle rendering.

/** Vertex shader for full-screen quads (screen fade + particle update). */
export const QUAD_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_tex_pos;
void main() {
  v_tex_pos = a_pos;
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Fragment shader: draws a texture scaled by opacity. */
export const SCREEN_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_screen;
uniform float u_opacity;
in vec2 v_tex_pos;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_screen, v_tex_pos) * u_opacity;
  // premultiplied alpha (MapLibre expects gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  fragColor = vec4(c.rgb * c.a, c.a);
}`;

/** Vertex shader: reads particle state texture, projects to Mercator clip space. */
export const DRAW_VERT = `#version 300 es
precision highp float;

uniform sampler2D u_particles;
uniform float u_particles_res;
uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform vec4 u_wind_bounds; // lng0, lat0, lng1, lat1
uniform mat4 u_matrix;      // MapLibre modelViewProjection
uniform float u_point_size;

in float a_index;
out float v_speed_t;

const float PI = 3.14159265359;

void main() {
  vec4 color = texture(u_particles, vec2(
    fract(a_index / u_particles_res),
    floor(a_index / u_particles_res) / u_particles_res
  ));

  // Decode 16-bit position from RGBA
  vec2 pos = vec2(
    color.r / 255.0 + color.b,
    color.g / 255.0 + color.a
  );

  // Wind speed for coloring (absolute km/h, capped at 80)
  vec2 velocity = mix(u_wind_min, u_wind_max, texture(u_wind, pos).rg);
  v_speed_t = clamp(length(velocity) / 80.0, 0.0, 1.0);

  // UV → lng/lat
  float lng = mix(u_wind_bounds.x, u_wind_bounds.z, pos.x);
  float lat = mix(u_wind_bounds.y, u_wind_bounds.w, pos.y);

  // lng/lat → Web Mercator [0,1] × [0,1]
  float mx = (lng + 180.0) / 360.0;
  float latRad = lat * PI / 180.0;
  float my = (1.0 - log(tan(PI / 4.0 + latRad / 2.0)) / PI) / 2.0;

  gl_PointSize = u_point_size;
  gl_Position = u_matrix * vec4(mx, my, 0.0, 1.0);
}`;

/** Fragment shader: colors a particle via colour-ramp lookup (premultiplied alpha). */
export const DRAW_FRAG = `#version 300 es
precision mediump float;
uniform sampler2D u_color_ramp;
in float v_speed_t;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_color_ramp, vec2(v_speed_t, 0.5));
  fragColor = vec4(c.rgb * c.a, c.a);
}`;

/** Fragment shader: updates particle positions using the wind field. */
export const UPDATE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2 u_wind_min;
uniform vec2 u_wind_max;
uniform float u_speed_factor;
uniform float u_drop_rate;
uniform float u_drop_rate_bump;
uniform float u_rand_seed;
uniform vec4 u_wind_bounds; // lng0, lat0, lng1, lat1

in vec2 v_tex_pos;
out vec4 fragColor;

const float PI = 3.14159265359;

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture(u_particles, v_tex_pos);
  vec2 pos = vec2(
    color.r / 255.0 + color.b,
    color.g / 255.0 + color.a
  );

  vec2 velocity = mix(u_wind_min, u_wind_max, texture(u_wind, pos).rg);
  float speed_t = length(velocity) / length(u_wind_max);

  // Latitude distortion correction
  float lat = mix(u_wind_bounds.y, u_wind_bounds.w, pos.y);
  float distortion = cos(lat * PI / 180.0);

  vec2 offset = vec2(
    velocity.x / max(distortion, 0.001),
    velocity.y
  ) * u_speed_factor;

  vec2 new_pos = pos + offset;

  // Stochastic drop / reset
  vec2 seed = (pos + v_tex_pos) * u_rand_seed;
  float drop_rate = u_drop_rate + speed_t * u_drop_rate_bump;
  float drop = step(1.0 - drop_rate, rand(seed));

  // Force reset when particle leaves grid bounds
  if (new_pos.x < 0.0 || new_pos.x > 1.0 || new_pos.y < 0.0 || new_pos.y > 1.0) {
    drop = 1.0;
  }

  vec2 rnd_pos = vec2(rand(seed + 1.3), rand(seed + 2.1));
  new_pos = clamp(new_pos, 0.0, 1.0);
  new_pos = mix(new_pos, rnd_pos, drop);

  // Encode back to RGBA (16-bit per axis)
  fragColor = vec4(
    fract(new_pos * 255.0),
    floor(new_pos * 255.0) / 255.0
  );
}`;
