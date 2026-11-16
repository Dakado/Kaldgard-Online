import * as THREE from 'three';
import cobbleUrl from '../assets/images/tex_prontera_cobble_1794659235015.jpg';
import wallUrl from '../assets/images/tex_prontera_wall_1794659235238.jpg';
import roofUrl from '../assets/images/tex_prontera_roof_1794659236977.jpg';
import {
  WeatherShaderUniforms,
  applyGrassWindShader,
  applyWaterRippleShader,
  applyWorldWeatherShader,
} from './weatherShaders';

export interface PronteraMaterials {
  cobble: THREE.MeshStandardMaterial;
  plazaAccentStone: THREE.MeshStandardMaterial;
  curbStone: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  grassBladeMat: THREE.MeshStandardMaterial;
  tallGrassBladeMat: THREE.MeshStandardMaterial;
  wildflowerMat: THREE.MeshStandardMaterial;
  dirtPath: THREE.MeshStandardMaterial;
  cliffRock: THREE.MeshStandardMaterial;
  castleWall: THREE.MeshStandardMaterial;
  plasterTimber: THREE.MeshStandardMaterial;
  roofCobalt: THREE.MeshStandardMaterial;
  roofTerracotta: THREE.MeshStandardMaterial;
  roofSlate: THREE.MeshStandardMaterial;
  roofRoyal: THREE.MeshStandardMaterial;
  darkTimber: THREE.MeshStandardMaterial;
  oakWood: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  marbleTrim: THREE.MeshStandardMaterial;
  waterFountain: THREE.MeshPhysicalMaterial;
  waterMoat: THREE.MeshPhysicalMaterial;
  goldTrim: THREE.MeshStandardMaterial;
  wroughtIron: THREE.MeshStandardMaterial;
  steelArmor: THREE.MeshPhysicalMaterial;
  darkSteel: THREE.MeshPhysicalMaterial;
  gunmetalArmor: THREE.MeshPhysicalMaterial;
  forgedBlade: THREE.MeshPhysicalMaterial;
  chainmail: THREE.MeshStandardMaterial;
  quiltedLeather: THREE.MeshPhysicalMaterial;
  darkCoat: THREE.MeshPhysicalMaterial;
  windowGlow: THREE.MeshStandardMaterial;
  stainedGlass: THREE.MeshStandardMaterial;
  lanternGlow: THREE.MeshStandardMaterial;
  emberGlow: THREE.MeshStandardMaterial;
  carpetRoyal: THREE.MeshStandardMaterial;
  bannerBlue: THREE.MeshStandardMaterial;
  foliageOakMat: THREE.MeshStandardMaterial;
  foliagePineMat: THREE.MeshStandardMaterial;
  foliageCypressMat: THREE.MeshStandardMaterial;
  foliageBirchMat: THREE.MeshStandardMaterial;
  shrubLeafMat: THREE.MeshStandardMaterial;
  shrubFlowerMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  wickerMat: THREE.MeshStandardMaterial;
  appleRedMat: THREE.MeshPhysicalMaterial;
  appleGreenMat: THREE.MeshPhysicalMaterial;
  orangeMat: THREE.MeshPhysicalMaterial;
  grapeMat: THREE.MeshPhysicalMaterial;
  watermelonMat: THREE.MeshPhysicalMaterial;
  pumpkinMat: THREE.MeshStandardMaterial;
  pearMat: THREE.MeshPhysicalMaterial;
  aoSkirt: THREE.MeshBasicMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  cursorRing: THREE.MeshBasicMaterial;
  haloGlowTex: THREE.CanvasTexture;
  grassPbrMap: THREE.CanvasTexture;
  grassPbrNormal: THREE.CanvasTexture;
  cliffPbrMap: THREE.CanvasTexture;
  cliffPbrNormal: THREE.CanvasTexture;
  trailPbrMap: THREE.CanvasTexture;
  trailPbrNormal: THREE.CanvasTexture;
  createAwningMaterial: (canopyColor: number, accentColor: number) => THREE.MeshPhysicalMaterial;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function seededRand(seedInit: number) {
  let s = seedInit >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Generates a tileable tangent-space NormalMap + calibrated RoughnessMap
 * from any grayscale height canvas (or luminance image) using a wrapped 3x3 Sobel filter.
 */
function buildNormalAndRoughnessFromHeight(
  heightCanvas: HTMLCanvasElement,
  strength = 2.6,
  roughMin = 0.48,
  roughMax = 0.94,
  invertRoughness = true,
): { normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture; ao: THREE.CanvasTexture } {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d')!;
  const src = hCtx.getImageData(0, 0, w, h).data;

  const [nCanvas, nCtx] = makeCanvas(w);
  const [rCanvas, rCtx] = makeCanvas(w);
  const [aCanvas, aCtx] = makeCanvas(w);
  const nImg = nCtx.createImageData(w, h);
  const rImg = rCtx.createImageData(w, h);
  const aImg = aCtx.createImageData(w, h);
  const nData = nImg.data;
  const rData = rImg.data;
  const aData = aImg.data;

  const lumAt = (x: number, y: number): number => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    const idx = (wy * w + wx) * 4;
    return (src[idx] * 0.299 + src[idx + 1] * 0.587 + src[idx + 2] * 0.114) / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = lumAt(x - 1, y - 1);
      const t = lumAt(x, y - 1);
      const tr = lumAt(x + 1, y - 1);
      const l = lumAt(x - 1, y);
      const c = lumAt(x, y);
      const r = lumAt(x + 1, y);
      const bl = lumAt(x - 1, y + 1);
      const b = lumAt(x, y + 1);
      const br = lumAt(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * w + x) * 4;
      nData[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      nData[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nData[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nData[idx + 3] = 255;

      const tRough = invertRoughness ? 1.0 - c : c;
      const rv = Math.round((roughMin + tRough * (roughMax - roughMin)) * 255);
      rData[idx] = rv;
      rData[idx + 1] = rv;
      rData[idx + 2] = rv;
      rData[idx + 3] = 255;

      // Multi-radius laplacian cavity AO for mortar joints, crevices & seams
      const avgNear = (lumAt(x - 2, y) + lumAt(x + 2, y) + lumAt(x, y - 2) + lumAt(x, y + 2)) * 0.25;
      const avgFar =
        (lumAt(x - 6, y - 6) + lumAt(x + 6, y - 6) + lumAt(x - 6, y + 6) + lumAt(x + 6, y + 6)) * 0.25;
      const cavity = Math.max(0, (avgNear - c) * 0.55 + (avgFar - c) * 0.45);
      const lowDepth = Math.max(0, 0.44 - c) * 0.65;
      const aoNorm = Math.max(0.22, Math.min(1.0, 1.0 - cavity * 2.3 - lowDepth));
      const av = Math.round(aoNorm * 255);
      aData[idx] = av;
      aData[idx + 1] = av;
      aData[idx + 2] = av;
      aData[idx + 3] = 255;
    }
  }

  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);
  aCtx.putImageData(aImg, 0, 0);

  const normal = new THREE.CanvasTexture(nCanvas);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;

  const roughness = new THREE.CanvasTexture(rCanvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  const ao = new THREE.CanvasTexture(aCanvas);
  ao.wrapS = THREE.RepeatWrapping;
  ao.wrapT = THREE.RepeatWrapping;
  ao.channel = 0;

  return { normal, roughness, ao };
}

function derivePbrFromLoadedImage(
  img: HTMLImageElement | HTMLCanvasElement,
  size: number,
  strength: number,
  roughMin: number,
  roughMax: number,
): { normal: THREE.CanvasTexture; roughness: THREE.CanvasTexture; ao: THREE.CanvasTexture } {
  const [canvas, ctx] = makeCanvas(size);
  ctx.drawImage(img, 0, 0, size, size);
  return buildNormalAndRoughnessFromHeight(canvas, strength, roughMin, roughMax, true);
}

function createCobbleFallbackHeight(size = 1024): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size);
  const rand = seededRand(207);
  ctx.fillStyle = '#323232';
  ctx.fillRect(0, 0, size, size);

  const cells = 12;
  const step = size / cells;
  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const shift = (gy % 2) * (step * 0.46);
      const x = (gx * step + shift) % size;
      const y = gy * step;
      const shade = 155 + Math.floor(rand() * 75);
      const grad = ctx.createRadialGradient(
        x + step * 0.5,
        y + step * 0.5,
        step * 0.08,
        x + step * 0.5,
        y + step * 0.5,
        step * 0.55,
      );
      grad.addColorStop(0, `rgb(${shade},${shade},${shade})`);
      grad.addColorStop(1, '#585858');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, step - 8, step - 8, 12);
      ctx.fill();
    }
  }
  return canvas;
}

function createStoneWallFallbackHeight(size = 1024): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size);
  const rand = seededRand(101);
  ctx.fillStyle = '#3c3c3c';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const cols = 4;
    const colW = size / cols;
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const v = 148 + Math.floor(rand() * 68);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x + 4, y + 4, colW - 8, rowH - 8);
    }
  }
  return canvas;
}

