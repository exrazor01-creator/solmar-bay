// Solmar Bay — a tiny hand-written WebGL engine. No libraries: one shader, one dynamic
// buffer, immediate-mode boxes/quads/cylinders, per-vertex colours, a directional sun
// + ambient light, distance fog, and a chase camera with a mouse ray for aiming.
// Everything is drawn in a single pass per frame (flushed when the buffer fills).
import { clamp, lerp } from './random.js';

// ---- 4x4 matrices, column-major as WebGL expects ----
function matPerspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
  return m;
}
function matLookAt(eye, center, up) {
  let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
  let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  let xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}
function matMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c += 1) for (let r = 0; r < 4; r += 1) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---- sky / light keyframes by time of day (0 = midnight, 0.5 = noon) ----
const SKY_KEYS = [
  { t: 0.00, sky: [0.05, 0.07, 0.16], sun: [0.22, 0.28, 0.50], amb: [0.16, 0.18, 0.28], dir: [0.3, 0.6, 0.4] },
  { t: 0.20, sky: [0.05, 0.07, 0.16], sun: [0.22, 0.28, 0.50], amb: [0.16, 0.18, 0.28], dir: [0.3, 0.6, 0.4] },
  { t: 0.27, sky: [0.92, 0.58, 0.42], sun: [1.0, 0.55, 0.30], amb: [0.34, 0.28, 0.32], dir: [0.9, 0.25, 0.3] },
  { t: 0.38, sky: [0.55, 0.76, 0.95], sun: [1.0, 0.95, 0.85], amb: [0.55, 0.55, 0.55], dir: [0.5, 1.0, 0.4] },
  { t: 0.60, sky: [0.55, 0.76, 0.95], sun: [1.0, 0.95, 0.85], amb: [0.55, 0.55, 0.55], dir: [-0.4, 1.0, 0.4] },
  { t: 0.72, sky: [0.90, 0.46, 0.30], sun: [1.0, 0.55, 0.28], amb: [0.36, 0.30, 0.34], dir: [-0.9, 0.28, 0.3] },
  { t: 0.80, sky: [0.05, 0.07, 0.16], sun: [0.22, 0.28, 0.50], amb: [0.16, 0.18, 0.28], dir: [-0.3, 0.6, 0.4] },
  { t: 1.00, sky: [0.05, 0.07, 0.16], sun: [0.22, 0.28, 0.50], amb: [0.16, 0.18, 0.28], dir: [-0.3, 0.6, 0.4] },
];
export function skyAt(tod) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
    if (tod >= SKY_KEYS[i].t && tod <= SKY_KEYS[i + 1].t) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = b.t === a.t ? 0 : clamp((tod - a.t) / (b.t - a.t), 0, 1);
  const mix = (x, y) => [lerp(x[0], y[0], f), lerp(x[1], y[1], f), lerp(x[2], y[2], f)];
  const night = tod < 0.22 || tod > 0.78;
  return {
    sky: mix(a.sky, b.sky), fog: mix(a.sky, b.sky), sun: mix(a.sun, b.sun), amb: mix(a.amb, b.amb),
    dir: norm3(mix(a.dir, b.dir)), night, fogNear: night ? 320 : 500, fogFar: night ? 1700 : 2600,
  };
}

// ---- colour parsing (cached) ----
const colorCache = new Map();
export function parseColor(c) {
  if (Array.isArray(c)) return c.length === 3 ? [c[0], c[1], c[2], 1] : c;
  let hit = colorCache.get(c);
  if (hit) return hit;
  const n = parseInt(c.slice(1), 16);
  hit = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  colorCache.set(c, hit);
  return hit;
}

