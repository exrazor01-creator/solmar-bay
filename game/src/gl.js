import { clamp, lerp } from './random.js';
function mPersp(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
  return m;
}
function mLook(eye, center, up) {
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
const n3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const SKY = [
  [0, .05, .07, .16, .35, .4, .6, .3, .32, .42, .3, .6, .4],
  [.2, .05, .07, .16, .35, .4, .6, .3, .32, .42, .3, .6, .4],
  [.27, .96, .52, .38, 1, .55, .3, .58, .44, .5, .9, .25, .3],
  [.38, .55, .76, .95, 1, .95, .85, .55, .55, .55, .5, 1, .4],
  [.6, .55, .76, .95, 1, .95, .85, .55, .55, .55, -.4, 1, .4],
  [.72, .95, .45, .32, 1, .55, .28, .58, .44, .5, -.9, .28, .3],
  [.8, .05, .07, .16, .35, .4, .6, .3, .32, .42, -.3, .6, .4],
  [1, .05, .07, .16, .35, .4, .6, .3, .32, .42, -.3, .6, .4],
];
export function skyAt(tod) {
  let a = SKY[0], b = SKY[7];
  for (let i = 0; i < 7; i += 1) if (tod >= SKY[i][0] && tod <= SKY[i + 1][0]) { a = SKY[i]; b = SKY[i + 1]; break; }
  const f = b[0] === a[0] ? 0 : clamp((tod - a[0]) / (b[0] - a[0]), 0, 1);
  const mx = (o) => [lerp(a[o], b[o], f), lerp(a[o + 1], b[o + 1], f), lerp(a[o + 2], b[o + 2], f)];
  const night = tod < 0.22 || tod > 0.78;
  return { sky: mx(1), fog: mx(1), sun: mx(4), amb: mx(7), dir: n3(mx(10)), night, fogNear: 500, fogFar: night ? 2200 : 2600 };
}
const cCache = new Map();
export function pCol(c) {
  if (Array.isArray(c)) return c.length === 3 ? [c[0], c[1], c[2], 1] : c;
  let hit = cCache.get(c);
  if (hit) return hit;
  const n = parseInt(c.slice(1), 16);
  hit = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  cCache.set(c, hit);
  return hit;
}
const VS = `attribute vec3 aPos; attribute vec4 aColor; attribute vec4 aNormal;
uniform mat4 uVP; uniform vec3 uCP; uniform vec3 uLD; uniform vec3 uLC;
uniform vec3 uAM; uniform float uFN; uniform float uFF;
varying vec4 vColor; varying float vFog; varying float vSpec;
void main(){
  vec3 n = normalize(aNormal.xyz);
  float diff = max(dot(n, uLD), 0.0);
  vec3 lit = aColor.rgb * (uAM + uLC * diff);
  vColor = vec4(lit, aColor.a);
  vec3 V = normalize(uCP - aPos);
  vec3 H = normalize(uLD + V);
  vSpec = pow(max(dot(n, H), 0.0), 26.0) * aNormal.w;
  float d = distance(aPos, uCP);
  vFog = clamp((d - uFN) / (uFF - uFN), 0.0, 1.0);
  gl_Position = uVP * vec4(aPos, 1.0);
}`;
const FS = `precision mediump float;
varying vec4 vColor; varying float vFog; varying float vSpec; uniform vec3 uFC;
void main(){ vec3 c = mix(vColor.rgb, uFC, vFog) + vSpec * (1.0 - vFog) * 0.5; gl_FragColor = vec4(c, vColor.a); }`;
export function mkRenderer(canvas) {
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
    vp: loc('uVP'), cam: loc('uCP'), ldir: loc('uLD'), lcol: loc('uLC'),
    amb: loc('uAM'), fogc: loc('uFC'), fogn: loc('uFN'), fogf: loc('uFF'),
  };
  const A = { pos: gl.getAttribLocation(prog, 'aPos'), col: gl.getAttribLocation(prog, 'aColor'), nrm: gl.getAttribLocation(prog, 'aNormal') };
  const bufPos = gl.createBuffer(), bufCol = gl.createBuffer(), bufNrm = gl.createBuffer(), bufIdx = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const R = {
    gl, w: canvas.width, h: canvas.height, fov: 60 * Math.PI / 180, aspect: canvas.width / canvas.height,
    eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0], tanHalf: Math.tan((60 * Math.PI / 180) / 2),
    pos: [], col: [], nrm: [], idx: [], vc: 0, tris: 0, sh: 0,
    setCamera(eye, target) {
      this.eye = eye;
      const view = mLook(eye, target, [0, 1, 0]);
      const proj = mPersp(this.fov, this.aspect, 1, 6000);
      this.vp = matMul(proj, view);
      this.fwd = n3([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
      this.right = n3([-this.fwd[2], 0, this.fwd[0]]);
      const cr = this.right, f = this.fwd;
      this.up = n3([cr[1] * f[2] - cr[2] * f[1], cr[2] * f[0] - cr[0] * f[2], cr[0] * f[1] - cr[1] * f[0]]);
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
      this.nrm.push(n[0], n[1], n[2], n.length > 3 ? n[3] : this.sh);
      this.vc += 1;
      if (this.vc > 58000) this.flush();
    },
    quad(p0, p1, p2, p3, color, n) {
      const cs = Array.isArray(color) && Array.isArray(color[0]) ? color : [color, color, color, color];
      const c0 = pCol(cs[0]), c1 = pCol(cs[1]), c2 = pCol(cs[2]), c3 = pCol(cs[3]);
      const base = this.vc;
      this.vert(p0, c0, n); this.vert(p1, c1, n); this.vert(p2, c2, n); this.vert(p3, c3, n);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.tris += 2;
    },
    flat(x, z, w, d, y, color) {
      this.quad([x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d], color, [0, 1, 0]);
    },
    box(cx, cy, cz, w, h, d, color, ry) {
      const c = pCol(color);
      const hx = w / 2, hy = h / 2, hz = d / 2;
      const cos = Math.cos(ry || 0), sin = Math.sin(ry || 0);
      const rot = (x, z) => [cx + x * cos - z * sin, cz + x * sin + z * cos];
      const corner = (sx, sy, sz) => { const [x, z] = rot(sx * hx, sz * hz); return [x, cy + sy * hy, z]; };
      const F = [
        { n: [0, 1, 0], pts: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
        { n: [0, -1, 0], pts: [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1]] },
        { n: [0, 0, 1], pts: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
        { n: [0, 0, -1], pts: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
        { n: [1, 0, 0], pts: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
        { n: [-1, 0, 0], pts: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
      ];
      for (const f of F) {
        const nx = f.n[0] * cos - f.n[2] * sin, nz = f.n[0] * sin + f.n[2] * cos;
        const pts = f.pts.map((p) => corner(p[0], p[1], p[2]));
        this.quad(pts[0], pts[1], pts[2], pts[3], c, [nx, f.n[1], nz]);
      }
    },
    cyl(x, y, z, r, h, color, sides) {
      const s = sides || 8, c = pCol(color);
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
      const tc = [x, y + h, z];
      for (let i = 0; i < s; i += 1) {
        const j = (i + 1) % s, base = this.vc;
        this.vert(tc, c, [0, 1, 0]); this.vert(top[i], c, [0, 1, 0]); this.vert(top[j], c, [0, 1, 0]);
        this.idx.push(base, base + 1, base + 2); this.tris += 1;
      }
    },
    sph(x, y, z, rx, ry, rz, c, n) {
      const s = n || 6, q = pCol(c);
      for (let i = 0; i < s; i += 1) {
        const a = i / s * Math.PI, b = (i + 1) / s * Math.PI;
        for (let j = 0; j < s; j += 1) {
          const t = j / s * 6.283, u = (j + 1) / s * 6.283;
          const P = (A, T) => [x + Math.sin(A) * Math.cos(T) * rx, y + Math.cos(A) * ry, z + Math.sin(A) * Math.sin(T) * rz];
          const m = (a + b) / 2, w = (t + u) / 2;
          this.quad(P(a, t), P(a, u), P(b, u), P(b, t), q, [Math.sin(m) * Math.cos(w), Math.cos(m), Math.sin(m) * Math.sin(w)]);
        }
      }
    },
    disc(x, y, z, nx, nz, r, c, n) {
      const s = n || 8, q = pCol(c), px = -nz, pz = nx;
      for (let i = 0; i < s; i += 1) {
        const a = i / s * 6.283, b = (i + 1) / s * 6.283;
        const v = (t) => [x + px * Math.cos(t) * r, y + Math.sin(t) * r, z + pz * Math.cos(t) * r];
        const o = this.vc;
        this.vert([x, y, z], q, [nx, 0, nz]); this.vert(v(a), q, [nx, 0, nz]); this.vert(v(b), q, [nx, 0, nz]);
        this.idx.push(o, o + 1, o + 2); this.tris += 1;
      }
    },
    lathe(x, y, z, pr, c, s, ry) {
      const q = pCol(c), n = pr.length / 2, co = Math.cos(ry || 0), si = Math.sin(ry || 0);
      const P = (j, k) => {
        const a = k / s * 6.283, r = pr[j * 2];
        return [x + Math.cos(a) * r * co - Math.sin(a) * r * si, y + pr[j * 2 + 1], z + Math.cos(a) * r * si + Math.sin(a) * r * co];
      };
      const N = (j) => {
        const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
        const dr = pr[b * 2] - pr[a * 2], dh = pr[b * 2 + 1] - pr[a * 2 + 1], l = Math.hypot(dr, dh) || 1;
        return [dh / l, -dr / l];
      };
      for (let j = 0; j < n - 1; j += 1) for (let k = 0; k < s; k += 1) {
        const k2 = (k + 1) % s, a = (k + 0.5) / s * 6.283;
        const nr = (N(j)[0] + N(j + 1)[0]) / 2, ny = (N(j)[1] + N(j + 1)[1]) / 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        this.quad(P(j, k), P(j, k2), P(j + 1, k2), P(j + 1, k), q, [nr * ca * co - nr * sa * si, ny, nr * ca * si + nr * sa * co]);
      }
    },
    hull(x, y, z, a, sc, c) {
      const q = pCol(c), fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx, n = sc.length / 4;
      const P = (i, s, yy) => [x + fx * sc[i * 4] + rx * s * sc[i * 4 + 1], y + yy, z + fz * sc[i * 4] + rz * s * sc[i * 4 + 1]];
      for (let i = 0; i < n - 1; i += 1) {
        const sl = (sc[(i + 1) * 4 + 3] - sc[i * 4 + 3]) / ((sc[(i + 1) * 4] - sc[i * 4]) || 1), nl = 1 / Math.hypot(sl, 1);
        this.quad(P(i, -1, sc[i * 4 + 3]), P(i, 1, sc[i * 4 + 3]), P(i + 1, 1, sc[(i + 1) * 4 + 3]), P(i + 1, -1, sc[(i + 1) * 4 + 3]), q, [-sl * nl * fx, nl, -sl * nl * fz]);
        this.quad(P(i, 1, sc[i * 4 + 2]), P(i, 1, sc[i * 4 + 3]), P(i + 1, 1, sc[(i + 1) * 4 + 3]), P(i + 1, 1, sc[(i + 1) * 4 + 2]), q, [rx, 0, rz]);
        this.quad(P(i, -1, sc[i * 4 + 3]), P(i, -1, sc[i * 4 + 2]), P(i + 1, -1, sc[(i + 1) * 4 + 2]), P(i + 1, -1, sc[(i + 1) * 4 + 3]), q, [-rx, 0, -rz]);
      }
      this.quad(P(0, -1, sc[2]), P(0, 1, sc[2]), P(0, 1, sc[3]), P(0, -1, sc[3]), q, [-fx, 0, -fz]);
      const e = n - 1;
      this.quad(P(e, 1, sc[e * 4 + 2]), P(e, -1, sc[e * 4 + 2]), P(e, -1, sc[e * 4 + 3]), P(e, 1, sc[e * 4 + 3]), q, [fx, 0, fz]);
    },
    tube(x1, y1, z1, x2, y2, z2, r, c, s) {
      const q = pCol(c), d = n3([x2 - x1, y2 - y1, z2 - z1]);
      let u = [-d[2], 0, d[0]];
      if (Math.hypot(u[0], u[1], u[2]) < 0.01) u = [1, 0, 0];
      u = n3(u);
      const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
      for (let k = 0; k < s; k += 1) {
        const a = k / s * 6.283, b = (k + 1) / s * 6.283, m = (a + b) / 2;
        const P = (t, x, y, z) => [x + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, y + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, z + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r];
        this.quad(P(a, x1, y1, z1), P(b, x1, y1, z1), P(b, x2, y2, z2), P(a, x2, y2, z2), q, [u[0] * Math.cos(m) + v[0] * Math.sin(m), u[1] * Math.cos(m) + v[1] * Math.sin(m), u[2] * Math.cos(m) + v[2] * Math.sin(m)]);
      }
    },
    rayGround(mx, my) {
      const nx = (mx / this.w) * 2 - 1, ny = 1 - (my / this.h) * 2;
      const dx = this.fwd[0] + this.right[0] * nx * this.tanHalf * this.aspect + this.up[0] * ny * this.tanHalf;
      const dy = this.fwd[1] + this.right[1] * nx * this.tanHalf * this.aspect + this.up[1] * ny * this.tanHalf;
      const dz = this.fwd[2] + this.right[2] * nx * this.tanHalf * this.aspect + this.up[2] * ny * this.tanHalf;
      if (dy > -0.001) return null;
      const t = -this.eye[1] / dy;
      return { x: this.eye[0] + dx * t, z: this.eye[2] + dz * t };
    },
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
      gl.vertexAttribPointer(A.nrm, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.idx), gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES, this.idx.length, gl.UNSIGNED_SHORT, 0);
      this.pos.length = 0; this.col.length = 0; this.nrm.length = 0; this.idx.length = 0; this.vc = 0;
    },
  };
  return R;
}