function createGrassTextures(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(309);

  // Deep organic humus & forest-meadow soil underlayer
  ctx.fillStyle = '#2d4720';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#484848';
  hCtx.fillRect(0, 0, size, size);

  const drawWrappedDisc = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    fill: string,
  ) => {
    c.fillStyle = fill;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox;
        const py = y + oy;
        if (px < -r || px > size + r || py < -r || py > size + r) continue;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      }
    }
  };

  // Multi-scale moss cushions, rich loam soil, and sunlit meadow patches
  for (let i = 0; i < 950; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 48;
    const s = rand();
    const col =
      s < 0.36
        ? 'rgba(72, 108, 44, 0.30)'
        : s < 0.72
          ? 'rgba(42, 72, 29, 0.34)'
          : 'rgba(66, 56, 36, 0.26)';
    drawWrappedDisc(ctx, x, y, r, col);
    const hv = Math.floor(72 + rand() * 64);
    drawWrappedDisc(hCtx, x, y, r, `rgba(${hv},${hv},${hv},0.28)`);
  }

  // 24,000+ layered botanical grass blades & clover micro-leaves with root AO & crisp blade relief
  for (let i = 0; i < 24000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 6 + rand() * 15;
    const bend = (rand() - 0.5) * 9;
    const tier = i / 24000;
    const g = Math.floor(68 + tier * 58 + rand() * 34);
    const rCh = Math.floor(g * (0.50 + (rand() - 0.5) * 0.12));
    const bCh = Math.floor(g * (0.34 + (rand() - 0.5) * 0.08));

    ctx.strokeStyle = `rgb(${rCh}, ${g}, ${bCh})`;
    ctx.lineWidth = 1.1 + (1.0 - tier) * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + bend * 0.45, y - len * 0.55, x + bend, y - len);
    ctx.stroke();

    const bv = Math.min(252, Math.floor(110 + tier * 115 + rand() * 25));
    hCtx.strokeStyle = `rgb(${bv},${bv},${bv})`;
    hCtx.lineWidth = 1.3;
    ctx.beginPath();
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.quadraticCurveTo(x + bend * 0.45, y - len * 0.55, x + bend, y - len);
    hCtx.stroke();
  }

  // Wild clover & moss rosette clusters
  for (let i = 0; i < 1800; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const g = 92 + Math.floor(rand() * 48);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.54)}, ${g}, ${Math.floor(g * 0.38)})`;
    hCtx.fillStyle = '#dcdcdc';
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI * 2) / 3 + rand() * 0.5;
      const lx = cx + Math.cos(a) * 2.6;
      const ly = cy + Math.sin(a) * 2.6;
      ctx.beginPath();
      ctx.arc(lx, ly, 2.1, 0, Math.PI * 2);
      ctx.fill();
      hCtx.beginPath();
      hCtx.arc(lx, ly, 2.1, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.8, 0.68, 0.96, true);
  return { map, normal, roughness, ao };
}

function createHalfTimberPlasterTextures(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(515);

  ctx.fillStyle = '#ddd0b8';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#787878';
  hCtx.fillRect(0, 0, size, size);

  // Subtle plaster trowel texture & weathering grime near seams
  for (let i = 0; i < 4200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const s = 2 + rand() * 9;
    const v = 196 + Math.floor(rand() * 38);
    ctx.fillStyle = `rgba(${v}, ${v - 10}, ${v - 24}, 0.28)`;
    ctx.fillRect(x, y, s, s);
    const hv = 105 + Math.floor(rand() * 44);
    hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.35)`;
    hCtx.fillRect(x, y, s, s);
  }

  const drawBeam = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#3d281a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#24160d';
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    // Wood grain streaks inside beams
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(20,10,5,0.28)' : 'rgba(110,75,45,0.16)';
      if (w > h) ctx.fillRect(x + rand() * w, y + rand() * h, 24 + rand() * 60, 2);
      else ctx.fillRect(x + rand() * w, y + rand() * h, 2, 24 + rand() * 60);
    }
    hCtx.fillStyle = '#d8d8d8';
    hCtx.fillRect(x, y, w, h);
    hCtx.strokeStyle = '#404040';
    hCtx.lineWidth = 5;
    hCtx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  };

  const beamT = 60;
  drawBeam(0, 0, size, beamT);
  drawBeam(0, size - beamT, size, beamT);
  drawBeam(0, size * 0.5 - beamT * 0.5, size, beamT);
  drawBeam(0, 0, beamT, size);
  drawBeam(size - beamT, 0, beamT, size);
  drawBeam(size * 0.5 - beamT * 0.5, 0, beamT, size);

  // Diagonal bracing
  ctx.strokeStyle = '#3d281a';
  ctx.lineWidth = 44;
  ctx.beginPath();
  ctx.moveTo(beamT * 0.5, size * 0.5);
  ctx.lineTo(size * 0.5, beamT * 0.5);
  ctx.moveTo(size - beamT * 0.5, size * 0.5);
  ctx.lineTo(size * 0.5, beamT * 0.5);
  ctx.stroke();

  hCtx.strokeStyle = '#d2d2d2';
  hCtx.lineWidth = 44;
  hCtx.beginPath();
  hCtx.moveTo(beamT * 0.5, size * 0.5);
  hCtx.lineTo(size * 0.5, beamT * 0.5);
  hCtx.moveTo(size - beamT * 0.5, size * 0.5);
  hCtx.lineTo(size * 0.5, beamT * 0.5);
  hCtx.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.8, 0.62, 0.92, true);
  return { map, normal, roughness, ao };
}

function createWoodPlankTextures(size = 1024, baseHex = '#624026'): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(711);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#929292';
  hCtx.fillRect(0, 0, size, size);

  const planks = 8;
  const pw = size / planks;
  for (let p = 0; p < planks; p++) {
    const x = p * pw;
    const tone = (rand() - 0.5) * 32;
    ctx.fillStyle = `rgba(${tone > 0 ? 255 : 0},${tone > 0 ? 230 : 0},${tone > 0 ? 195 : 0},${Math.abs(tone) / 255})`;
    ctx.fillRect(x, 0, pw, size);

    for (let g = 0; g < 90; g++) {
      const gx = x + rand() * pw;
      ctx.strokeStyle = rand() > 0.5 ? 'rgba(28,15,7,0.28)' : 'rgba(210,168,120,0.14)';
      ctx.lineWidth = 1.2 + rand() * 2.4;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + (rand() - 0.5) * 16,
        size * 0.33,
        gx + (rand() - 0.5) * 16,
        size * 0.66,
        gx,
        size,
      );
      ctx.stroke();

      const bv = 115 + Math.floor(rand() * 80);
      hCtx.strokeStyle = `rgb(${bv},${bv},${bv})`;
      hCtx.lineWidth = 2;
      hCtx.beginPath();
      hCtx.moveTo(gx, 0);
      hCtx.lineTo(gx, size);
      hCtx.stroke();
    }

    // Plank seam groove + iron nail dots
    ctx.fillStyle = '#24140a';
    ctx.fillRect(x, 0, 4, size);
    hCtx.fillStyle = '#282828';
    hCtx.fillRect(x, 0, 5, size);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.5, 0.54, 0.88, true);
  return { map, normal, roughness, ao };
}

function createBarkTextures(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(883);

  ctx.fillStyle = '#6e523a';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#707070';
  hCtx.fillRect(0, 0, size, size);

  // Deep vertical bark ridges & fissures
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const h = 40 + rand() * 140;
    const w = 4 + rand() * 14;
    const dark = rand() < 0.48;
    ctx.fillStyle = dark ? 'rgba(46, 31, 20, 0.46)' : 'rgba(138, 110, 82, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, h * 0.5, (rand() - 0.5) * 0.14, 0, Math.PI * 2);
    ctx.fill();

    const hv = dark ? 42 + Math.floor(rand() * 40) : 168 + Math.floor(rand() * 65);
    hCtx.fillStyle = `rgba(${hv},${hv},${hv},0.55)`;
    hCtx.beginPath();
    hCtx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    hCtx.fill();
  }

  // Mossy lichen flecks
  for (let i = 0; i < 120; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = 'rgba(84, 108, 56, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 4 + rand() * 10, 0, Math.PI * 2);
    ctx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 3.4, 0.72, 0.96, true);
  return { map, normal, roughness, ao };
}

