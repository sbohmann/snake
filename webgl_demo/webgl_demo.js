const canvas = document.getElementById("webgl-canvas");
const gl = canvas.getContext("webgl", { antialias: true });

if (!gl) {
    const message = document.createElement("p");
    message.textContent = "This browser does not provide WebGL.";
    message.style.color = "#ff5577";
    canvas.replaceWith(message);
    throw new Error("WebGL is not available");
}

let crystalProgram;
let gridProgram;
let crystal;
let grid;
let crystalState;
let gridState;

init().catch((error) => {
    console.error(error);
    showError("Could not load or compile the WebGL shaders. Serve this directory over HTTP and try again.");
});

async function init() {
    const shaders = await loadShaderSources({
        crystalVertex: "shaders/crystal.vert.glsl",
        crystalFragment: "shaders/crystal.frag.glsl",
        gridVertex: "shaders/grid.vert.glsl",
        gridFragment: "shaders/grid.frag.glsl",
    });

    crystalProgram = createProgram(shaders.crystalVertex, shaders.crystalFragment);
    gridProgram = createProgram(shaders.gridVertex, shaders.gridFragment);

    crystal = createCrystalGeometry();
    grid = createGridGeometry(18, 0.35);

    crystalState = {
        position: gl.getAttribLocation(crystalProgram, "aPosition"),
        normal: gl.getAttribLocation(crystalProgram, "aNormal"),
        model: gl.getUniformLocation(crystalProgram, "uModel"),
        viewProjection: gl.getUniformLocation(crystalProgram, "uViewProjection"),
        normalMatrix: gl.getUniformLocation(crystalProgram, "uNormalMatrix"),
        time: gl.getUniformLocation(crystalProgram, "uTime"),
        resolution: gl.getUniformLocation(crystalProgram, "uResolution"),
    };

    gridState = {
        position: gl.getAttribLocation(gridProgram, "aPosition"),
        viewProjection: gl.getUniformLocation(gridProgram, "uViewProjection"),
        time: gl.getUniformLocation(gridProgram, "uTime"),
    };

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    requestAnimationFrame(draw);
}

async function loadShaderSources(shaderPaths) {
    const entries = await Promise.all(
        Object.entries(shaderPaths).map(async ([name, path]) => {
            const response = await fetch(path);

            if (!response.ok) {
                throw new Error(`Failed to load ${path}: ${response.status}`);
            }

            return [name, await response.text()];
        }),
    );

    return Object.fromEntries(entries);
}

function showError(text) {
    const message = document.createElement("p");
    message.textContent = text;
    message.style.color = "#ff5577";
    canvas.replaceWith(message);
}

function draw(now) {
    const time = now * 0.001;
    resizeCanvas();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.03, 0.10, 0.10, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = canvas.width / canvas.height;
    const projection = perspective(Math.PI / 4, aspect, 0.1, 100);
    const view = lookAt([0, 1.2, 6.2], [0, 0, 0], [0, 1, 0]);
    const viewProjection = multiply(projection, view);

    drawGrid(viewProjection, time);
    drawCrystal(viewProjection, time);

    requestAnimationFrame(draw);
}

function drawCrystal(viewProjection, time) {
    const rotationY = rotateY(time * 0.65);
    const rotationX = rotateX(Math.sin(time * 0.7) * 0.22);
    const model = multiply(rotationY, rotationX);
    const normalMatrix = mat3FromMat4(model);

    gl.useProgram(crystalProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, crystal.positionBuffer);
    gl.enableVertexAttribArray(crystalState.position);
    gl.vertexAttribPointer(crystalState.position, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, crystal.normalBuffer);
    gl.enableVertexAttribArray(crystalState.normal);
    gl.vertexAttribPointer(crystalState.normal, 3, gl.FLOAT, false, 0, 0);

    gl.uniformMatrix4fv(crystalState.model, false, model);
    gl.uniformMatrix4fv(crystalState.viewProjection, false, viewProjection);
    gl.uniformMatrix3fv(crystalState.normalMatrix, false, normalMatrix);
    gl.uniform1f(crystalState.time, time);
    gl.uniform2f(crystalState.resolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, crystal.vertexCount);
}

