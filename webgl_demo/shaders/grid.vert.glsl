attribute vec2 aPosition;

uniform float uTime;
uniform mat4 uViewProjection;

varying float vPulse;

void main() {
    float distanceFromCenter = length(aPosition);
    float wave = sin(distanceFromCenter * 2.8 - uTime * 3.0);
    vec3 position = vec3(aPosition.x, -1.15 + wave * 0.06, aPosition.y);
    vPulse = 0.5 + 0.5 * wave;
    gl_Position = uViewProjection * vec4(position, 1.0);
}
