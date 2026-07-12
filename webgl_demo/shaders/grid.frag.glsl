precision mediump float;

varying float vPulse;

void main() {
    vec3 base = vec3(0.18, 0.78, 0.74);
    vec3 highlight = vec3(1.0, 0.32, 0.47);
    gl_FragColor = vec4(mix(base, highlight, vPulse * 0.35), 0.62);
}
