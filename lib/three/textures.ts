import * as THREE from 'three';

export interface ProceduralTexturePack {
  terrainAlbedo: THREE.CanvasTexture;
  terrainBump: THREE.CanvasTexture;
  stoneAlbedo: THREE.CanvasTexture;
  stoneBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  runeRing: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTexturePack(maxAnisotropy: number): ProceduralTexturePack {
  // 1. Valley Grass + Moss + Stone Albedo & Bump
  const tCanvas = document.createElement('canvas');
  tCanvas.width = 512;
  tCanvas.height = 512;
  const tCtx = tCanvas.getContext('2d')!;
  tCtx.fillStyle = '#3c563a';
  tCtx.fillRect(0, 0, 512, 512);

  const bCanvas = document.createElement('canvas');
  bCanvas.width = 512;
  bCanvas.height = 512;
  const bCtx = bCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  // Deterministic pseudo-random stipples for organic turf & mineral grain
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 4200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 2 + rand() * 8;
    const shade = rand();
    tCtx.fillStyle =
      shade > 0.65
        ? 'rgba(84, 114, 72, 0.25)'
        : shade > 0.3
          ? 'rgba(46, 70, 44, 0.25)'
          : 'rgba(116, 108, 82, 0.16)';
    tCtx.beginPath();
    tCtx.arc(x, y, r, 0, Math.PI * 2);
    tCtx.fill();

    const g = Math.floor(105 + rand() * 50);
    bCtx.fillStyle = `rgba(${g},${g},${g},0.35)`;
    bCtx.beginPath();
    bCtx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    bCtx.fill();
  }

  const terrainAlbedo = new THREE.CanvasTexture(tCanvas);
  terrainAlbedo.colorSpace = THREE.SRGBColorSpace;
  terrainAlbedo.wrapS = THREE.RepeatWrapping;
  terrainAlbedo.wrapT = THREE.RepeatWrapping;
  terrainAlbedo.repeat.set(16, 16);
  terrainAlbedo.anisotropy = maxAnisotropy;

  const terrainBump = new THREE.CanvasTexture(bCanvas);
  terrainBump.wrapS = THREE.RepeatWrapping;
  terrainBump.wrapT = THREE.RepeatWrapping;
  terrainBump.repeat.set(16, 16);
  terrainBump.anisotropy = maxAnisotropy;

  // 2. Sanctuary Carved Flagstone Albedo & Bump
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 512;
  sCanvas.height = 512;
  const sCtx = sCanvas.getContext('2d')!;
  sCtx.fillStyle = '#8b8374';
  sCtx.fillRect(0, 0, 512, 512);

  const sbCanvas = document.createElement('canvas');
  sbCanvas.width = 512;
  sbCanvas.height = 512;
  const sbCtx = sbCanvas.getContext('2d')!;
  sbCtx.fillStyle = '#999999';
  sbCtx.fillRect(0, 0, 512, 512);

  const rows = 8;
  const cell = 512 / rows;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2) * (cell * 0.5);
    for (let col = -1; col <= rows; col++) {
      const bx = col * cell + offset;
      const by = row * cell;
      const tone = 126 + Math.floor(rand() * 28);
      sCtx.fillStyle = `rgb(${tone + 6}, ${tone}, ${tone - 10})`;
      sCtx.fillRect(bx + 3, by + 3, cell - 6, cell - 6);
      sCtx.strokeStyle = 'rgba(42, 38, 32, 0.55)';
      sCtx.lineWidth = 3;
      sCtx.strokeRect(bx + 1.5, by + 1.5, cell - 3, cell - 3);

      const bt = 140 + Math.floor(rand() * 30);
      sbCtx.fillStyle = `rgb(${bt}, ${bt}, ${bt})`;
      sbCtx.fillRect(bx + 4, by + 4, cell - 8, cell - 8);
      sbCtx.strokeStyle = '#303030';
      sbCtx.lineWidth = 4;
      sbCtx.strokeRect(bx + 1.5, by + 1.5, cell - 3, cell - 3);
    }
  }

  const stoneAlbedo = new THREE.CanvasTexture(sCanvas);
  stoneAlbedo.colorSpace = THREE.SRGBColorSpace;
  stoneAlbedo.wrapS = THREE.RepeatWrapping;
  stoneAlbedo.wrapT = THREE.RepeatWrapping;
  stoneAlbedo.repeat.set(4, 4);
  stoneAlbedo.anisotropy = maxAnisotropy;

  const stoneBump = new THREE.CanvasTexture(sbCanvas);
  stoneBump.wrapS = THREE.RepeatWrapping;
  stoneBump.wrapT = THREE.RepeatWrapping;
  stoneBump.repeat.set(4, 4);
  stoneBump.anisotropy = maxAnisotropy;

  // 3. Soft Radial Contact Shadow Disc
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 128;
  cCanvas.height = 128;
  const cCtx = cCanvas.getContext('2d')!;
  const grad = cCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(8, 10, 16, 0.78)');
  grad.addColorStop(0.55, 'rgba(8, 10, 16, 0.35)');
  grad.addColorStop(1, 'rgba(8, 10, 16, 0)');
  cCtx.fillStyle = grad;
  cCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(cCanvas);

  // 4. Diegetic Arcane Ground Rune Ring
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 256;
  rCanvas.height = 256;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.clearRect(0, 0, 256, 256);
  rCtx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  rCtx.lineWidth = 6;
  rCtx.beginPath();
  rCtx.arc(128, 128, 112, 0, Math.PI * 2);
  rCtx.stroke();

  rCtx.lineWidth = 2.5;
  rCtx.setLineDash([14, 10]);
  rCtx.beginPath();
  rCtx.arc(128, 128, 92, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.setLineDash([]);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rCtx.beginPath();
    rCtx.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    rCtx.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116);
    rCtx.stroke();
  }

  const runeRing = new THREE.CanvasTexture(rCanvas);
  runeRing.colorSpace = THREE.SRGBColorSpace;
  runeRing.anisotropy = maxAnisotropy;

  return {
    terrainAlbedo,
    terrainBump,
    stoneAlbedo,
    stoneBump,
    contactShadow,
    runeRing,
    dispose: () => {
      terrainAlbedo.dispose();
      terrainBump.dispose();
      stoneAlbedo.dispose();
      stoneBump.dispose();
      contactShadow.dispose();
      runeRing.dispose();
    },
  };
}