function drawGrid(viewProjection, time) {
    gl.useProgram(gridProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, grid.positionBuffer);
    gl.enableVertexAttribArray(gridState.position);
    gl.vertexAttribPointer(gridState.position, 2, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(gridState.viewProjection, false, viewProjection);
    gl.uniform1f(gridState.time, time);
    gl.drawArrays(gl.LINES, 0, grid.vertexCount);
}

function createCrystalGeometry() {
    const top = [0, 1.65, 0];
    const upper = [
        [0, 0.55, 1],
        [1, 0.55, 0],
        [0, 0.55, -1],
        [-1, 0.55, 0],
    ];
    const lower = [
        [0, -0.8, 0.72],
        [0.72, -0.8, 0],
        [0, -0.8, -0.72],
        [-0.72, -0.8, 0],
    ];
    const bottom = [0, -1.65, 0];
    const faces = [];

    for (let index = 0; index < 4; index += 1) {
        const next = (index + 1) % 4;
        faces.push([top, upper[index], upper[next]]);
        faces.push([upper[index], lower[index], lower[next]]);
        faces.push([upper[index], lower[next], upper[next]]);
        faces.push([bottom, lower[next], lower[index]]);
    }

    const positions = [];
    const normals = [];

    for (const face of faces) {
        const normal = computeNormal(face[0], face[1], face[2]);
        for (const point of face) {
            positions.push(...point);
            normals.push(...normal);
        }
    }

    return {
        positionBuffer: bufferData(new Float32Array(positions)),
        normalBuffer: bufferData(new Float32Array(normals)),
        vertexCount: positions.length / 3,
    };
}

function createGridGeometry(lineCount, spacing) {
    const positions = [];
    const limit = lineCount * spacing;

    for (let index = -lineCount; index <= lineCount; index += 1) {
        const offset = index * spacing;
        positions.push(-limit, offset, limit, offset);
        positions.push(offset, -limit, offset, limit);
    }

    return {
        positionBuffer: bufferData(new Float32Array(positions)),
        vertexCount: positions.length / 2,
    };
}

function bufferData(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function createProgram(vertexSource, fragmentSource) {
    const program = gl.createProgram();
    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    return program;
}

function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

function resizeCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
}

function computeNormal(a, b, c) {
    const ab = subtract(b, a);
    const ac = subtract(c, a);
    return normalize(cross(ab, ac));
}

function subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function normalize(value) {
    const length = Math.hypot(value[0], value[1], value[2]) || 1;
    return [value[0] / length, value[1] / length, value[2] / length];
}

function perspective(fieldOfView, aspect, near, far) {
    const f = 1 / Math.tan(fieldOfView / 2);
    const rangeInv = 1 / (near - far);

    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0,
    ]);
}

function lookAt(eye, target, up) {
    const zAxis = normalize(subtract(eye, target));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    return new Float32Array([
        xAxis[0], yAxis[0], zAxis[0], 0,
        xAxis[1], yAxis[1], zAxis[1], 0,
        xAxis[2], yAxis[2], zAxis[2], 0,
        -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
    ]);
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function rotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1,
    ]);
}

function rotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1,
    ]);
}

function multiply(a, b) {
    const result = new Float32Array(16);

    for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < 4; row += 1) {
            result[column * 4 + row] =
                a[0 * 4 + row] * b[column * 4 + 0] +
                a[1 * 4 + row] * b[column * 4 + 1] +
                a[2 * 4 + row] * b[column * 4 + 2] +
                a[3 * 4 + row] * b[column * 4 + 3];
        }
    }

    return result;
}

function mat3FromMat4(matrix) {
    return new Float32Array([
        matrix[0], matrix[1], matrix[2],
        matrix[4], matrix[5], matrix[6],
        matrix[8], matrix[9], matrix[10],
    ]);
}
