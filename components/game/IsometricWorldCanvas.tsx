'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import type {
  GameLifecycleState,
  HeroClass,
  ShrineState,
  SnapshotEnemy,
  SnapshotPlayer,
  WorldEffectEvent,
  WorldSnapshot,
} from '@/lib/game/types';
import {
  CLASS_SPECS,
  WORLD_OBSTACLES,
  WORLD_TERRAIN_SIZE,
  groundHeightAt,
} from '@/lib/game/worldData';
import { createProceduralTexturePack } from '@/lib/three/textures';
import {
  buildEnemyRig,
  buildHeroRig,
  buildShrineObeliskGroup,
  type AnimatedActorRig,
} from '@/lib/three/models';
import { gameAudio } from '@/lib/three/audio';

export interface HudBridgeState {
  localPlayer: SnapshotPlayer | null;
  targetEnemy: SnapshotEnemy | null;
  shrines: ShrineState[];
  allPlayers: SnapshotPlayer[];
  allEnemies: SnapshotEnemy[];
  onlineCount: number;
  dbMode: string;
  zoneName: string;
}

export interface WorldControlApi {
  setJoystickVector: (x: number, y: number) => void;
  triggerSkill: (index: 0 | 1 | 2) => void;
  triggerDash: () => void;
  rotateCamera: (deltaYaw: number) => void;
}

interface IsometricWorldCanvasProps {
  gameState: GameLifecycleState;
  localPlayerId: string;
  snapshotRef: React.MutableRefObject<WorldSnapshot | null>;
  onSendInput: (moveX: number, moveZ: number, waypointX: number | null, waypointZ: number | null) => void;
  onCastSkill: (skillIndex: 0 | 1 | 2, aimX: number, aimZ: number, targetEnemyId?: string | null) => void;
  onDash: (dirX: number, dirZ: number) => void;
  onSelectTarget: (enemyId: string | null) => void;
  onHudSync: (hud: HudBridgeState) => void;
  controlApiRef: React.MutableRefObject<WorldControlApi | null>;
}

interface FloatingLabelItem {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  ttl: number;
  maxTtl: number;
}

interface ParticleItem {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ttl: number;
  maxTtl: number;
  scale: number;
  color: THREE.Color;
}

interface PlateSlot {
  el: HTMLDivElement;
  nameEl: HTMLSpanElement;
  fillEl: HTMLDivElement;
}

// Pre-allocated scratch math helpers (zero GC inside rAF)
const _v3 = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _raycaster = new THREE.Raycaster();
const _mouseNdc = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function getZoneLabel(x: number, z: number): string {
  if (Math.hypot(x, z - 14) < 13) return 'Solis Sanctuary';
  if (z < -30) return 'Obsidian Citadel';
  if (x < -14) return 'Dawn Spire Glade';
  if (x > 14) return 'Verdant Crossing';
  return 'Sunstone Valley';
}

