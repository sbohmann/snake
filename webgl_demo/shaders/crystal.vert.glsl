attribute vec3 aPosition;
attribute vec3 aNormal;

uniform mat4 uModel;
uniform mat4 uViewProjection;
uniform mat3 uNormalMatrix;

varying vec3 vNormal;
varying vec3 vWorldPosition;

vec3 subtal(vec3);

vec3 additional(vec3 a) {
    return subtal(3.0 * a);
}

vec3 subtal(vec3 s) {
    return s - vec3(10, 5, 5);
}

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    vWorldPosition = additional(worldPosition.xyz);
    vNormal = normalize(uNormalMatrix * aNormal);
    gl_Position = uViewProjection * worldPosition;
}