function createMarbleTextures(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(903);

  ctx.fillStyle = '#cec4b0';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#9a9a9a';
  hCtx.fillRect(0, 0, size, size);

  // Subtle weathered travertine stone mottling
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 14 + rand() * 48;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(222,213,196,0.18)' : 'rgba(155,144,126,0.16)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Natural marble mineral veins
  for (let i = 0; i < 48; i++) {
    ctx.strokeStyle = `rgba(112, 104, 92, ${0.14 + rand() * 0.18})`;
    ctx.lineWidth = 1.5 + rand() * 3.5;
    ctx.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 140;
      y += (rand() - 0.5) * 140;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Ashlar slab grid lines
  ctx.strokeStyle = 'rgba(84, 78, 68, 0.35)';
  ctx.lineWidth = 4;
  hCtx.strokeStyle = '#383838';
  hCtx.lineWidth = 5;
  for (const step of [size / 2, size]) {
    ctx.strokeRect(2, 2, step - 4, step - 4);
    hCtx.strokeRect(2, 2, step - 4, step - 4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.0, 0.38, 0.72, true);
  return { map, normal, roughness, ao };
}

function createBrushedMetalMaps(size = 512): {
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(1441);
  hCtx.fillStyle = '#888888';
  hCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const v = 105 + Math.floor(rand() * 70);
    hCtx.strokeStyle = `rgba(${v},${v},${v},0.45)`;
    hCtx.lineWidth = 1;
    hCtx.beginPath();
    hCtx.moveTo(x, y);
    hCtx.lineTo(x + 28 + rand() * 64, y + (rand() - 0.5) * 4);
    hCtx.stroke();
  }
  return buildNormalAndRoughnessFromHeight(hCanvas, 1.4, 0.16, 0.42, true);
}

/**
 * Generates high-definition botanical alpha-cutout leaf cluster texture + normal map
 * so trees have crisp organic foliage silhouettes instead of low-poly spheres.
 */
function createBotanicalFoliageTextures(
  kind: 'oak' | 'pine' | 'cypress',
  size = 1024,
): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(kind === 'oak' ? 501 : kind === 'pine' ? 502 : 503);

  ctx.clearRect(0, 0, size, size);
  hCtx.fillStyle = '#404040';
  hCtx.fillRect(0, 0, size, size);

  const cx = size * 0.5;
  const cy = size * 0.5;

  // Woody inner twigs
  ctx.strokeStyle = '#3b291a';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  for (let b = 0; b < 6; b++) {
    const ang = (b / 6) * Math.PI * 2 + rand() * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * size * 0.34, cy + Math.sin(ang) * size * 0.34);
    ctx.stroke();
  }

  if (kind === 'pine') {
    // Dense radiating evergreen needle sprays
    for (let i = 0; i < 520; i++) {
      const r = Math.pow(rand(), 0.6) * size * 0.43;
      const a = rand() * Math.PI * 2;
      const lx = cx + Math.cos(a) * r;
      const ly = cy + Math.sin(a) * r;
      const depth = 1.0 - r / (size * 0.45);
      const g = Math.floor((68 + rand() * 52) * (0.65 + depth * 0.45));
      ctx.strokeStyle = `rgb(${Math.floor(g * 0.45)}, ${g}, ${Math.floor(g * 0.5)})`;
      ctx.lineWidth = 3.2;
      for (let n = 0; n < 5; n++) {
        const na = a + (rand() - 0.5) * 1.4;
        const nLen = 22 + rand() * 26;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(na) * nLen, ly + Math.sin(na) * nLen);
        ctx.stroke();

        const hv = Math.floor(110 + depth * 120);
        hCtx.strokeStyle = `rgb(${hv},${hv},${hv})`;
        hCtx.lineWidth = 3.2;
        hCtx.beginPath();
        hCtx.moveTo(lx, ly);
        hCtx.lineTo(lx + Math.cos(na) * nLen, ly + Math.sin(na) * nLen);
        hCtx.stroke();
      }
    }
  } else {
    // Layered oak/cypress leaf clusters with crisp leaf silhouettes & sunlit highlights
    const leafCount = kind === 'oak' ? 380 : 460;
    for (let i = 0; i < leafCount; i++) {
      const r = Math.pow(rand(), 0.62) * size * 0.42;
      const a = rand() * Math.PI * 2;
      const lx = cx + Math.cos(a) * r;
      const ly = cy + Math.sin(a) * r;
      const lw = (kind === 'oak' ? 24 : 16) + rand() * 18;
      const lh = lw * (kind === 'oak' ? 0.62 : 0.48);
      const rot = rand() * Math.PI * 2;
      const depth = 1.0 - r / (size * 0.45);
      const shade = 0.58 + depth * 0.48 + (rand() - 0.5) * 0.25;

      const baseR = Math.min(255, Math.floor((kind === 'oak' ? 76 : 62) * shade));
      const baseG = Math.min(255, Math.floor((kind === 'oak' ? 124 : 112) * shade));
      const baseB = Math.min(255, Math.floor((kind === 'oak' ? 48 : 52) * shade));

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(rot);
      ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
      ctx.fill();
      // Leaf center vein
      ctx.strokeStyle = `rgba(${Math.min(255, baseR + 28)},${Math.min(255, baseG + 30)},${Math.min(255, baseB + 15)},0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-lw * 0.75, 0);
      ctx.lineTo(lw * 0.75, 0);
      ctx.stroke();
      ctx.restore();

      const hv = Math.min(250, Math.floor(95 + depth * 125 + rand() * 25));
      hCtx.save();
      hCtx.translate(lx, ly);
      hCtx.rotate(rot);
      hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hCtx.beginPath();
      hCtx.ellipse(0, 0, lw, lh, 0, 0, Math.PI * 2);
      hCtx.fill();
      hCtx.restore();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal } = buildNormalAndRoughnessFromHeight(hCanvas, 2.2, 0.55, 0.85, true);
  return { map, normal };
}

function createDirtTexture(size = 512): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const rand = seededRand(1213);
  ctx.fillStyle = '#8b704b';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 4.8;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(98, 76, 48, 0.32)' : 'rgba(166, 139, 96, 0.28)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Seamless 2D periodic value noise for organic procedural textures (zero stripe artifacts).
 */
function createPeriodicNoiseGrid(gridSize: number, seed: number): Float32Array {
  const rand = seededRand(seed);
  const grid = new Float32Array(gridSize * gridSize);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  return grid;
}

function samplePeriodicNoise(grid: Float32Array, gridSize: number, u: number, v: number): number {
  const gx = ((u * gridSize) % gridSize + gridSize) % gridSize;
  const gy = ((v * gridSize) % gridSize + gridSize) % gridSize;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = (x0 + 1) % gridSize;
  const y1 = (y0 + 1) % gridSize;
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v00 = grid[y0 * gridSize + x0];
  const v10 = grid[y0 * gridSize + x1];
  const v01 = grid[y1 * gridSize + x0];
  const v11 = grid[y1 * gridSize + x1];
  return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}

/**
 * Rebuilt from scratch: Sandy compacted forest footpath (písčitá lesní pěšina)
 * with warm quartz sand grain, soft earth/humus mottling, and only occasional scattered fieldstones.
 */
function createFieldTrailPbr(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(4099);

  // Per-pixel multi-octave periodic sandy loam base
  const nCoarse = createPeriodicNoiseGrid(12, 4101);
  const nMid = createPeriodicNoiseGrid(28, 4102);
  const nFine = createPeriodicNoiseGrid(72, 4103);

  const img = ctx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);
  const d = img.data;
  const hd = hImg.data;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const f1 = samplePeriodicNoise(nCoarse, 12, u, v);
      const f2 = samplePeriodicNoise(nMid, 28, u, v);
      const f3 = samplePeriodicNoise(nFine, 72, u, v);
      const grain = (rand() - 0.5) * 0.14;
      const blend = Math.max(0, Math.min(1, f1 * 0.45 + f2 * 0.34 + f3 * 0.21 + grain));

      // Warm golden-ochre forest sand & dry packed soil palette
      const r = Math.round(134 + blend * 46);
      const g = Math.round(111 + blend * 40);
      const b = Math.round(76 + blend * 30);
      const idx = (y * size + x) * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;

      const hv = Math.round(98 + blend * 66);
      hd[idx] = hv;
      hd[idx + 1] = hv;
      hd[idx + 2] = hv;
      hd[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  const drawWrappedPoly = (
    c: CanvasRenderingContext2D,
    pts: [number, number][],
    fill: string,
    stroke?: string,
    lineW = 2,
  ) => {
    c.fillStyle = fill;
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lineW;
    }
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        c.beginPath();
        c.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0] + ox, pts[k][1] + oy);
        c.closePath();
        c.fill();
        if (stroke) c.stroke();
      }
    }
  };

  // Sparse occasional scattered fieldstones (občas nějaký kámen — ~22 stones per tile, not a dense cobble grid)
  for (let i = 0; i < 22; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 11 + rand() * 19;
    const verts = 6 + Math.floor(rand() * 3);
    const pts: [number, number][] = [];
    const baseAng = rand() * Math.PI * 2;
    for (let k = 0; k < verts; k++) {
      const ang = baseAng + (k / verts) * Math.PI * 2 + (rand() - 0.5) * 0.25;
      const r = rad * (0.72 + rand() * 0.42);
      pts.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * (0.76 + rand() * 0.3)]);
    }

    const baseTone = 128 + Math.floor(rand() * 44);
    const warm = Math.floor((rand() - 0.4) * 18);
    drawWrappedPoly(
      ctx,
      pts,
      `rgb(${baseTone + warm}, ${baseTone + Math.floor(warm * 0.6)}, ${baseTone - 8})`,
      'rgba(62, 50, 34, 0.55)',
      2.2,
    );
    const hVal = 188 + Math.floor(rand() * 48);
    drawWrappedPoly(hCtx, pts, `rgb(${hVal},${hVal},${hVal})`, '#4a4a4a', 2.4);
  }

  // Scattered fine pebbles & quartz sand flecks
  for (let i = 0; i < 1400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.5;
    const warm = rand() > 0.4;
    ctx.fillStyle = warm
      ? `rgba(${175 + Math.floor(rand() * 40)}, ${150 + Math.floor(rand() * 32)}, ${110 + Math.floor(rand() * 24)}, 0.65)`
      : `rgba(88, 72, 52, 0.45)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const hv = warm ? 156 + Math.floor(rand() * 55) : 78;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal } = buildNormalAndRoughnessFromHeight(hCanvas, 2.3, 0.72, 0.96, true);
  return { map, normal };
}