export default function IsometricWorldCanvas({
  gameState,
  localPlayerId,
  snapshotRef,
  onSendInput,
  onCastSkill,
  onDash,
  onSelectTarget,
  onHudSync,
  controlApiRef,
}: IsometricWorldCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const platesLayerRef = useRef<HTMLDivElement | null>(null);

  const gameStateRef = useRef(gameState);
  const localPlayerIdRef = useRef(localPlayerId);
  const callbacksRef = useRef({
    onSendInput,
    onCastSkill,
    onDash,
    onSelectTarget,
    onHudSync,
  });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    localPlayerIdRef.current = localPlayerId;
  }, [localPlayerId]);

  useEffect(() => {
    callbacksRef.current = {
      onSendInput,
      onCastSkill,
      onDash,
      onSelectTarget,
      onHudSync,
    };
  }, [onSendInput, onCastSkill, onDash, onSelectTarget, onHudSync]);

  useEffect(() => {
    const container = mountRef.current;
    const platesLayer = platesLayerRef.current;
    if (!container || !platesLayer) return;

    // Detect Software WebGL (SwiftShader/llvmpipe) from GPU renderer string
    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizonColor = 0x99bdd4;
    scene.background = new THREE.Color(horizonColor);
    scene.fog = new THREE.FogExp2(horizonColor, 0.0085);

    // Procedural Studio IBL Environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Procedural Daytime Sky
    const sky = new Sky();
    sky.scale.setScalar(600);
    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 5.5;
    skyUniforms['rayleigh'].value = 1.65;
    skyUniforms['mieCoefficient'].value = 0.004;
    skyUniforms['mieDirectionalG'].value = 0.82;
    const sunPos = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(138));
    skyUniforms['sunPosition'].value.copy(sunPos);
    scene.add(sky);

    // Warm/Cool 3-Point Rig
    const hemiLight = new THREE.HemisphereLight(0xa7d1f7, 0x35432e, 0.72);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    sunLight.position.set(32, 46, 24);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -45;
    sunLight.shadow.camera.right = 45;
    sunLight.shadow.camera.top = 45;
    sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x7cc4ff, 0.55);
    rimLight.position.set(-28, 18, -32);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.5,
      360,
    );

    const textures = createProceduralTexturePack(renderer.capabilities.getMaxAnisotropy());

    // Build Sculpted Valley Terrain
    const terrainGeo = new THREE.PlaneGeometry(WORLD_TERRAIN_SIZE, WORLD_TERRAIN_SIZE, 96, 96);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);
    const colGrass = new THREE.Color(0x6b8f5e);
    const colPath = new THREE.Color(0xb6a47e);
    const colRock = new THREE.Color(0x6e6a63);
    const colBed = new THREE.Color(0x465b55);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = groundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const riverCenterZ = -4.5 + Math.sin(vx * 0.08) * 3.2;
      const distRiver = Math.abs(vz - riverCenterZ);
      const distTrail = Math.abs(vx);

      tmpCol.copy(colGrass);
      if (distTrail < 3.4 && vz > -50 && vz < 24) {
        tmpCol.lerp(colPath, 0.72);
      }
      if (distRiver < 4.0 && Math.abs(vx) > 3.6) {
        tmpCol.lerp(colBed, Math.max(0, 1 - distRiver / 4.0));
      }
      if (vy > 1.2) {
        tmpCol.lerp(colRock, Math.min(1, (vy - 1.2) * 0.48));
      }
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.terrainAlbedo,
      bumpMap: textures.terrainBump,
      bumpScale: 0.08,
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.04,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);

    // River Water Plane (custom GLSL wave extension on MeshStandardMaterial)
    const riverGeo = new THREE.PlaneGeometry(WORLD_TERRAIN_SIZE, 10.5, 48, 8);
    riverGeo.rotateX(-Math.PI / 2);
    const rPos = riverGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const rx = rPos.getX(i);
      const rz = rPos.getZ(i);
      rPos.setZ(i, rz - 4.5 + Math.sin(rx * 0.08) * 3.2);
    }
    riverGeo.computeVertexNormals();
    const riverUniforms = { uTime: { value: 0 } };
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x1b627c,
      roughness: 0.2,
      metalness: 0.24,
      envMapIntensity: 0.55,
      transparent: true,
      opacity: 0.9,
    });
    riverMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = riverUniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.y += sin(transformed.x * 0.45 + uTime * 2.2) * 0.04;',
        );
    };
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.position.y = -0.32;
    scene.add(riverMesh);

    // Stone Bridge across the river at x=0, z=-4.5
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.stoneAlbedo,
      bumpMap: textures.stoneBump,
      bumpScale: 0.05,
      roughness: 0.82,
      metalness: 0.08,
    });
    const trimGoldMat = new THREE.MeshStandardMaterial({
      color: 0xd49c42,
      roughness: 0.3,
      metalness: 0.78,
    });
    const bridgeDeck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.52, 11.2), stoneMat);
    bridgeDeck.position.set(0, 0.16, -4.5);
    bridgeDeck.receiveShadow = true;
    bridgeDeck.castShadow = true;
    scene.add(bridgeDeck);
    for (const side of [-3.25, 3.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 11.2), stoneMat);
      rail.position.set(side, 0.62, -4.5);
      scene.add(rail);
    }

    // Sanctuary Flagstone Plaza (0, 14) + Tall Central Beacon Monument
    const plazaY = groundHeightAt(0, 14);
    const plazaMesh = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.2, 0.24, 32), stoneMat);
    plazaMesh.position.set(0, plazaY + 0.05, 14);
    plazaMesh.receiveShadow = true;
    scene.add(plazaMesh);

    // Tall Beacon Monument at North edge of Sanctuary (0, 22) for immediate spawn vista silhouette
    const monumentGroup = new THREE.Group();
    monumentGroup.position.set(0, groundHeightAt(0, 21.5), 21.5);
    const monBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.5, 0.9, 8), stoneMat);
    monBase.position.y = 0.45;
    const monArchLeft = new THREE.Mesh(new THREE.BoxGeometry(0.85, 6.2, 0.95), stoneMat);
    monArchLeft.position.set(-1.65, 3.3, 0);
    const monArchRight = new THREE.Mesh(new THREE.BoxGeometry(0.85, 6.2, 0.95), stoneMat);
    monArchRight.position.set(1.65, 3.3, 0);
    const monCrown = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.85, 1.1), trimGoldMat);
    monCrown.position.y = 6.5;
    const monCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.16,
      metalness: 0.45,
    });
    const monCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85), monCrystalMat);
    monCrystal.position.y = 4.6;
    monumentGroup.add(monBase, monArchLeft, monArchRight, monCrown, monCrystal);
    scene.add(monumentGroup);

    // Sanctuary Boundary Safe Ring
    const safeRing = new THREE.Mesh(
      new THREE.PlaneGeometry(23, 23),
      new THREE.MeshBasicMaterial({
        map: textures.runeRing,
        color: 0xe5a93c,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.set(0, plazaY + 0.19, 14);
    scene.add(safeRing);

    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    // World Pillars & Boulders from WORLD_OBSTACLES
    for (const obs of WORLD_OBSTACLES) {
      if (obs.kind === 'obelisk') continue; // Built as Shrine Obelisks below
      const y = groundHeightAt(obs.x, obs.z);
      if (obs.kind === 'pillar') {
        const g = new THREE.Group();
        g.position.set(obs.x, y, obs.z);
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), stoneMat);
        plinth.position.y = 0.25;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, obs.height - 0.8, 10), stoneMat);
        shaft.position.y = (obs.height - 0.8) / 2 + 0.5;
        shaft.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), trimGoldMat);
        cap.position.y = obs.height - 0.15;
        const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), lanternMat);
        lantern.position.y = obs.height + 0.38;
        g.add(plinth, shaft, cap, lantern);
        scene.add(g);
      } else {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(obs.radius, 1),
          new THREE.MeshStandardMaterial({ color: 0x5b5851, roughness: 0.9, metalness: 0.05 }),
        );
        rock.position.set(obs.x, y + obs.radius * 0.42, obs.z);
        rock.scale.set(1.1, 0.78, 0.96);
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
      }
    }

    // Instanced Multi-Tier Pine Groves & Outer Perimeter Cliffs
    const treeCount = 72;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 6);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4f3928, roughness: 0.92, envMapIntensity: 0.25 });
    const canopyGeo = new THREE.ConeGeometry(1.45, 3.0, 7);
    canopyGeo.translate(0, 3.0, 0);
    const upperCanopyGeo = new THREE.ConeGeometry(1.02, 2.4, 7);
    upperCanopyGeo.translate(0, 4.4, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x2f5f35,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.22,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    const upperCanopies = new THREE.InstancedMesh(upperCanopyGeo, canopyMat, treeCount);
    canopies.castShadow = true;
    upperCanopies.castShadow = true;

    let tSeed = 42;
    const trand = () => {
      tSeed = (tSeed * 16807) % 2147483647;
      return (tSeed - 1) / 2147483646;
    };
    const treeBaseColor = new THREE.Color();

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + trand() * 0.2;
      const dist = i < 42 ? 52 + trand() * 20 : 24 + trand() * 26;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;
      const safeTx = Math.abs(tx) < 6 ? (tx < 0 ? -9 : 9) : tx;
      const ty = groundHeightAt(safeTx, tz);
      const s = 0.85 + trand() * 0.32;
      _v3.set(safeTx, ty, tz);
      _quat.setFromEuler(new THREE.Euler(0, trand() * Math.PI * 2, 0));
      _scale.set(s, s * (0.9 + trand() * 0.25), s);
      _mat4.compose(_v3, _quat, _scale);
      trunks.setMatrixAt(i, _mat4);
      canopies.setMatrixAt(i, _mat4);
      upperCanopies.setMatrixAt(i, _mat4);
      treeBaseColor.setHSL(0.33 + (trand() - 0.5) * 0.04, 0.22, 0.85 + trand() * 0.25);
      canopies.setColorAt(i, treeBaseColor);
      upperCanopies.setColorAt(i, treeBaseColor);
    }
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    upperCanopies.computeBoundingSphere();
    scene.add(trunks, canopies, upperCanopies);

    // Outer Ridge Boulders
    const cliffCount = 44;
    const cliffGeo = new THREE.DodecahedronGeometry(3.2, 1);
    const cliffMat = new THREE.MeshStandardMaterial({ color: 0x5c5852, roughness: 0.92 });
    const cliffs = new THREE.InstancedMesh(cliffGeo, cliffMat, cliffCount);
    for (let i = 0; i < cliffCount; i++) {
      const a = (i / cliffCount) * Math.PI * 2;
      const r = 68 + trand() * 8;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const cy = groundHeightAt(cx, cz) + 0.8;
      _v3.set(cx, cy, cz);
      _quat.setFromEuler(new THREE.Euler(trand() * 0.4, a, trand() * 0.4));
      _scale.set(1.2 + trand() * 0.7, 0.9 + trand() * 0.9, 1.2 + trand() * 0.7);
      _mat4.compose(_v3, _quat, _scale);
      cliffs.setMatrixAt(i, _mat4);
    }
    cliffs.computeBoundingSphere();
    scene.add(cliffs);

    // Shrine Obelisks
    const shrineVisuals = new Map<
      string,
      { group: THREE.Group; crystal: THREE.Mesh; ringMesh: THREE.Mesh; crystalMat: THREE.MeshStandardMaterial }
    >();
    const ensureShrineVisual = (s: ShrineState) => {
      let vis = shrineVisuals.get(s.id);
      if (!vis) {
        vis = buildShrineObeliskGroup(textures.runeRing, textures.stoneAlbedo, textures.stoneBump, s.radius);
        vis.group.position.set(s.x, groundHeightAt(s.x, s.z), s.z);
        scene.add(vis.group);
        shrineVisuals.set(s.id, vis);
      }
      const hex =
        s.controllingFaction === 'solis'
          ? 0x34d399
          : s.controllingFaction === 'rift'
            ? 0xf43f5e
            : 0xfbbf24;
      vis.crystalMat.color.setHex(hex);
      vis.crystalMat.emissive.setHex(hex);
      (vis.ringMesh.material as THREE.MeshBasicMaterial).color.setHex(hex);
    };

    // Click-to-Move Ground Waypoint Ring
    const waypointMat = new THREE.MeshBasicMaterial({
      map: textures.runeRing,
      color: 0xfde047,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const waypointMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 1.75), waypointMat);
    waypointMesh.rotation.x = -Math.PI / 2;
    waypointMesh.visible = false;
    scene.add(waypointMesh);

    // Enemy Target Selection Ring
    const targetRingMat = new THREE.MeshBasicMaterial({
      map: textures.runeRing,
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const targetRingMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), targetRingMat);
    targetRingMesh.rotation.x = -Math.PI / 2;
    targetRingMesh.visible = false;
    scene.add(targetRingMesh);

    // Pooled Enemy Attack Telegraph Rings (max 6 concurrent)
    const telegraphPool: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 32),
        new THREE.MeshBasicMaterial({
          color: 0xf43f5e,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      telegraphPool.push(m);
    }

    // Pooled Visual Slash / Nova Rings
    const activePulseRings: { mesh: THREE.Mesh; ttl: number; maxTtl: number; maxScale: number }[] = [];
    const spawnGroundPulse = (x: number, y: number, z: number, radius: number, colorHex: string) => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.95, 28),
        new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + 0.08, z);
      scene.add(mesh);
      activePulseRings.push({ mesh, ttl: 0.36, maxTtl: 0.36, maxScale: radius });
    };

    // Zero-GC Pooled Particle Ring Buffer (InstancedMesh)
    const PARTICLE_POOL_SIZE = 140;
    const particleGeo = new THREE.OctahedronGeometry(0.16, 0);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleMesh = new THREE.InstancedMesh(particleGeo, particleMat, PARTICLE_POOL_SIZE);
    particleMesh.frustumCulled = false;
    particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(particleMesh);

    const particles: ParticleItem[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      x: 0,
      y: -50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ttl: 0,
      maxTtl: 0.4,
      scale: 0,
      color: new THREE.Color(0xffffff),
    }));
    let particleCursor = 0;

    const spawnParticles = (
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: string,
      speed = 5,
    ) => {
      for (let i = 0; i < count; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
        const a = Math.random() * Math.PI * 2;
        const up = 2.2 + Math.random() * speed;
        const horiz = (0.4 + Math.random() * 0.8) * speed;
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = Math.cos(a) * horiz;
        p.vy = up;
        p.vz = Math.sin(a) * horiz;
        p.maxTtl = 0.28 + Math.random() * 0.28;
        p.ttl = p.maxTtl;
        p.scale = 0.7 + Math.random() * 0.8;
        p.color.set(colorHex);
        particleMesh.setColorAt(particleCursor === 0 ? PARTICLE_POOL_SIZE - 1 : particleCursor - 1, p.color);
      }
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    };

    // Entity Maps (Players, Enemies, Projectiles, Loot)
    const playerRigs = new Map<
      string,
      { rig: AnimatedActorRig; heroClass: HeroClass; sx: number; sz: number; walkPhase: number }
    >();
    const enemyRigs = new Map<
      string,
      { rig: AnimatedActorRig; sx: number; sz: number; walkPhase: number; hitProxy: THREE.Mesh }
    >();
    const enemyClickProxies: THREE.Mesh[] = [];
    const projMeshes = new Map<string, THREE.Mesh>();
    const lootMeshes = new Map<string, THREE.Group>();

    const sharedProjGeo = new THREE.OctahedronGeometry(0.32, 0);
    const sharedLootGeo = new THREE.OctahedronGeometry(0.42, 0);

    // Floating Damage / Label Pool (DOM)
    const floatingLabels: FloatingLabelItem[] = [];
    const spawnFloatingText = (x: number, y: number, z: number, text: string, color: string) => {
      const el = document.createElement('div');
      el.className =
        'absolute left-0 top-0 pointer-events-none font-mono-num font-bold text-sm hud-text-stroke whitespace-nowrap will-change-transform';
      el.style.color = color;
      el.textContent = text;
      platesLayer.appendChild(el);
      floatingLabels.push({ el, x, y, z, ttl: 0.95, maxTtl: 0.95 });
    };

    // Pooled Actor Health Plates (DOM)
    const platePool: PlateSlot[] = [];
    const acquirePlate = (idx: number): PlateSlot => {
      if (platePool[idx]) return platePool[idx];
      const el = document.createElement('div');
      el.className =
        'absolute left-0 top-0 pointer-events-none flex flex-col items-center gap-0.5 will-change-transform';
      const nameEl = document.createElement('span');
      nameEl.className =
        'text-[11px] font-semibold tracking-tight text-[#f8f5ee] hud-text-stroke whitespace-nowrap';
      const track = document.createElement('div');
      track.className = 'w-14 h-1.5 rounded-full bg-[#0c1018]/85 border border-white/20 overflow-hidden';
      const fillEl = document.createElement('div');
      fillEl.className = 'h-full transition-none';
      track.appendChild(fillEl);
      el.appendChild(nameEl);
      el.appendChild(track);
      platesLayer.appendChild(el);
      const slot = { el, nameEl, fillEl };
      platePool[idx] = slot;
      return slot;
    };

    // Input & Camera State
    const keysPressed = new Set<string>();
    const joyVec = { x: 0, y: 0 };
    let cameraYaw = Math.PI * 0.25; // Isometric 45 deg
    let targetCameraYaw = Math.PI * 0.25;
    let cameraDist = 22;
    let targetCameraDist = 22;
    const camTarget = new THREE.Vector3(0, 1, 14);
    let trauma = 0;
    let hitstopTimer = 0;
    const seenEventIds = new Set<string>();
    let prevLocalLevel = 1;
    let lastSendTime = 0;
    let lastMoveSignX = 0;
    let lastMoveSignZ = 0;
    let lastHudSyncTime = 0;

    const getLocalPlayer = (): SnapshotPlayer | null => {
      const snap = snapshotRef.current;
      if (!snap) return null;
      return snap.players.find((p) => p.id === localPlayerIdRef.current) ?? null;
    };

    const castSkillAtAim = (skillIdx: 0 | 1 | 2) => {
      const lp = getLocalPlayer();
      if (!lp || !lp.alive || gameStateRef.current !== 'playing') return;
      const snap = snapshotRef.current;
      const targetEnemy = snap?.enemies.find((e) => e.id === lp.targetEnemyId && e.phase !== 'ko');
      let aimX = lp.x + Math.sin(lp.facing) * 6;
      let aimZ = lp.z + Math.cos(lp.facing) * 6;

      if (targetEnemy) {
        aimX = targetEnemy.x;
        aimZ = targetEnemy.z;
      } else if (snap) {
        // Auto-assist nearest enemy within skill range
        const range = CLASS_SPECS[lp.heroClass].skills[skillIdx].range + 2;
        let bestD = range;
        for (const e of snap.enemies) {
          if (e.phase === 'ko') continue;
          const d = Math.hypot(e.x - lp.x, e.z - lp.z);
          if (d < bestD) {
            bestD = d;
            aimX = e.x;
            aimZ = e.z;
          }
        }
      }

      if (skillIdx === 0) {
        lp.heroClass === 'vanguard' ? gameAudio.playSlash() : gameAudio.playBolt();
      } else {
        gameAudio.playNova();
      }
      callbacksRef.current.onCastSkill(skillIdx, aimX, aimZ, targetEnemy?.id ?? lp.targetEnemyId);
    };

    const triggerLocalDash = () => {
      const lp = getLocalPlayer();
      if (!lp || !lp.alive || gameStateRef.current !== 'playing') return;
      const move = computeCameraRelativeMove();
      const dx = Math.abs(move.x) > 0.05 || Math.abs(move.z) > 0.05 ? move.x : Math.sin(lp.facing);
      const dz = Math.abs(move.x) > 0.05 || Math.abs(move.z) > 0.05 ? move.z : Math.cos(lp.facing);
      gameAudio.playDash();
      callbacksRef.current.onDash(dx, dz);
    };

    controlApiRef.current = {
      setJoystickVector: (x: number, y: number) => {
        joyVec.x = x;
        joyVec.y = y;
      },
      triggerSkill: (idx: 0 | 1 | 2) => castSkillAtAim(idx),
      triggerDash: () => triggerLocalDash(),
      rotateCamera: (deltaYaw: number) => {
        targetCameraYaw += deltaYaw;
      },
    };

    const computeCameraRelativeMove = () => {
      let sx = joyVec.x;
      let sy = joyVec.y;
      if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) sx -= 1;
      if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) sx += 1;
      if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) sy -= 1;
      if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) sy += 1;

      const len = Math.hypot(sx, sy);
      if (len < 0.05) return { x: 0, z: 0 };
      const nx = sx / Math.max(1, len);
      const ny = sy / Math.max(1, len);

      // Transform screen-space (right=nx, down=ny) into world XZ rotated by cameraYaw
      const forwardX = -Math.sin(cameraYaw);
      const forwardZ = -Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);

      return {
        x: Number((rightX * nx - forwardX * ny).toFixed(3)),
        z: Number((rightZ * nx - forwardZ * ny).toFixed(3)),
      };
    };

    // Keyboard Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      if (gameStateRef.current !== 'playing') return;

      keysPressed.add(e.code);
      if (!e.repeat) {
        if (e.code === 'Digit1' || e.code === 'KeyJ') castSkillAtAim(0);
        else if (e.code === 'Digit2' || e.code === 'KeyK') castSkillAtAim(1);
        else if (e.code === 'Digit3' || e.code === 'KeyL') castSkillAtAim(2);
        else if (e.code === 'Space') {
          e.preventDefault();
          triggerLocalDash();
        } else if (e.code === 'KeyQ') {
          targetCameraYaw -= Math.PI / 6;
        } else if (e.code === 'KeyE') {
          targetCameraYaw += Math.PI / 6;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const clearInputs = () => {
      keysPressed.clear();
      joyVec.x = 0;
      joyVec.y = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (gameStateRef.current !== 'playing') return;
      targetCameraDist = THREE.MathUtils.clamp(targetCameraDist + e.deltaY * 0.015, 13, 30);
    };

    // Pointer / Click-to-Move / Target Enemy
    let pointerDownPos: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      if (e.button === 2) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing' || !pointerDownPos) return;
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;
      if (moved > 14) return;

      const rect = renderer.domElement.getBoundingClientRect();
      _mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_mouseNdc, camera);

      // 1. Check Enemy Click Proxies
      const enemyHits = _raycaster.intersectObjects(enemyClickProxies, false);
      if (enemyHits.length > 0) {
        const enemyId = enemyHits[0].object.userData.enemyId as string;
        callbacksRef.current.onSelectTarget(enemyId);
        const snap = snapshotRef.current;
        const target = snap?.enemies.find((en) => en.id === enemyId);
        const lp = getLocalPlayer();
        if (target && lp) {
          const dist = Math.hypot(target.x - lp.x, target.z - lp.z);
          if (dist <= CLASS_SPECS[lp.heroClass].skills[0].range + 1.2) {
            callbacksRef.current.onCastSkill(0, target.x, target.z, enemyId);
            lp.heroClass === 'vanguard' ? gameAudio.playSlash() : gameAudio.playBolt();
          } else {
            callbacksRef.current.onSendInput(0, 0, target.x, target.z);
          }
        }
        return;
      }

      // 2. Ray-Plane / Terrain Ground Click-to-Move
      const terrainHits = _raycaster.intersectObject(terrainMesh, false);
      let wx: number | null = null;
      let wz: number | null = null;
      if (terrainHits.length > 0) {
        wx = terrainHits[0].point.x;
        wz = terrainHits[0].point.z;
      } else if (_raycaster.ray.intersectPlane(_groundPlane, _v3)) {
        wx = _v3.x;
        wz = _v3.z;
      }
      if (wx !== null && wz !== null) {
        callbacksRef.current.onSendInput(0, 0, Number(wx.toFixed(2)), Number(wz.toFixed(2)));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // ResizeObserver for crisp canvas sizing (re-render immediately so resize never flashes blank)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(1, entry.contentRect.width);
        const h = Math.max(1, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.render(scene, camera);
      }
    });
    resizeObserver.observe(container);

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Main Render & Interpolation Loop with Software-GL Fence Sync
    let frameId = 0;
    let disposed = false;
    let lastFrameMs = performance.now();
    let elapsedTotal = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const nowMs = performance.now();
      const rawDt = Math.min((nowMs - lastFrameMs) / 1000, 0.05);
      lastFrameMs = nowMs;
      elapsedTotal += rawDt;

      const state = gameStateRef.current;

      // Hitstop pauses gameplay visual motion briefly on heavy hits while camera shake & flashes decay
      if (hitstopTimer > 0) {
        hitstopTimer = Math.max(0, hitstopTimer - rawDt);
      }
      const animDt = hitstopTimer > 0 ? 0 : rawDt;

      riverUniforms.uTime.value = elapsedTotal;
      monCrystal.rotation.y += rawDt * 0.9;
      monCrystal.position.y = 4.5 + Math.sin(elapsedTotal * 1.8) * 0.22;

      // Send continuous WASD / Joystick movement intents to authoritative server
      if (state === 'playing') {
        const move = computeCameraRelativeMove();
        const isMoving = Math.abs(move.x) > 0.02 || Math.abs(move.z) > 0.02;
        const moveChanged =
          Math.abs(move.x - lastMoveSignX) > 0.05 || Math.abs(move.z - lastMoveSignZ) > 0.05;
        if (moveChanged || (isMoving && nowMs - lastSendTime > 85)) {
          lastMoveSignX = move.x;
          lastMoveSignZ = move.z;
          lastSendTime = nowMs;
          callbacksRef.current.onSendInput(move.x, move.z, null, null);
        }
      }

      const snap = snapshotRef.current;
      const rectW = container.clientWidth || window.innerWidth;
      const rectH = container.clientHeight || window.innerHeight;
      let plateIdx = 0;

      if (snap) {
        // Sync Shrines
        for (const s of snap.shrines) {
          ensureShrineVisual(s);
          const sv = shrineVisuals.get(s.id);
          if (sv) {
            sv.crystal.rotation.y += rawDt * 1.25;
            sv.crystal.position.y = 6.7 + Math.sin(elapsedTotal * 2.2 + s.x) * 0.25;
            sv.ringMesh.rotation.z -= rawDt * 0.25;
          }
        }

        // Sync Players
        const activePlayerIds = new Set<string>();
        for (const p of snap.players) {
          activePlayerIds.add(p.id);
          const isLocal = p.id === localPlayerIdRef.current;
          let entry = playerRigs.get(p.id);
          if (!entry || entry.heroClass !== p.heroClass) {
            if (entry) scene.remove(entry.rig.root);
            const rig = buildHeroRig(p.heroClass, isLocal, textures.contactShadow, textures.runeRing);
            scene.add(rig.root);
            entry = { rig, heroClass: p.heroClass, sx: p.x, sz: p.z, walkPhase: 0 };
            playerRigs.set(p.id, entry);
          }

          const prevX = entry.sx;
          const prevZ = entry.sz;
          entry.sx = THREE.MathUtils.damp(entry.sx, p.x, 16, animDt);
          entry.sz = THREE.MathUtils.damp(entry.sz, p.z, 16, animDt);
          const py = groundHeightAt(entry.sx, entry.sz);
          entry.rig.root.position.set(entry.sx, py, entry.sz);
          entry.rig.root.visible = p.alive;

          const stepDist = Math.hypot(entry.sx - prevX, entry.sz - prevZ);
          entry.walkPhase += stepDist * 3.1;
          const speedRatio = Math.min(1, stepDist / Math.max(0.001, animDt * 7));

          // Smooth facing rotation
          const angleDiff = Math.atan2(
            Math.sin(p.facing - entry.rig.bodyPivot.rotation.y),
            Math.cos(p.facing - entry.rig.bodyPivot.rotation.y),
          );
          entry.rig.bodyPivot.rotation.y += angleDiff * Math.min(1, animDt * 14);

          // Distance-synced stride & cast swing
          const legSwing = Math.sin(entry.walkPhase) * 0.65 * speedRatio;
          entry.rig.leftLeg.rotation.x = legSwing;
          entry.rig.rightLeg.rotation.x = -legSwing;
          entry.rig.leftArm.rotation.x = -legSwing * 0.7;
          if (p.castFlashTimer > 0) {
            entry.rig.rightArm.rotation.x = -Math.PI * 0.45 * (p.castFlashTimer / 0.24);
          } else {
            entry.rig.rightArm.rotation.x = legSwing * 0.7;
          }
          if (entry.rig.halo) {
            entry.rig.halo.rotation.z += rawDt * 1.4;
          }
          if (entry.rig.auraRing) {
            entry.rig.auraRing.rotation.z += rawDt * 0.4;
          }

          // Hurt flash
          for (const mat of entry.rig.materialsToFlash) {
            mat.emissive.setHex(p.hurtTimer > 0 ? 0xff4455 : 0x000000);
            mat.emissiveIntensity = p.hurtTimer > 0 ? 0.65 : 0;
          }

          if (isLocal) {
            if (p.level > prevLocalLevel) {
              prevLocalLevel = p.level;
              gameAudio.playLevelUp();
              spawnParticles(entry.sx, py + 1.2, entry.sz, 24, '#fde047', 7);
            }
            if (p.waypointX !== null && p.waypointZ !== null && p.alive) {
              waypointMesh.visible = true;
              waypointMesh.position.set(p.waypointX, groundHeightAt(p.waypointX, p.waypointZ) + 0.05, p.waypointZ);
              waypointMesh.rotation.z += rawDt * 2.4;
              const pulse = 0.9 + Math.sin(elapsedTotal * 7) * 0.12;
              waypointMesh.scale.set(pulse, pulse, 1);
            } else {
              waypointMesh.visible = false;
            }
          }

          // World-space nameplate for remote players (or local player low HP)
          if (p.alive && (!isLocal || p.hp < p.maxHp)) {
            _proj.set(entry.sx, py + 2.35, entry.sz).project(camera);
            if (_proj.z >= -1 && _proj.z <= 1) {
              const slot = acquirePlate(plateIdx++);
              slot.el.style.display = 'flex';
              const px = (_proj.x * 0.5 + 0.5) * rectW;
              const pyScr = (-_proj.y * 0.5 + 0.5) * rectH;
              slot.el.style.transform = `translate3d(${px}px, ${pyScr}px, 0) translate(-50%, -100%)`;
              slot.nameEl.textContent = `${p.name} · Lv${p.level}`;
              slot.fillEl.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
              slot.fillEl.style.backgroundColor = isLocal ? '#34d399' : '#38bdf8';
            }
          }
        }
        for (const [pid, entry] of playerRigs) {
          if (!activePlayerIds.has(pid)) {
            scene.remove(entry.rig.root);
            playerRigs.delete(pid);
          }
        }

        // Sync Enemies & Diegetic Windup Telegraphs
        const localPlayer = getLocalPlayer();
        let targetVisible = false;
        let telegraphUsed = 0;

        for (const e of snap.enemies) {
          let entry = enemyRigs.get(e.id);
          if (!entry) {
            const rig = buildEnemyRig(e.archetype, textures.contactShadow);
            const hitProxy = new THREE.Mesh(
              new THREE.SphereGeometry(e.isBoss ? 1.8 : 1.15, 8, 8),
              new THREE.MeshBasicMaterial({ visible: false }),
            );
            hitProxy.position.y = e.isBoss ? 1.6 : 1.0;
            hitProxy.userData.enemyId = e.id;
            rig.root.add(hitProxy);
            enemyClickProxies.push(hitProxy);
            scene.add(rig.root);
            entry = { rig, sx: e.x, sz: e.z, walkPhase: 0, hitProxy };
            enemyRigs.set(e.id, entry);
          }

          if (e.phase === 'ko') {
            entry.rig.root.visible = true;
            entry.rig.bodyPivot.rotation.x = THREE.MathUtils.damp(entry.rig.bodyPivot.rotation.x, Math.PI * 0.48, 12, rawDt);
            entry.rig.bodyPivot.scale.setScalar(0.85);
            continue;
          } else {
            entry.rig.bodyPivot.rotation.x = 0;
            entry.rig.bodyPivot.scale.setScalar(1);
          }

          entry.rig.root.visible = true;
          const prevX = entry.sx;
          const prevZ = entry.sz;
          entry.sx = THREE.MathUtils.damp(entry.sx, e.x, 14, animDt);
          entry.sz = THREE.MathUtils.damp(entry.sz, e.z, 14, animDt);
          const ey = groundHeightAt(entry.sx, entry.sz);
          entry.rig.root.position.set(entry.sx, ey, entry.sz);

          const stepDist = Math.hypot(entry.sx - prevX, entry.sz - prevZ);
          entry.walkPhase += stepDist * 3.0;
          const speedRatio = Math.min(1, stepDist / Math.max(0.001, animDt * 5));

          const adiff = Math.atan2(
            Math.sin(e.facing - entry.rig.bodyPivot.rotation.y),
            Math.cos(e.facing - entry.rig.bodyPivot.rotation.y),
          );
          entry.rig.bodyPivot.rotation.y += adiff * Math.min(1, animDt * 12);

          const swing = Math.sin(entry.walkPhase) * 0.55 * speedRatio;
          entry.rig.leftLeg.rotation.x = swing;
          entry.rig.rightLeg.rotation.x = -swing;
          entry.rig.leftArm.rotation.x = -swing * 0.6;
          entry.rig.rightArm.rotation.x = e.phase === 'windup' ? -0.95 : swing * 0.6;
          if (entry.rig.halo) {
            entry.rig.halo.rotation.y += rawDt * 1.8;
            entry.rig.halo.rotation.z += rawDt * 0.9;
          }

          for (const mat of entry.rig.materialsToFlash) {
            if (e.hurtFlash > 0) {
              mat.emissive.setHex(0xffffff);
              mat.emissiveIntensity = 0.75;
            } else if (e.phase === 'windup') {
              mat.emissive.setHex(0xf43f5e);
              mat.emissiveIntensity = 0.45;
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            }
          }

          if (localPlayer?.targetEnemyId === e.id) {
            targetVisible = true;
            targetRingMesh.visible = true;
            targetRingMesh.position.set(entry.sx, ey + 0.05, entry.sz);
            targetRingMesh.rotation.z -= rawDt * 2.0;
            const s = e.isBoss ? 1.5 : 1.0;
            targetRingMesh.scale.set(s, s, 1);
          }

          if (e.phase === 'windup' && telegraphUsed < telegraphPool.length) {
            const tm = telegraphPool[telegraphUsed++];
            tm.visible = true;
            tm.position.set(e.telegraphX, groundHeightAt(e.telegraphX, e.telegraphZ) + 0.07, e.telegraphZ);
            tm.scale.set(e.telegraphRadius, e.telegraphRadius, 1);
            (tm.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(elapsedTotal * 18) * 0.14;
          }

          // Project enemy HP plate when damaged, targeted, or boss nearby
          const distToCam = Math.hypot(entry.sx - camTarget.x, entry.sz - camTarget.z);
          if (
            state === 'playing' &&
            distToCam < 28 &&
            (e.hp < e.maxHp || e.isBoss || localPlayer?.targetEnemyId === e.id)
          ) {
            _proj.set(entry.sx, ey + (e.isBoss ? 3.5 : 2.2), entry.sz).project(camera);
            if (_proj.z >= -1 && _proj.z <= 1) {
              const slot = acquirePlate(plateIdx++);
              slot.el.style.display = 'flex';
              const px = (_proj.x * 0.5 + 0.5) * rectW;
              const pyScr = (-_proj.y * 0.5 + 0.5) * rectH;
              slot.el.style.transform = `translate3d(${px}px, ${pyScr}px, 0) translate(-50%, -100%)`;
              slot.nameEl.textContent = e.isBoss ? `★ ${e.name}` : `${e.name} · Lv${e.level}`;
              slot.fillEl.style.width = `${Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100))}%`;
              slot.fillEl.style.backgroundColor = e.isBoss ? '#f59e0b' : '#f43f5e';
            }
          }
        }
        if (!targetVisible) targetRingMesh.visible = false;
        for (let i = telegraphUsed; i < telegraphPool.length; i++) {
          telegraphPool[i].visible = false;
        }

        // Sync Projectiles
        const activeProjIds = new Set<string>();
        for (const pr of snap.projectiles) {
          activeProjIds.add(pr.id);
          let m = projMeshes.get(pr.id);
          if (!m) {
            m = new THREE.Mesh(
              sharedProjGeo,
              new THREE.MeshBasicMaterial({ color: pr.color }),
            );
            scene.add(m);
            projMeshes.set(pr.id, m);
          }
          m.position.set(pr.x, groundHeightAt(pr.x, pr.z) + 1.05, pr.z);
          m.rotation.y += rawDt * 8;
        }
        for (const [id, m] of projMeshes) {
          if (!activeProjIds.has(id)) {
            scene.remove(m);
            (m.material as THREE.Material).dispose();
            projMeshes.delete(id);
          }
        }

        // Sync Loot Drops
        const activeLootIds = new Set<string>();
        for (const drop of snap.loot) {
          activeLootIds.add(drop.id);
          let lg = lootMeshes.get(drop.id);
          if (!lg) {
            lg = new THREE.Group();
            const color = drop.kind === 'potion' ? 0x34d399 : drop.kind === 'relic' ? 0xc084fc : 0xfbbf24;
            const gem = new THREE.Mesh(
              sharedLootGeo,
              new THREE.MeshStandardMaterial({
                color,
                emissive: color,
                emissiveIntensity: 0.65,
                roughness: 0.2,
              }),
            );
            gem.position.y = 0.65;
            const ring = new THREE.Mesh(
              new THREE.PlaneGeometry(1.4, 1.4),
              new THREE.MeshBasicMaterial({
                map: textures.runeRing,
                color,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.05;
            lg.add(gem, ring);
            scene.add(lg);
            lootMeshes.set(drop.id, lg);
          }
          lg.position.set(drop.x, groundHeightAt(drop.x, drop.z), drop.z);
          lg.children[0].rotation.y += rawDt * 2.5;
          lg.children[0].position.y = 0.65 + Math.sin(elapsedTotal * 3.5 + drop.x) * 0.14;
        }
        for (const [id, lg] of lootMeshes) {
          if (!activeLootIds.has(id)) {
            scene.remove(lg);
            lootMeshes.delete(id);
          }
        }

        // Consume Combat / Loot / Level Events
        for (const ev of snap.events as WorldEffectEvent[]) {
          if (seenEventIds.has(ev.id)) continue;
          seenEventIds.add(ev.id);
          if (seenEventIds.size > 400) seenEventIds.clear();

          if (ev.kind === 'slash' || ev.kind === 'nova') {
            spawnGroundPulse(ev.x, ev.y, ev.z, ev.radius || 3.5, ev.color);
            spawnParticles(ev.x, ev.y + 0.4, ev.z, 12, ev.color, 6);
            if (ev.kind === 'nova') trauma = Math.min(1, trauma + 0.35);
          } else if (ev.kind === 'dash' || ev.kind === 'bolt_hit') {
            spawnParticles(ev.x, ev.y, ev.z, 8, ev.color, 4.5);
          } else if (ev.kind === 'damage' && ev.value !== undefined) {
            spawnFloatingText(ev.x, ev.y, ev.z, `-${ev.value}`, ev.color);
            spawnParticles(ev.x, ev.y - 0.5, ev.z, 6, ev.color, 4);
            if (ev.value >= 45) {
              hitstopTimer = 0.035;
              trauma = Math.min(1, trauma + 0.25);
              gameAudio.playHit();
            }
          } else if (ev.kind === 'heal' && ev.value !== undefined) {
            spawnFloatingText(ev.x, ev.y, ev.z, `+${ev.value} HP`, '#34d399');
          } else if (ev.kind === 'loot') {
            spawnFloatingText(ev.x, ev.y, ev.z, ev.label || 'Loot', ev.color);
            gameAudio.playLoot();
          } else if (ev.kind === 'shrine_capture' || ev.kind === 'level_up') {
            spawnFloatingText(ev.x, ev.y, ev.z, ev.label || 'Ascended!', ev.color);
            spawnParticles(ev.x, ev.y, ev.z, 20, ev.color, 7);
          }
        }

        // Throttled HUD & DOM Testability Sync (<= 10 Hz)
        if (nowMs - lastHudSyncTime > 100) {
          lastHudSyncTime = nowMs;
          const lp = localPlayer;
          if (lp) {
            document.body.dataset.playerX = String(lp.x.toFixed(2));
            document.body.dataset.playerZ = String(lp.z.toFixed(2));
            document.body.dataset.playerHp = String(lp.hp);
            document.body.dataset.playerLevel = String(lp.level);
          }
          document.body.dataset.onlineCount = String(snap.onlineCount);
          const targetEnemy = lp?.targetEnemyId
            ? snap.enemies.find((en) => en.id === lp.targetEnemyId && en.phase !== 'ko') ?? null
            : null;
          callbacksRef.current.onHudSync({
            localPlayer: lp,
            targetEnemy,
            shrines: snap.shrines,
            allPlayers: snap.players,
            allEnemies: snap.enemies,
            onlineCount: snap.onlineCount,
            dbMode: snap.dbMode,
            zoneName: lp ? getZoneLabel(lp.x, lp.z) : 'Solis Sanctuary',
          });
        }
      }

      // Hide unused pooled plates
      for (let i = plateIdx; i < platePool.length; i++) {
        platePool[i].el.style.display = 'none';
      }

      // Update Floating Damage Numbers
      for (let i = floatingLabels.length - 1; i >= 0; i--) {
        const fl = floatingLabels[i];
        fl.ttl -= rawDt;
        if (fl.ttl <= 0) {
          fl.el.remove();
          floatingLabels.splice(i, 1);
          continue;
        }
        const progress = 1 - fl.ttl / fl.maxTtl;
        _proj.set(fl.x, fl.y + progress * 1.45, fl.z).project(camera);
        if (_proj.z < -1 || _proj.z > 1) {
          fl.el.style.display = 'none';
        } else {
          fl.el.style.display = 'block';
          const px = (_proj.x * 0.5 + 0.5) * rectW;
          const pyScr = (-_proj.y * 0.5 + 0.5) * rectH;
          fl.el.style.opacity = String(Math.min(1, fl.ttl * 2.2));
          fl.el.style.transform = `translate3d(${px}px, ${pyScr}px, 0) translate(-50%, -50%)`;
        }
      }

      // Update Ground Pulse Rings
      for (let i = activePulseRings.length - 1; i >= 0; i--) {
        const r = activePulseRings[i];
        r.ttl -= rawDt;
        if (r.ttl <= 0) {
          scene.remove(r.mesh);
          r.mesh.geometry.dispose();
          (r.mesh.material as THREE.Material).dispose();
          activePulseRings.splice(i, 1);
          continue;
        }
        const p = 1 - r.ttl / r.maxTtl;
        const sc = THREE.MathUtils.lerp(0.3, r.maxScale, p);
        r.mesh.scale.set(sc, sc, 1);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.85;
      }

      // Update Pooled Particles (Zero-GC)
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) {
          _scale.set(0, 0, 0);
          _v3.set(0, -100, 0);
          _mat4.compose(_v3, _quat.identity(), _scale);
          particleMesh.setMatrixAt(i, _mat4);
          continue;
        }
        p.ttl -= rawDt;
        if (p.ttl <= 0) {
          p.active = false;
          continue;
        }
        p.vy -= 14 * rawDt;
        p.x += p.vx * rawDt;
        p.y += p.vy * rawDt;
        p.z += p.vz * rawDt;
        const s = p.scale * (p.ttl / p.maxTtl);
        _v3.set(p.x, p.y, p.z);
        _scale.set(s, s, s);
        _mat4.compose(_v3, _quat.identity(), _scale);
        particleMesh.setMatrixAt(i, _mat4);
      }
      particleMesh.instanceMatrix.needsUpdate = true;

      // Camera Choreography: Live World Flyover on Title -> Smooth Isometric Follow in Playing
      cameraYaw = THREE.MathUtils.damp(cameraYaw, targetCameraYaw, 9, rawDt);
      cameraDist = THREE.MathUtils.damp(cameraDist, targetCameraDist, 9, rawDt);
      trauma = Math.max(0, trauma - rawDt * 1.9);
      const shakeAmt = trauma * trauma * 0.55;

      if (state === 'title') {
        const flyAngle = elapsedTotal * 0.14;
        camTarget.set(Math.sin(flyAngle * 0.7) * 6, 2.2, 6 + Math.cos(flyAngle * 0.5) * 8);
        camera.position.set(
          camTarget.x + Math.sin(flyAngle) * 28,
          17.5 + Math.sin(elapsedTotal * 0.4) * 1.8,
          camTarget.z + Math.cos(flyAngle) * 28,
        );
        camera.lookAt(camTarget);
      } else {
        const lp = getLocalPlayer();
        const followX = lp ? lp.x : 0;
        const followZ = lp ? lp.z : 14;
        const followY = groundHeightAt(followX, followZ) + 1.1;

        camTarget.x = THREE.MathUtils.damp(camTarget.x, followX, 11, rawDt);
        camTarget.y = THREE.MathUtils.damp(camTarget.y, followY, 11, rawDt);
        camTarget.z = THREE.MathUtils.damp(camTarget.z, followZ, 11, rawDt);

        const horizDist = cameraDist * 0.76;
        const camHeight = cameraDist * 0.68;
        camera.position.set(
          camTarget.x + Math.sin(cameraYaw) * horizDist + (Math.random() - 0.5) * shakeAmt,
          camTarget.y + camHeight + (Math.random() - 0.5) * shakeAmt,
          camTarget.z + Math.cos(cameraYaw) * horizDist,
        );
        camera.lookAt(camTarget);

        // Keep sun shadow frustum centered near player
        sunLight.position.set(camTarget.x + 28, 46, camTarget.z + 20);
        sunLight.target.position.copy(camTarget);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      textures.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      riverGeo.dispose();
      riverMat.dispose();
      trunkGeo.dispose();
      trunkMat.dispose();
      canopyGeo.dispose();
      upperCanopyGeo.dispose();
      canopyMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      sharedProjGeo.dispose();
      sharedLootGeo.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      platesLayer.innerHTML = '';
    };
  }, [snapshotRef, controlApiRef]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0c1018]">
      <div ref={mountRef} className="w-full h-full cursor-crosshair" />
      <div
        ref={platesLayerRef}
        className="fixed inset-0 pointer-events-none overflow-hidden z-10"
        aria-hidden="true"
      />
    </div>
  );
}