const VS = `attribute vec3 aPos; attribute vec4 aColor; attribute vec3 aNormal;
uniform mat4 uVP; uniform vec3 uCamPos; uniform vec3 uLightDir; uniform vec3 uLightCol;
uniform vec3 uAmbient; uniform float uFogNear; uniform float uFogFar;
varying vec4 vColor; varying float vFog;
void main(){
  vec3 n = normalize(aNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  vec3 lit = aColor.rgb * (uAmbient + uLightCol * diff);
  vColor = vec4(lit, aColor.a);
  float d = distance(aPos, uCamPos);
  vFog = clamp((d - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
const FS = `precision mediump float;
varying vec4 vColor; varying float vFog; uniform vec3 uFogColor;
void main(){ vec3 c = mix(vColor.rgb, uFogColor, vFog); gl_FragColor = vec4(c, vColor.a); }`;

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL is not available');
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const loc = (n) => gl.getUniformLocation(prog, n);
  const U = {
    vp: loc('uVP'), cam: loc('uCamPos'), ldir: loc('uLightDir'), lcol: loc('uLightCol'),
    amb: loc('uAmbient'), fogc: loc('uFogColor'), fogn: loc('uFogNear'), fogf: loc('uFogFar'),
  };
  const A = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aColor'), nrm: gl.getAttribLocation(prog, 'aNormal') };
  const bufPos = gl.createBuffer(), bufCol = gl.createBuffer(), bufNrm = gl.createBuffer(), bufIdx = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const R = {
    gl, w: canvas.width, h: canvas.height, fov: 60 * Math.PI / 180, aspect: canvas.width / canvas.height,
    eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], tanHalf: Math.tan((60 * Math.PI / 180) / 2),
    pos: [], col: [], nrm: [], idx: [], vc: 0, tris: 0,
    setCamera(eye, target) {
      this.eye = eye;
      const view = matLookAt(eye, target, [0, 1, 0]);
      const proj = matPerspective(this.fov, this.aspect, 1, 6000);
      this.vp = matMul(proj, view);
      this.fwd = norm3([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
      // right = fwd x world-up = (-fwd.z, 0, fwd.x); up = right x fwd.
      this.right = norm3([-this.fwd[2], 0, this.fwd[0]]);
      const cr = this.right, f = this.fwd;
      this.up = norm3([cr[1] * f[2] - cr[2] * f[1], cr[2] * f[0] - cr[0] * f[2], cr[0] * f[1] - cr[1] * f[0]]);
    },
    begin(sky) {
      this.pos.length = 0; this.col.length = 0; this.nrm.length = 0; this.idx.length = 0; this.vc = 0; this.tris = 0;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(sky.sky[0], sky.sky[1], sky.sky[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(U.vp, false, this.vp);
      gl.uniform3fv(U.cam, this.eye);
      gl.uniform3fv(U.ldir, sky.dir);
      gl.uniform3fv(U.lcol, sky.sun);
      gl.uniform3fv(U.amb, sky.amb);
      gl.uniform3fv(U.fogc, sky.fog);
      gl.uniform1f(U.fogn, sky.fogNear);
      gl.uniform1f(U.fogf, sky.fogFar);
    },
    vert(p, c, n) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(c[0], c[1], c[2], c[3]);
      this.nrm.push(n[0], n[1], n[2]);
      this.vc += 1;
      if (this.vc > 58000) this.flush();
    },
    quad(p0, p1, p2, p3, color, n) {
      const cs = Array.isArray(color) && Array.isArray(color[0]) ? color : [color, color, color, color];
      const c0 = parseColor(cs[0]), c1 = parseColor(cs[1]), c2 = parseColor(cs[2]), c3 = parseColor(cs[3]);
      const base = this.vc;
      this.vert(p0, c0, n); this.vert(p1, c1, n); this.vert(p2, c2, n); this.vert(p3, c3, n);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.tris += 2;
    },
    // Flat horizontal quad, normal +Y. Corners in counter-clockwise order seen from above.
    flat(x, z, w, d, y, color) {
      this.quad([x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d], color, [0, 1, 0]);
    },
    // Box centred at (cx, cy, cz), size (w, h, d), optionally rotated around Y by ry.
    box(cx, cy, cz, w, h, d, color, ry) {
      const c = parseColor(color);
      const hx = w / 2, hy = h / 2, hz = d / 2;
      const cos = Math.cos(ry || 0), sin = Math.sin(ry || 0);
      const rot = (x, z) => [cx + x * cos - z * sin, cz + x * sin + z * cos];
      const corner = (sx, sy, sz) => { const [x, z] = rot(sx * hx, sz * hz); return [x, cy + sy * hy, z]; };
      const F = [
        { n: [0, 1, 0], pts: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] }, // top
        { n: [0, -1, 0], pts: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] }, // bottom
        { n: [0, 0, 1], pts: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] }, // south
        { n: [0, 0, -1], pts: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] }, // north
        { n: [1, 0, 0], pts: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] }, // east
        { n: [-1, 0, 0], pts: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] }, // west
      ];
      for (const f of F) {
        // Rotate the face normal the same way as the corners.
        const nx = f.n[0] * cos - f.n[2] * sin, nz = f.n[0] * sin + f.n[2] * cos;
        const pts = f.pts.map((p) => corner(p[0], p[1], p[2]));
        this.quad(pts[0], pts[1], pts[2], pts[3], c, [nx, f.n[1], nz]);
      }
    },
    // Vertical prism (cylinder with `sides` faces), base at y, height h.
    cyl(x, y, z, r, h, color, sides) {
      const s = sides || 8, c = parseColor(color);
      const top = [], bot = [];
      for (let i = 0; i < s; i += 1) {
        const a = (i / s) * Math.PI * 2;
        top.push([x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]);
        bot.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
      }
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s;
        const a = (i / s) * Math.PI * 2, nx = Math.cos(a + Math.PI / s), nz = Math.sin(a + Math.PI / s);
        this.quad(bot[i], bot[j], top[j], top[i], c, [nx, 0, nz]);
      }
      // Top cap as a fan around the centre.
      const tc = [x, y + h, z];
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s, base = this.vc;
        this.vert(tc, c, [0, 1, 0]); this.vert(top[i], c, [0, 1, 0]); this.vert(top[j], c, [0, 1, 0]);
        this.idx.push(base, base + 1, base + 2); this.tris += 1;
      }
    },
    // Mouse ray to the ground plane (y = 0). Returns { x, z } or null.
    rayGround(mx, my) {
      const nx = (mx / this.w) * 2 - 1, ny = 1 - (my / this.h) * 2;
      const dx = this.fwd[0] + this.right[0] * nx * this.tanHalf * this.aspect + this.up[0] * ny * this.tanHalf;
      const dy = this.fwd[1] + this.right[1] * nx * this.tanHalf * this.aspect + this.up[1] * ny * this.tanHalf;
      const dz = this.fwd[2] + this.right[2] * nx * this.tanHalf * this.aspect + this.up[2] * ny * this.tanHalf;
      if (dy > -0.001) return null;
      const t = -this.eye[1] / dy;
      return { x: this.eye[0] + dx * t, z: this.eye[2] + dz * t };
    },
    // World -> canvas pixels (for aiming the mouse at a 3D point). Null when behind.
    project(x, y, z) {
      const m = this.vp;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 0.01) return null;
      return { x: (cx / cw * 0.5 + 0.5) * this.w, y: (0.5 - cy / cw * 0.5) * this.h };
    },
    flush() {
      if (this.idx.length === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPos);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.pos), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.pos);
      gl.vertexAttribPointer(A.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufCol);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.col), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.col);
      gl.vertexAttribPointer(A.col, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufNrm);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.nrm), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(A.nrm);
      gl.vertexAttribPointer(A.nrm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.idx), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, this.idx.length, gl.UNSIGNED_SHORT, 0);
      this.pos.length = 0; this.col.length = 0; this.nrm.length = 0; this.idx.length = 0; this.vc = 0;
    },
  };
  return R;
}