/**
 * Rebuilt from scratch: Photorealistic Diablo-grade multi-octave ridged granite cliff rock
 * (natural craggy stone grain, fine mineral fissures, and organic lichen — zero geometric cells or stripes).
 */
function createCliffRockPbr(size = 1024): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(8899);

  // Seamless periodic multi-octave noise grids at 4 frequency scales
  const g1 = createPeriodicNoiseGrid(10, 8911);
  const g2 = createPeriodicNoiseGrid(22, 8912);
  const g3 = createPeriodicNoiseGrid(44, 8913);
  const g4 = createPeriodicNoiseGrid(88, 8914);
  const gMoss = createPeriodicNoiseGrid(14, 8915);
  const gMineral = createPeriodicNoiseGrid(32, 8916);

  const img = ctx.createImageData(size, size);
  const hImg = hCtx.createImageData(size, size);
  const d = img.data;
  const hd = hImg.data;

  const ridge = (val: number) => 1.0 - Math.abs(val * 2.0 - 1.0);

  for (let y = 0; y < size; y++) {
    const v0 = y / size;
    for (let x = 0; x < size; x++) {
      const u0 = x / size;

      // Subtle domain warp to eliminate any axial alignment
      const wx = (samplePeriodicNoise(g1, 10, u0, v0) - 0.5) * 0.08 + (samplePeriodicNoise(g2, 22, u0, v0) - 0.5) * 0.03;
      const wy = (samplePeriodicNoise(g2, 22, v0, u0) - 0.5) * 0.08 + (samplePeriodicNoise(g1, 10, v0, u0) - 0.5) * 0.03;
      const uw = ((u0 + wx) % 1 + 1) % 1;
      const vw = ((v0 + wy) % 1 + 1) % 1;

      const n1 = samplePeriodicNoise(g1, 10, uw, vw);
      const n2 = samplePeriodicNoise(g2, 22, uw, vw);
      const n3 = samplePeriodicNoise(g3, 44, u0, v0);
      const n4 = samplePeriodicNoise(g4, 88, u0, v0);

      // Ridged multifractal rock relief (sharp angular ledges & micro stone plates)
      const r1 = Math.pow(ridge(n1), 1.6);
      const r2 = Math.pow(ridge(n2), 1.4);
      const r3 = ridge(n3);

      // Hairline fracture crevices where both coarse and mid ridge valleys pinch
      const valley = Math.min(r1, r2 * 1.15);
      const crevice = valley < 0.22 ? valley / 0.22 : 1.0;

      const relief = r1 * 0.44 + r2 * 0.30 + r3 * 0.16 + n4 * 0.10;
      const mineral = samplePeriodicNoise(gMineral, 32, u0, v0);
      const speckle = (rand() - 0.5) * 0.075;

      // Subtle dry highland moss/lichen in sheltered stone pockets
      const mossRaw = samplePeriodicNoise(gMoss, 14, uw, vw);
      const mossMask = Math.max(0, (mossRaw - 0.64) * 2.4) * (1.0 - r1 * 0.45);

      // Warm-cool natural granite palette (feldspar beige-grey, slate shadow, quartz flecks)
      const stoneLum = (0.34 + relief * 0.34) * (0.62 + 0.38 * crevice) * (0.86 + mineral * 0.24 + speckle);
      const warmTint = (mineral - 0.5) * 0.14;
      const rCol = Math.max(24, Math.min(205, Math.round(stoneLum * (206 + warmTint * 90) * (1 - mossMask * 0.35))));
      const gCol = Math.max(26, Math.min(202, Math.round(stoneLum * (202 + warmTint * 45) * (1 - mossMask * 0.10) + mossMask * 24)));
      const bCol = Math.max(24, Math.min(196, Math.round(stoneLum * (190 - warmTint * 60) * (1 - mossMask * 0.42))));

      const idx = (y * size + x) * 4;
      d[idx] = rCol;
      d[idx + 1] = gCol;
      d[idx + 2] = bCol;
      d[idx + 3] = 255;

      const hVal = Math.max(16, Math.min(248, Math.round((0.18 + relief * 0.72) * (0.52 + 0.48 * crevice) * 242)));
      hd[idx] = hVal;
      hd[idx + 1] = hVal;
      hd[idx + 2] = hVal;
      hd[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  hCtx.putImageData(hImg, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.8, 0.68, 0.96, true);
  return { map, normal, roughness, ao };
}

function createChainmailTextures(size = 512): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  ctx.fillStyle = '#181b22';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#222222';
  hCtx.fillRect(0, 0, size, size);

  const step = 20;
  for (let row = -1; row <= size / step + 1; row++) {
    const shift = (row % 2) * (step * 0.5);
    for (let col = -1; col <= size / step + 1; col++) {
      const cx = col * step + shift;
      const cy = row * (step * 0.72);
      ctx.strokeStyle = (row + col) % 2 === 0 ? '#68717e' : '#4e5662';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.42, 0, Math.PI * 2);
      ctx.stroke();

      hCtx.strokeStyle = (row + col) % 2 === 0 ? '#dcdcdc' : '#b4b4b4';
      hCtx.lineWidth = 3.5;
      hCtx.beginPath();
      hCtx.arc(cx, cy, step * 0.42, 0, Math.PI * 2);
      hCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness } = buildNormalAndRoughnessFromHeight(hCanvas, 2.2, 0.34, 0.68, true);
  return { map, normal, roughness };
}

function createWatermelonTexture(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = '#337530';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#163a18';
  ctx.lineWidth = 10;
  for (let x = 8; x < size; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= size; y += 16) {
      ctx.lineTo(x + Math.sin(y * 0.12 + x) * 4, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWickerTexture(size = 256): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  ctx.fillStyle = '#9c723f';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 16) {
    for (let x = 0; x < size; x += 16) {
      const alt = ((x / 16 + y / 16) | 0) % 2 === 0;
      ctx.fillStyle = alt ? '#b88b50' : '#7b5629';
      ctx.fillRect(x + 1, y + 1, 14, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256);
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
  grad.addColorStop(0, 'rgba(8, 10, 16, 0.72)');
  grad.addColorStop(0.52, 'rgba(8, 10, 16, 0.34)');
  grad.addColorStop(1, 'rgba(8, 10, 16, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Pure smooth Gaussian atmospheric mist glow without hard circular rim or banding.
 */
function createHaloGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const half = size * 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      // Smooth edge fade reaching exact 0 by r=0.92 + gentle inverse-exponential core
      const edge = Math.max(0, 1 - r / 0.92);
      const smoothEdge = edge * edge * (3 - 2 * edge);
      const gauss = Math.exp(-r2 * 8.5) * smoothEdge;
      const core = Math.exp(-r2 * 26.0) * 0.35;
      const alpha = Math.min(1, gauss * 0.75 + core);
      const idx = (y * size + x) * 4;
      d[idx] = 255;
      d[idx + 1] = Math.round(170 + 65 * Math.exp(-r2 * 14));
      d[idx + 2] = Math.round(78 + 90 * Math.exp(-r2 * 20));
      d[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCursorRingTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256);
  ctx.clearRect(0, 0, 256, 256);

  ctx.strokeStyle = '#7effa0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#fff0a8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(128, 128, 66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#c4ffcb';
  const ticks = [
    [122, 14, 12, 26],
    [122, 216, 12, 26],
    [14, 122, 26, 12],
    [216, 122, 26, 12],
  ];
  for (const [x, y, w, h] of ticks) {
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBannerTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#1d3968';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven fabric horizontal/vertical threads
  for (let y = 0; y < 512; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, 512, 2);
  }

  // Ornate gilded heraldic border
  ctx.strokeStyle = '#d7ab4b';
  ctx.lineWidth = 18;
  ctx.strokeRect(24, 20, 464, 472);
  ctx.strokeStyle = '#926a22';
  ctx.lineWidth = 4;
  ctx.strokeRect(42, 36, 428, 440);

  // Central Royal Prontera Cross / Star Crest
  ctx.fillStyle = '#e6c064';
  ctx.beginPath();
  ctx.moveTo(256, 130);
  ctx.lineTo(286, 214);
  ctx.lineTo(366, 214);
  ctx.lineTo(302, 266);
  ctx.lineTo(324, 348);
  ctx.lineTo(256, 300);
  ctx.lineTo(188, 348);
  ctx.lineTo(210, 266);
  ctx.lineTo(146, 214);
  ctx.lineTo(226, 214);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWaterNormalTexture(size = 1024): THREE.CanvasTexture {
  const [hCanvas, hCtx] = makeCanvas(size);
  const img = hCtx.createImageData(size, size);
  const d = img.data;
  const twoPi = Math.PI * 2;
  // Seamless 6-octave directional Gerstner swell + capillary wavelet heightfield
  for (let y = 0; y < size; y++) {
    const v = (y / size) * twoPi;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * twoPi;
      const w1 = Math.sin(u * 2 + v * 1) * 0.24 + Math.cos(u * 3 - v * 2) * 0.22;
      const w2 = Math.sin(u * 5 - v * 4 + 0.8) * 0.16 + Math.cos(u * 7 + v * 5 + 0.4) * 0.14;
      const w3 = Math.sin(u * 11 + v * 9 + 1.7) * 0.09 + Math.cos(u * 13 - v * 11) * 0.08;
      const w4 = Math.sin(u * 21 - v * 17 + 2.3) * 0.04 + Math.cos(u * 27 + v * 23) * 0.03;
      const val = Math.max(0, Math.min(255, Math.round(128 + (w1 + w2 + w3 + w4) * 115)));
      const idx = (y * size + x) * 4;
      d[idx] = val;
      d[idx + 1] = val;
      d[idx + 2] = val;
      d[idx + 3] = 255;
    }
  }
  hCtx.putImageData(img, 0, 0);
  const { normal } = buildNormalAndRoughnessFromHeight(hCanvas, 3.1, 0.06, 0.18, true);
  return normal;
}

function createQuiltedLeatherTextures(size = 512): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);

  // Dark obsidian charcoal leather base
  ctx.fillStyle = '#24272f';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#9e9e9e';
  hCtx.fillRect(0, 0, size, size);

  const step = 64;
  // Subtle puffed diamond padding + stitched diagonal seams + silver rivets
  for (let gy = -1; gy <= size / step + 1; gy++) {
    for (let gx = -1; gx <= size / step + 1; gx++) {
      const cx = gx * step;
      const cy = gy * step;
      const grad = hCtx.createRadialGradient(cx, cy + step * 0.5, 4, cx, cy + step * 0.5, step * 0.45);
      grad.addColorStop(0, '#dadada');
      grad.addColorStop(1, '#585858');
      hCtx.fillStyle = grad;
      hCtx.beginPath();
      hCtx.moveTo(cx, cy);
      hCtx.lineTo(cx + step * 0.5, cy + step * 0.5);
      hCtx.lineTo(cx, cy + step);
      hCtx.lineTo(cx - step * 0.5, cy + step * 0.5);
      hCtx.closePath();
      hCtx.fill();
    }
  }

  ctx.strokeStyle = '#15171c';
  ctx.lineWidth = 3;
  hCtx.strokeStyle = '#323232';
  hCtx.lineWidth = 3;
  for (let i = -size; i <= size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - size, size);
    ctx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i + size, size);
    hCtx.stroke();

    hCtx.beginPath();
    hCtx.moveTo(i, 0);
    hCtx.lineTo(i - size, size);
    hCtx.stroke();
  }

  // Silver studs at diamond intersections
  for (let gy = 0; gy <= size / step; gy++) {
    for (let gx = 0; gx <= size / step; gx++) {
      const rx = gx * step;
      const ry = gy * step;
      ctx.fillStyle = '#aeb6c4';
      ctx.beginPath();
      ctx.arc(rx, ry, 3.2, 0, Math.PI * 2);
      ctx.fill();
      hCtx.fillStyle = '#ffffff';
      hCtx.beginPath();
      hCtx.arc(rx, ry, 3.6, 0, Math.PI * 2);
      hCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.4, 0.34, 0.72, true);
  return { map, normal, roughness, ao };
}

/**
 * Generates dark-forged gothic gunmetal plate textures (brushed slate-iron, subtle V-fluting,
 * micro hammer marks & crevice grime) matching dark-fantasy knight plate armor.
 */
function createGothicArmorTextures(size = 512): {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
} {
  const [canvas, ctx] = makeCanvas(size);
  const [hCanvas, hCtx] = makeCanvas(size);
  const rand = seededRand(4409);

  // Deep weathered gunmetal iron base
  ctx.fillStyle = '#484f5a';
  ctx.fillRect(0, 0, size, size);
  hCtx.fillStyle = '#929292';
  hCtx.fillRect(0, 0, size, size);

  // Subtle horizontal & vertical brushed steel micro-grain
  for (let y = 0; y < size; y += 2) {
    const v = Math.floor((rand() - 0.5) * 18);
    ctx.fillStyle = v > 0 ? `rgba(210,220,235,${(v / 220).toFixed(3)})` : `rgba(12,15,20,${(-v / 170).toFixed(3)})`;
    ctx.fillRect(0, y, size, 1);

    const hv = 136 + v * 2;
    hCtx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hCtx.fillRect(0, y, size, 1);
  }

  // Subtle hammered dimples & weathered patina
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 14;
    const dark = rand() > 0.45;
    ctx.fillStyle = dark ? 'rgba(18, 22, 28, 0.14)' : 'rgba(170, 182, 198, 0.09)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    hCtx.fillStyle = dark ? 'rgba(92,92,92,0.18)' : 'rgba(168,168,168,0.14)';
    hCtx.beginPath();
    hCtx.arc(x, y, r, 0, Math.PI * 2);
    hCtx.fill();
  }

  // Fine gothic bevel/flute grooves
  const step = size / 4;
  for (let k = 0; k < 4; k++) {
    const gy = k * step;
    const grad = ctx.createLinearGradient(0, gy, 0, gy + step);
    grad.addColorStop(0.0, 'rgba(20, 23, 28, 0.35)');
    grad.addColorStop(0.14, 'rgba(195, 206, 220, 0.14)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.92, 'rgba(18, 21, 26, 0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, gy, size, step);

    const hGrad = hCtx.createLinearGradient(0, gy, 0, gy + step);
    hGrad.addColorStop(0.0, 'rgba(62, 62, 62, 0.55)');
    hGrad.addColorStop(0.16, 'rgba(210, 210, 210, 0.35)');
    hGrad.addColorStop(0.55, 'rgba(145, 145, 145, 0)');
    hGrad.addColorStop(0.94, 'rgba(72, 72, 72, 0.50)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, gy, size, step);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const { normal, roughness, ao } = buildNormalAndRoughnessFromHeight(hCanvas, 2.2, 0.28, 0.62, true);
  return { map, normal, roughness, ao };
}

export function createPronteraMaterials(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  weatherUniforms: WeatherShaderUniforms,
): PronteraMaterials {
  const maxAniso = isSoftwareGl ? 1 : Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();

  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const trackTex = <T extends THREE.Texture>(t: T, srgb = false, repeatX = 1, repeatY = 1): T => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = maxAniso;
    textures.push(t);
    return t;
  };

  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const procRes = isSoftwareGl ? 512 : 1024;
  const leafRes = isSoftwareGl ? 512 : 1024;

  // Fallback synchronous normal/roughness/ao maps for image textures (upgraded pixel-for-pixel once loaded)
  const cobbleFallbackPbr = buildNormalAndRoughnessFromHeight(
    createCobbleFallbackHeight(procRes),
    3.0,
    0.45,
    0.92,
    true,
  );
  trackTex(cobbleFallbackPbr.normal, false);
  trackTex(cobbleFallbackPbr.roughness, false);
  trackTex(cobbleFallbackPbr.ao, false);

  const wallFallbackPbr = buildNormalAndRoughnessFromHeight(
    createStoneWallFallbackHeight(procRes),
    2.6,
    0.58,
    0.94,
    true,
  );
  trackTex(wallFallbackPbr.normal, false);
  trackTex(wallFallbackPbr.roughness, false);
  trackTex(wallFallbackPbr.ao, false);

  const cobble = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2b69e,
      normalMap: cobbleFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughnessMap: cobbleFallbackPbr.roughness,
      aoMap: cobbleFallbackPbr.ao,
      aoMapIntensity: 0.78,
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  cobble.userData.pbrKind = 'stone';

  const castleWall = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc4b9a4,
      normalMap: wallFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: wallFallbackPbr.roughness,
      aoMap: wallFallbackPbr.ao,
      aoMapIntensity: 0.76,
      roughness: 0.9,
      metalness: 0.04,
    }),
  );
  castleWall.userData.pbrKind = 'stone';

  const roofCobalt = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x6b9ac4,
      normalMap: wallFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: wallFallbackPbr.roughness,
      aoMap: wallFallbackPbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.68,
      metalness: 0.16,
    }),
  );
  roofCobalt.userData.pbrKind = 'roof';

  const roofTerracotta = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd17e5a,
      normalMap: wallFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: wallFallbackPbr.roughness,
      aoMap: wallFallbackPbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.74,
      metalness: 0.08,
    }),
  );
  roofTerracotta.userData.pbrKind = 'roof';

  const roofSlate = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x768d98,
      normalMap: wallFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: wallFallbackPbr.roughness,
      aoMap: wallFallbackPbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.64,
      metalness: 0.2,
    }),
  );
  roofSlate.userData.pbrKind = 'roof';

  const roofRoyal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x4570ab,
      normalMap: wallFallbackPbr.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: wallFallbackPbr.roughness,
      aoMap: wallFallbackPbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.58,
      metalness: 0.24,
    }),
  );
  roofRoyal.userData.pbrKind = 'roof';

  // Load 3 HD generate_image seamless textures and extract real Sobel normal + roughness + AO maps
  const cobbleMap = trackTex(
    loader.load(cobbleUrl, (tex) => {
      if (tex.image) {
        const pbr = derivePbrFromLoadedImage(tex.image, procRes, 3.2, 0.46, 0.94);
        trackTex(pbr.normal, false);
        trackTex(pbr.roughness, false);
        trackTex(pbr.ao, false);
        cobble.normalMap = pbr.normal;
        cobble.roughnessMap = pbr.roughness;
        cobble.aoMap = pbr.ao;
        cobble.needsUpdate = true;
      }
    }),
    true,
  );
  cobble.map = cobbleMap;

  const wallMap = trackTex(
    loader.load(wallUrl, (tex) => {
      if (tex.image) {
        const pbr = derivePbrFromLoadedImage(tex.image, procRes, 2.7, 0.56, 0.94);
        trackTex(pbr.normal, false);
        trackTex(pbr.roughness, false);
        trackTex(pbr.ao, false);
        castleWall.normalMap = pbr.normal;
        castleWall.roughnessMap = pbr.roughness;
        castleWall.aoMap = pbr.ao;
        castleWall.needsUpdate = true;
      }
    }),
    true,
  );
  castleWall.map = wallMap;

  const roofBaseTex = trackTex(
    loader.load(roofUrl, (tex) => {
      if (tex.image) {
        const pbr = derivePbrFromLoadedImage(tex.image, procRes, 3.0, 0.42, 0.86);
        trackTex(pbr.normal, false);
        trackTex(pbr.roughness, false);
        trackTex(pbr.ao, false);
        for (const rMat of [roofCobalt, roofTerracotta, roofSlate, roofRoyal]) {
          rMat.normalMap = pbr.normal;
          rMat.roughnessMap = pbr.roughness;
          rMat.aoMap = pbr.ao;
          rMat.needsUpdate = true;
        }
      }
    }),
    true,
  );
  roofCobalt.map = roofBaseTex;
  roofTerracotta.map = roofBaseTex;
  roofSlate.map = roofBaseTex;
  roofRoyal.map = roofBaseTex;

  // Full-HD Procedural PBR Materials
  const grassPbr = createGrassTextures(procRes);
  trackTex(grassPbr.map, true, 54, 54);
  trackTex(grassPbr.normal, false, 54, 54);
  trackTex(grassPbr.roughness, false, 54, 54);
  trackTex(grassPbr.ao, false, 54, 54);

  const plasterPbr = createHalfTimberPlasterTextures(procRes);
  trackTex(plasterPbr.map, true);
  trackTex(plasterPbr.normal, false);
  trackTex(plasterPbr.roughness, false);
  trackTex(plasterPbr.ao, false);

  const woodPbr = createWoodPlankTextures(procRes, '#624026');
  trackTex(woodPbr.map, true);
  trackTex(woodPbr.normal, false);
  trackTex(woodPbr.roughness, false);
  trackTex(woodPbr.ao, false);

  const barkPbr = createBarkTextures(procRes);
  trackTex(barkPbr.map, true, 2, 3);
  trackTex(barkPbr.normal, false, 2, 3);
  trackTex(barkPbr.roughness, false, 2, 3);
  trackTex(barkPbr.ao, false, 2, 3);

  const marblePbr = createMarbleTextures(procRes);
  trackTex(marblePbr.map, true, 2, 2);
  trackTex(marblePbr.normal, false, 2, 2);
  trackTex(marblePbr.roughness, false, 2, 2);
  trackTex(marblePbr.ao, false, 2, 2);

  const metalPbr = createBrushedMetalMaps(512);
  trackTex(metalPbr.normal, false, 2, 2);
  trackTex(metalPbr.roughness, false, 2, 2);

  const oakLeafPbr = createBotanicalFoliageTextures('oak', leafRes);
  trackTex(oakLeafPbr.map, true);
  trackTex(oakLeafPbr.normal, false);
  oakLeafPbr.map.wrapS = THREE.ClampToEdgeWrapping;
  oakLeafPbr.map.wrapT = THREE.ClampToEdgeWrapping;

  const pineLeafPbr = createBotanicalFoliageTextures('pine', leafRes);
  trackTex(pineLeafPbr.map, true);
  trackTex(pineLeafPbr.normal, false);
  pineLeafPbr.map.wrapS = THREE.ClampToEdgeWrapping;
  pineLeafPbr.map.wrapT = THREE.ClampToEdgeWrapping;

  const cypressLeafPbr = createBotanicalFoliageTextures('cypress', leafRes);
  trackTex(cypressLeafPbr.map, true);
  trackTex(cypressLeafPbr.normal, false);
  cypressLeafPbr.map.wrapS = THREE.ClampToEdgeWrapping;
  cypressLeafPbr.map.wrapT = THREE.ClampToEdgeWrapping;

  const dirtMap = trackTex(createDirtTexture(512), true, 8, 8);
  const fieldTrailPbr = createFieldTrailPbr(procRes);
  trackTex(fieldTrailPbr.map, true, 16, 16);
  trackTex(fieldTrailPbr.normal, false, 16, 16);

  const cliffPbr = createCliffRockPbr(procRes);
  trackTex(cliffPbr.map, true, 3, 3);
  trackTex(cliffPbr.normal, false, 3, 3);
  trackTex(cliffPbr.roughness, false, 3, 3);
  trackTex(cliffPbr.ao, false, 3, 3);

  const watermelonTex = trackTex(createWatermelonTexture(256), true);
  const wickerTex = trackTex(createWickerTexture(256), true, 3, 2);

  const shadowTex = trackTex(createContactShadowTexture(), true);
  shadowTex.wrapS = THREE.ClampToEdgeWrapping;
  shadowTex.wrapT = THREE.ClampToEdgeWrapping;

  const cursorTex = trackTex(createCursorRingTexture(), true);
  cursorTex.wrapS = THREE.ClampToEdgeWrapping;
  cursorTex.wrapT = THREE.ClampToEdgeWrapping;

  const haloGlowTex = trackTex(createHaloGlowTexture(), true);
  haloGlowTex.wrapS = THREE.ClampToEdgeWrapping;
  haloGlowTex.wrapT = THREE.ClampToEdgeWrapping;

  const waterNormalMap = trackTex(createWaterNormalTexture(1024), false, 3, 3);
  const quiltedPbr = createQuiltedLeatherTextures(512);
  trackTex(quiltedPbr.map, true, 2, 2);
  trackTex(quiltedPbr.normal, false, 2, 2);
  trackTex(quiltedPbr.roughness, false, 2, 2);
  trackTex(quiltedPbr.ao, false, 2, 2);

  const chainmailPbr = createChainmailTextures(512);
  trackTex(chainmailPbr.map, true, 4, 4);
  trackTex(chainmailPbr.normal, false, 4, 4);
  trackTex(chainmailPbr.roughness, false, 4, 4);

  const gothicArmorPbr = createGothicArmorTextures(512);
  trackTex(gothicArmorPbr.map, true, 2, 2);
  trackTex(gothicArmorPbr.normal, false, 2, 2);
  trackTex(gothicArmorPbr.roughness, false, 2, 2);
  trackTex(gothicArmorPbr.ao, false, 2, 2);

  const plazaAccentStone = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xbcb09b,
      map: marblePbr.map,
      normalMap: marblePbr.normal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: marblePbr.roughness,
      aoMap: marblePbr.ao,
      aoMapIntensity: 0.65,
      roughness: 0.7,
      metalness: 0.08,
    }),
  );
  plazaAccentStone.userData.pbrKind = 'stone';

  const curbStone = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x948976,
      map: marblePbr.map,
      normalMap: marblePbr.normal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: marblePbr.roughness,
      aoMap: marblePbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.82,
      metalness: 0.05,
    }),
  );
  curbStone.userData.pbrKind = 'stone';

  const grass = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: grassPbr.map,
      normalMap: grassPbr.normal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: grassPbr.roughness,
      aoMap: grassPbr.ao,
      aoMapIntensity: 0.55,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );
  grass.userData.pbrKind = 'grassGround';

  const grassBladeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8edb8,
      roughness: 0.64,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  applyGrassWindShader(grassBladeMat, weatherUniforms, 0.52);

  const tallGrassBladeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcfe8a8,
      roughness: 0.60,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  applyGrassWindShader(tallGrassBladeMat, weatherUniforms, 0.92);

  const wildflowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  applyGrassWindShader(wildflowerMat, weatherUniforms, 0.52);

  const dirtPath = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6dac5,
      map: dirtMap,
      normalMap: grassPbr.normal,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.95,
      metalness: 0.0,
    }),
  );
  dirtPath.userData.pbrKind = 'grassGround';

  const cliffRock = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd8dcd2,
      map: cliffPbr.map,
      normalMap: cliffPbr.normal,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: cliffPbr.roughness,
      aoMap: cliffPbr.ao,
      aoMapIntensity: 0.85,
      roughness: 0.9,
      metalness: 0.04,
    }),
  );
  cliffRock.userData.pbrKind = 'stone';

  const plasterTimber = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdfd4c0,
      map: plasterPbr.map,
      normalMap: plasterPbr.normal,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: plasterPbr.roughness,
      aoMap: plasterPbr.ao,
      aoMapIntensity: 0.68,
      roughness: 0.86,
      metalness: 0.03,
    }),
  );
  plasterTimber.userData.pbrKind = 'plaster';

  const darkTimber = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x916c4c,
      map: woodPbr.map,
      normalMap: woodPbr.normal,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: woodPbr.roughness,
      aoMap: woodPbr.ao,
      aoMapIntensity: 0.7,
      roughness: 0.8,
      metalness: 0.04,
    }),
  );
  darkTimber.userData.pbrKind = 'wood';

  const oakWood = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc9a57d,
      map: woodPbr.map,
      normalMap: woodPbr.normal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: woodPbr.roughness,
      aoMap: woodPbr.ao,
      aoMapIntensity: 0.68,
      roughness: 0.74,
      metalness: 0.05,
    }),
  );
  oakWood.userData.pbrKind = 'wood';

  const marble = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc6bcab,
      map: marblePbr.map,
      normalMap: marblePbr.normal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: marblePbr.roughness,
      aoMap: marblePbr.ao,
      aoMapIntensity: 0.64,
      roughness: 0.5,
      metalness: 0.08,
    }),
  );
  marble.userData.pbrKind = 'stone';

  const marbleTrim = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x998d77,
      map: marblePbr.map,
      normalMap: marblePbr.normal,
      normalScale: new THREE.Vector2(0.9, 0.9),
      aoMap: marblePbr.ao,
      aoMapIntensity: 0.68,
      roughness: 0.72,
      metalness: 0.06,
    }),
  );
  marbleTrim.userData.pbrKind = 'stone';

  const waterFountain = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x104a66,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      normalMap: waterNormalMap,
      normalScale: new THREE.Vector2(0.82, 0.82),
      roughness: 0.12,
      metalness: 0.06,
      transparent: true,
      opacity: 0.90,
      clearcoat: 0.55,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.85,
    }),
  );
  applyWaterRippleShader(waterFountain, weatherUniforms, 1.35);

  const waterMoat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b394f,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      normalMap: waterNormalMap,
      normalScale: new THREE.Vector2(0.92, 0.92),
      roughness: 0.14,
      metalness: 0.06,
      transparent: true,
      opacity: 0.93,
      clearcoat: 0.52,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.82,
    }),
  );
  applyWaterRippleShader(waterMoat, weatherUniforms, 0.90);

  const goldTrim = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe3b44d,
      normalMap: metalPbr.normal,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: metalPbr.roughness,
      roughness: 0.24,
      metalness: 0.92,
      envMapIntensity: 1.45,
    }),
  );
  goldTrim.userData.pbrKind = 'metal';

  const wroughtIron = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x2b313a,
      normalMap: metalPbr.normal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: metalPbr.roughness,
      roughness: 0.38,
      metalness: 0.86,
      envMapIntensity: 1.28,
    }),
  );
  wroughtIron.userData.pbrKind = 'metal';

  const steelArmor = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc2cbd6,
      normalMap: metalPbr.normal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: metalPbr.roughness,
      roughness: 0.24,
      metalness: 0.93,
      anisotropy: 0.76,
      clearcoat: 0.25,
      envMapIntensity: 1.58,
    }),
  );
  steelArmor.userData.pbrKind = 'metal';

  const darkSteel = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x454c57,
      normalMap: metalPbr.normal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: metalPbr.roughness,
      roughness: 0.40,
      metalness: 0.78,
      anisotropy: 0.38,
      clearcoat: 0.08,
      envMapIntensity: 0.78,
    }),
  );
  darkSteel.userData.pbrKind = 'metal';
  darkSteel.userData.lockEnvIntensity = true;

  const gunmetalArmor = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: gothicArmorPbr.map,
      normalMap: gothicArmorPbr.normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      roughnessMap: gothicArmorPbr.roughness,
      aoMap: gothicArmorPbr.ao,
      aoMapIntensity: 0.78,
      roughness: 0.38,
      metalness: 0.78,
      anisotropy: 0.34,
      clearcoat: 0.08,
      clearcoatRoughness: 0.42,
      envMapIntensity: 0.85,
    }),
  );
  gunmetalArmor.userData.pbrKind = 'metal';
  gunmetalArmor.userData.lockEnvIntensity = true;

  // Calibrated bright battle steel - musi cist i z dalky proti tmave zemi.
  const forgedBlade = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9aa3ad,
      normalMap: metalPbr.normal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: metalPbr.roughness,
      roughness: 0.34,
      metalness: 0.85,
      anisotropy: 0.32,
      clearcoat: 0.0,
      envMapIntensity: 1.0,
    }),
  );
  forgedBlade.userData.pbrSkip = true;
  forgedBlade.userData.lockEnvIntensity = true;

  const chainmail = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8b94a1,
      map: chainmailPbr.map,
      normalMap: chainmailPbr.normal,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughnessMap: chainmailPbr.roughness,
      roughness: 0.58,
      metalness: 0.68,
      envMapIntensity: 0.72,
    }),
  );
  chainmail.userData.pbrKind = 'metal';
  chainmail.userData.lockEnvIntensity = true;

  const quiltedLeather = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: quiltedPbr.map,
      normalMap: quiltedPbr.normal,
      normalScale: new THREE.Vector2(1.18, 1.18),
      roughnessMap: quiltedPbr.roughness,
      aoMap: quiltedPbr.ao,
      aoMapIntensity: 0.8,
      roughness: 0.56,
      metalness: 0.18,
      clearcoat: 0.16,
      clearcoatRoughness: 0.48,
    }),
  );
  quiltedLeather.userData.pbrKind = 'leather';

  const darkCoat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x1a1c22,
      roughness: 0.84,
      metalness: 0.04,
      sheen: 0.55,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color(0x525a6a),
      side: THREE.DoubleSide,
    }),
  );
  darkCoat.userData.pbrKind = 'cloth';

  const windowGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffe4aa,
      emissive: new THREE.Color(0xffa93d),
      emissiveIntensity: 0.55,
      roughness: 0.14,
      metalness: 0.15,
      envMapIntensity: 1.1,
    }),
  );
  windowGlow.userData.pbrSkip = true;

  const stainedGlass = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8cc2ff,
      emissive: new THREE.Color(0xffb45c),
      emissiveIntensity: 0.65,
      roughness: 0.12,
      metalness: 0.1,
    }),
  );
  stainedGlass.userData.pbrSkip = true;

  const lanternGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff2cc,
      emissive: new THREE.Color(0xffb23b),
      emissiveIntensity: 1.15,
      roughness: 0.15,
      metalness: 0.05,
    }),
  );
  lanternGlow.userData.pbrSkip = true;

  const emberGlow = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xff9238,
      emissive: new THREE.Color(0xff5a12),
      emissiveIntensity: 1.9,
      roughness: 0.4,
      metalness: 0.0,
    }),
  );
  emberGlow.userData.pbrSkip = true;

  const carpetRoyal = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8b2024,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  carpetRoyal.userData.pbrKind = 'cloth';

  const bannerTex = trackTex(createBannerTexture(), true);
  bannerTex.wrapS = THREE.ClampToEdgeWrapping;
  bannerTex.wrapT = THREE.ClampToEdgeWrapping;

  const bannerBlue = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: bannerTex,
      roughness: 0.84,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
  );
  bannerBlue.userData.pbrKind = 'cloth';
  applyWorldWeatherShader(bannerBlue, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.15,
    swayAmp: 0.14,
    swayHeightOffset: -1.6,
  });

  const foliageOakMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f8ec,
      map: oakLeafPbr.map,
      normalMap: oakLeafPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  foliageOakMat.userData.pbrKind = 'foliage';

  const foliagePineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeaf4e6,
      map: pineLeafPbr.map,
      normalMap: pineLeafPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      alphaTest: 0.38,
      side: THREE.DoubleSide,
      roughness: 0.76,
      metalness: 0.02,
    }),
  );
  foliagePineMat.userData.pbrKind = 'foliage';

  const foliageCypressMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f0df,
      map: cypressLeafPbr.map,
      normalMap: cypressLeafPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.02,
    }),
  );
  foliageCypressMat.userData.pbrKind = 'foliage';

  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6d4ba,
      map: barkPbr.map,
      normalMap: barkPbr.normal,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: barkPbr.roughness,
      aoMap: barkPbr.ao,
      aoMapIntensity: 0.72,
      roughness: 0.92,
      metalness: 0.0,
    }),
  );
  trunkMat.userData.pbrKind = 'wood';

  // Inject shared weather shader (rain puddles/wet sheen + snow accumulation + foliage wind)
  applyWorldWeatherShader(cobble, weatherUniforms, { allowPuddles: true, snowAmount: 0.95, wetDarken: 0.46 });
  applyWorldWeatherShader(plazaAccentStone, weatherUniforms, { allowPuddles: true, snowAmount: 0.9, wetDarken: 0.42 });
  applyWorldWeatherShader(curbStone, weatherUniforms, { allowPuddles: false, snowAmount: 0.98, wetDarken: 0.38 });
  applyWorldWeatherShader(grass, weatherUniforms, { allowPuddles: false, snowAmount: 1.05, wetDarken: 0.32 });
  applyWorldWeatherShader(dirtPath, weatherUniforms, { allowPuddles: true, snowAmount: 0.92, wetDarken: 0.45 });
  applyWorldWeatherShader(castleWall, weatherUniforms, { allowPuddles: false, snowAmount: 0.88, wetDarken: 0.32 });
  applyWorldWeatherShader(plasterTimber, weatherUniforms, { allowPuddles: false, snowAmount: 0.78, wetDarken: 0.25 });
  applyWorldWeatherShader(roofCobalt, weatherUniforms, { allowPuddles: false, snowAmount: 1.0, wetDarken: 0.34 });
  applyWorldWeatherShader(roofTerracotta, weatherUniforms, { allowPuddles: false, snowAmount: 1.0, wetDarken: 0.34 });
  applyWorldWeatherShader(roofSlate, weatherUniforms, { allowPuddles: false, snowAmount: 1.0, wetDarken: 0.34 });
  applyWorldWeatherShader(roofRoyal, weatherUniforms, { allowPuddles: false, snowAmount: 1.0, wetDarken: 0.34 });
  applyWorldWeatherShader(darkTimber, weatherUniforms, { allowPuddles: false, snowAmount: 0.7, wetDarken: 0.34 });
  applyWorldWeatherShader(oakWood, weatherUniforms, { allowPuddles: false, snowAmount: 0.75, wetDarken: 0.32 });
  applyWorldWeatherShader(marble, weatherUniforms, { allowPuddles: true, snowAmount: 0.85, wetDarken: 0.3 });
  applyWorldWeatherShader(marbleTrim, weatherUniforms, { allowPuddles: false, snowAmount: 0.9, wetDarken: 0.32 });
  applyWorldWeatherShader(wroughtIron, weatherUniforms, { allowPuddles: false, snowAmount: 0.55, wetDarken: 0.2 });
  applyWorldWeatherShader(trunkMat, weatherUniforms, { allowPuddles: false, snowAmount: 0.55, wetDarken: 0.3 });
  applyWorldWeatherShader(foliageOakMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.95,
    wetDarken: 0.28,
    swayAmp: 0.08,
    swayHeightOffset: 2.2,
  });
  applyWorldWeatherShader(foliagePineMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 1.05,
    wetDarken: 0.26,
    swayAmp: 0.06,
    swayHeightOffset: 2.0,
  });
  applyWorldWeatherShader(foliageCypressMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.92,
    wetDarken: 0.26,
    swayAmp: 0.07,
    swayHeightOffset: 2.0,
  });

  const shrubLeafMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe6f2dc,
      map: oakLeafPbr.map,
      normalMap: oakLeafPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      alphaTest: 0.36,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.02,
    }),
  );
  shrubLeafMat.userData.pbrKind = 'foliage';
  applyWorldWeatherShader(shrubLeafMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.72,
    wetDarken: 0.28,
    swayAmp: 0.045,
    swayHeightOffset: 0.05,
  });

  const shrubFlowerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.02,
    }),
  );
  shrubFlowerMat.userData.pbrKind = 'foliage';
  applyWorldWeatherShader(shrubFlowerMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.45,
    wetDarken: 0.25,
    swayAmp: 0.045,
    swayHeightOffset: 0.05,
  });

  const createAwningMaterial = (canopyColor: number, accentColor: number) => {
    const texSize = 1024;
    const [canvas, ctx] = makeCanvas(texSize);
    const [hCanvas, hCtx] = makeCanvas(texSize);
    const c1 = new THREE.Color(canopyColor).getStyle();
    const c2 = new THREE.Color(accentColor).getStyle();
    const stripes = 8;
    const sw = texSize / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? c1 : c2;
      ctx.fillRect(i * sw, 0, Math.ceil(sw), texSize);
      // Subtle stitched seam shadow between fabric panels
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(i * sw, 0, 4, texSize);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(i * sw + 4, 0, 2, texSize);
    }
    // Fine woven canvas thread relief
    hCtx.fillStyle = '#888888';
    hCtx.fillRect(0, 0, texSize, texSize);
    for (let y = 0; y < texSize; y += 6) {
      ctx.fillStyle = y % 12 === 0 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.035)';
      ctx.fillRect(0, y, texSize, 3);
      hCtx.fillStyle = y % 12 === 0 ? '#747474' : '#9c9c9c';
      hCtx.fillRect(0, y, texSize, 3);
    }
    const tex = trackTex(new THREE.CanvasTexture(canvas), true);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const clothPbr = buildNormalAndRoughnessFromHeight(hCanvas, 1.3, 0.72, 0.94, true);
    trackTex(clothPbr.normal, false);
    const m = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: tex,
        normalMap: clothPbr.normal,
        normalScale: new THREE.Vector2(0.45, 0.45),
        roughness: 0.86,
        sheen: 0.35,
        sheenRoughness: 0.64,
        side: THREE.FrontSide,
        shadowSide: THREE.FrontSide,
      }),
    );
    m.userData.pbrKind = 'cloth';
    applyWorldWeatherShader(m, weatherUniforms, {
      allowPuddles: false,
      snowAmount: 0.65,
      wetDarken: 0.34,
    });
    return m;
  };

  const aoSkirt = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x090c12,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );

  const contactShadow = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.54,
    }),
  );

  const cursorRing = trackMat(
    new THREE.MeshBasicMaterial({
      map: cursorTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.94,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );

  const foliageBirchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf4f0b8,
      map: oakLeafPbr.map,
      normalMap: oakLeafPbr.normal,
      normalScale: new THREE.Vector2(0.85, 0.85),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.74,
      metalness: 0.02,
    }),
  );
  foliageBirchMat.userData.pbrKind = 'foliage';
  applyWorldWeatherShader(foliageBirchMat, weatherUniforms, {
    allowPuddles: false,
    snowAmount: 0.92,
    wetDarken: 0.25,
    swayAmp: 0.08,
    swayHeightOffset: 2.2,
  });

  const wickerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe8d5b7,
      map: wickerTex,
      roughness: 0.88,
      metalness: 0.02,
    }),
  );
  wickerMat.userData.pbrKind = 'wood';

  const appleRedMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xb81d22,
      roughness: 0.24,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
    }),
  );
  appleRedMat.userData.pbrKind = 'leather';

  const appleGreenMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x6ea62c,
      roughness: 0.26,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    }),
  );
  appleGreenMat.userData.pbrKind = 'leather';

  const orangeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe67318,
      roughness: 0.36,
      clearcoat: 0.45,
      clearcoatRoughness: 0.28,
    }),
  );
  orangeMat.userData.pbrKind = 'leather';

  const grapeMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x52215c,
      roughness: 0.34,
      clearcoat: 0.52,
      clearcoatRoughness: 0.25,
    }),
  );
  grapeMat.userData.pbrKind = 'leather';

  const watermelonMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: watermelonTex,
      roughness: 0.28,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
    }),
  );
  watermelonMat.userData.pbrKind = 'leather';

  const pumpkinMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc95f18,
      roughness: 0.62,
      metalness: 0.02,
    }),
  );
  pumpkinMat.userData.pbrKind = 'wood';

  const pearMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc2b838,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    }),
  );
  pearMat.userData.pbrKind = 'leather';

  return {
    cobble,
    plazaAccentStone,
    curbStone,
    grass,
    grassBladeMat,
    tallGrassBladeMat,
    wildflowerMat,
    dirtPath,
    cliffRock,
    castleWall,
    plasterTimber,
    roofCobalt,
    roofTerracotta,
    roofSlate,
    roofRoyal,
    darkTimber,
    oakWood,
    marble,
    marbleTrim,
    waterFountain,
    waterMoat,
    goldTrim,
    wroughtIron,
    steelArmor,
    darkSteel,
    gunmetalArmor,
    forgedBlade,
    chainmail,
    quiltedLeather,
    darkCoat,
    windowGlow,
    stainedGlass,
    lanternGlow,
    emberGlow,
    carpetRoyal,
    bannerBlue,
    foliageOakMat,
    foliagePineMat,
    foliageCypressMat,
    foliageBirchMat,
    shrubLeafMat,
    shrubFlowerMat,
    trunkMat,
    wickerMat,
    appleRedMat,
    appleGreenMat,
    orangeMat,
    grapeMat,
    watermelonMat,
    pumpkinMat,
    pearMat,
    aoSkirt,
    contactShadow,
    cursorRing,
    haloGlowTex,
    grassPbrMap: grassPbr.map,
    grassPbrNormal: grassPbr.normal,
    cliffPbrMap: cliffPbr.map,
    cliffPbrNormal: cliffPbr.normal,
    trailPbrMap: fieldTrailPbr.map,
    trailPbrNormal: fieldTrailPbr.normal,
    createAwningMaterial,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
