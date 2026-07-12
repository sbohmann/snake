precision mediump float;

uniform float uTime;
uniform vec2 uResolution;

varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDirection = normalize(vec3(0.45, 0.75, 0.55));
    vec3 viewDirection = normalize(vec3(0.0, 0.0, 5.0) - vWorldPosition);
    vec3 halfVector = normalize(lightDirection + viewDirection);

    float diffuse = max(dot(normal, lightDirection), 0.0);
    float rim = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.2);
    float sparkle = pow(max(dot(normal, halfVector), 0.0), 34.0);
    float bands = 0.5 + 0.5 * sin((vWorldPosition.y * 7.0) + uTime * 2.4);

    vec3 deepTeal = vec3(0.06, 0.42, 0.42);
    vec3 rose = vec3(1.0, 0.32, 0.47);
    vec3 amber = vec3(1.0, 0.86, 0.56);
    vec3 blue = vec3(0.55, 0.64, 1.0);

    vec3 color = mix(deepTeal, blue, bands * 0.45);
    color += rose * rim * 0.85;
    color += amber * sparkle * 1.35;
    color *= 0.28 + diffuse * 0.95;

    gl_FragColor = vec4(color, 1.0);
}
