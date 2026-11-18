import * as THREE from 'three';
import type { EnemyArchetype, HeroClass } from '@/lib/game/types';

export interface AnimatedActorRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  halo?: THREE.Object3D;
  weaponPivot?: THREE.Object3D;
  auraRing?: THREE.Mesh;
  materialsToFlash: THREE.MeshStandardMaterial[];
}

function makeContactShadow(shadowTex: THREE.Texture, radius = 0.85): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 24);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

export function buildHeroRig(
  heroClass: HeroClass,
  isLocal: boolean,
  shadowTex: THREE.Texture,
  runeTex: THREE.Texture,
): AnimatedActorRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  root.add(makeContactShadow(shadowTex, 0.92));

  // Diegetic ground aura ring under hero feet
  const auraColor =
    heroClass === 'vanguard' ? 0xe5a93c : heroClass === 'arcanist' ? 0x38bdf8 : 0x34d399;
  const auraMat = new THREE.MeshBasicMaterial({
    map: runeTex,
    color: auraColor,
    transparent: true,
    opacity: isLocal ? 0.62 : 0.34,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const auraRing = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.15), auraMat);
  auraRing.rotation.x = -Math.PI / 2;
  auraRing.position.y = 0.03;
  root.add(auraRing);

  const materialsToFlash: THREE.MeshStandardMaterial[] = [];

  const primaryColor =
    heroClass === 'vanguard' ? 0xc27b2a : heroClass === 'arcanist' ? 0x225a94 : 0x266c4c;
  const armorMetal =
    heroClass === 'vanguard' ? 0x9fa8b7 : heroClass === 'arcanist' ? 0xd9c27e : 0x62503c;
  const trimColor = auraColor;

  const clothMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.78,
    metalness: 0.12,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: armorMetal,
    roughness: 0.28,
    metalness: 0.76,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: trimColor,
    emissive: trimColor,
    emissiveIntensity: 0.45,
    roughness: 0.22,
    metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.85,
    metalness: 0.15,
  });
  materialsToFlash.push(clothMat, plateMat);

  // Legs (bottom-center grounded at y = 0)
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.42, 4, 8);
  const bootGeo = new THREE.BoxGeometry(0.22, 0.16, 0.3);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.65, 0);
  const lLegMesh = new THREE.Mesh(legGeo, darkMat);
  lLegMesh.position.y = -0.24;
  const lBoot = new THREE.Mesh(bootGeo, plateMat);
  lBoot.position.set(0, -0.56, 0.04);
  leftLeg.add(lLegMesh, lBoot);
  bodyPivot.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.65, 0);
  const rLegMesh = new THREE.Mesh(legGeo, darkMat);
  rLegMesh.position.y = -0.24;
  const rBoot = new THREE.Mesh(bootGeo, plateMat);
  rBoot.position.set(0, -0.56, 0.04);
  rightLeg.add(rLegMesh, rBoot);
  bodyPivot.add(rightLeg);

  // Torso (Lathe/Extrude silhouette)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.68, 8), plateMat);
  torso.position.y = 0.98;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Flowing cloak / mantle
  const cloakShape = new THREE.Shape();
  cloakShape.moveTo(-0.26, 0);
  cloakShape.lineTo(0.26, 0);
  cloakShape.lineTo(0.38, -0.82);
  cloakShape.lineTo(0, -0.94);
  cloakShape.lineTo(-0.38, -0.82);
  cloakShape.closePath();
  const cloakGeo = new THREE.ExtrudeGeometry(cloakShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  const cloak = new THREE.Mesh(cloakGeo, clothMat);
  cloak.position.set(0, 1.24, -0.24);
  cloak.rotation.x = 0.16;
  cloak.castShadow = true;
  bodyPivot.add(cloak);

  // Pauldrons
  const pauldronGeo = new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const lPauldron = new THREE.Mesh(pauldronGeo, plateMat);
  lPauldron.position.set(-0.4, 1.26, 0);
  lPauldron.rotation.z = 0.4;
  const rPauldron = new THREE.Mesh(pauldronGeo, plateMat);
  rPauldron.position.set(0.4, 1.26, 0);
  rPauldron.rotation.z = -0.4;
  bodyPivot.add(lPauldron, rPauldron);

  // Head + Helm/Hood + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), plateMat);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.14), accentMat);
  visor.position.set(0, 0.02, 0.17);
  headGroup.add(head, visor);

  if (heroClass === 'vanguard') {
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.34), accentMat);
    crest.position.set(0, 0.22, -0.02);
    headGroup.add(crest);
  } else {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 8), clothMat);
    hood.position.set(0, 0.14, -0.05);
    hood.rotation.x = -0.25;
    headGroup.add(hood);
  }
  bodyPivot.add(headGroup);

  // Arms & Class Weapons
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.36, 4, 8);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.4, 1.2, 0);
  const lArmMesh = new THREE.Mesh(armGeo, clothMat);
  lArmMesh.position.y = -0.2;
  leftArm.add(lArmMesh);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 1.2, 0);
  const rArmMesh = new THREE.Mesh(armGeo, clothMat);
  rArmMesh.position.y = -0.2;
  rightArm.add(rArmMesh);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0, -0.38, 0.14);
  rightArm.add(weaponPivot);

  let halo: THREE.Object3D | undefined;

  if (heroClass === 'vanguard') {
    // Greatsword on right arm
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.15, 0.04), plateMat);
    blade.position.set(0, 0.48, 0.32);
    blade.rotation.x = Math.PI * 0.36;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.1), accentMat);
    guard.position.set(0, 0.1, 0.05);
    weaponPivot.add(blade, guard);

    // Kite shield on left arm
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 0.08, 6), plateMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.14, -0.2, 0.22);
    const shieldBoss = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), accentMat);
    shieldBoss.position.set(-0.14, -0.2, 0.28);
    leftArm.add(shield, shieldBoss);
  } else if (heroClass === 'arcanist') {
    // Astral Stave
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.55, 8), darkMat);
    shaft.position.set(0, 0.42, 0.22);
    shaft.rotation.x = 0.22;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), accentMat);
    orb.position.set(0, 1.22, 0.4);
    weaponPivot.add(shaft, orb);

    // Floating Halo Ring behind shoulders
    halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 24), accentMat);
    halo.position.set(0, 1.38, -0.32);
    bodyPivot.add(halo);
  } else {
    // Ranger Recurve Bow + Quiver
    const bowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.45, 0.15),
      new THREE.Vector3(0, -0.2, 0.36),
      new THREE.Vector3(0, 0.2, 0.36),
      new THREE.Vector3(0, 0.45, 0.15),
    ]);
    const bow = new THREE.Mesh(new THREE.TubeGeometry(bowCurve, 12, 0.035, 6, false), plateMat);
    bow.position.set(-0.1, -0.18, 0.15);
    leftArm.add(bow);

    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6), accentMat);
    arrow.rotation.x = Math.PI / 2;
    arrow.position.set(0, 0.05, 0.35);
    weaponPivot.add(arrow);

    const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.56, 8), darkMat);
    quiver.position.set(0.16, 1.12, -0.28);
    quiver.rotation.z = -0.35;
    bodyPivot.add(quiver);
  }

  bodyPivot.add(leftArm, rightArm);

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    halo,
    weaponPivot,
    auraRing,
    materialsToFlash,
  };
}

export function buildEnemyRig(
  archetype: EnemyArchetype,
  shadowTex: THREE.Texture,
): AnimatedActorRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const isBoss = archetype === 'warden';
  root.add(makeContactShadow(shadowTex, isBoss ? 1.55 : archetype === 'colossus' ? 1.25 : 0.85));

  const materialsToFlash: THREE.MeshStandardMaterial[] = [];
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  let halo: THREE.Object3D | undefined;

  if (archetype === 'stalker') {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x221c29, roughness: 0.75, metalness: 0.2 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    materialsToFlash.push(bodyMat);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 1.15), bodyMat);
    torso.position.set(0, 0.62, 0);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.56, 6), bodyMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.74, 0.68);
    const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.08, 0.1), glowMat);
    eyes.position.set(0, 0.78, 0.78);
    const spine1 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 5), glowMat);
    spine1.position.set(0, 0.94, 0.12);
    const spine2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), glowMat);
    spine2.position.set(0, 0.9, -0.24);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), bodyMat);
    tail.rotation.x = -Math.PI * 0.4;
    tail.position.set(0, 0.68, -0.78);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.52, 6);
    leftLeg.position.set(-0.26, 0.48, 0.34);
    leftLeg.add(new THREE.Mesh(legGeo, bodyMat));
    rightLeg.position.set(0.26, 0.48, 0.34);
    rightLeg.add(new THREE.Mesh(legGeo, bodyMat));
    leftArm.position.set(-0.26, 0.48, -0.34);
    leftArm.add(new THREE.Mesh(legGeo, bodyMat));
    rightArm.position.set(0.26, 0.48, -0.34);
    rightArm.add(new THREE.Mesh(legGeo, bodyMat));

    bodyPivot.add(torso, head, eyes, spine1, spine2, tail, leftLeg, rightLeg, leftArm, rightArm);
  } else if (archetype === 'acolyte') {
    const robeMat = new THREE.MeshStandardMaterial({ color: 0x362256, roughness: 0.72, metalness: 0.18 });
    const voidMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 0.85,
      roughness: 0.18,
    });
    materialsToFlash.push(robeMat);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.15, 8), robeMat);
    skirt.position.y = 0.72;
    const cowl = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.52, 8), robeMat);
    cowl.position.y = 1.48;
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.12), voidMat);
    mask.position.set(0, 1.38, 0.2);

    halo = new THREE.Group();
    halo.position.set(0, 1.25, 0);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), voidMat);
      shard.position.set(Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65);
      halo.add(shard);
    }

    bodyPivot.add(skirt, cowl, mask, halo, leftLeg, rightLeg, leftArm, rightArm);
  } else if (archetype === 'colossus') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5c5346, roughness: 0.82, metalness: 0.25 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb47b3c, roughness: 0.35, metalness: 0.75 });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xf97316,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });
    materialsToFlash.push(stoneMat, bronzeMat);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.05, 0.75), stoneMat);
    torso.position.y = 1.38;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), coreMat);
    core.position.set(0, 1.38, 0.35);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.44), bronzeMat);
    head.position.set(0, 2.08, 0.05);

    const legGeo = new THREE.BoxGeometry(0.36, 0.85, 0.42);
    leftLeg.position.set(-0.34, 0.85, 0);
    const ll = new THREE.Mesh(legGeo, stoneMat);
    ll.position.y = -0.42;
    leftLeg.add(ll);

    rightLeg.position.set(0.34, 0.85, 0);
    const rl = new THREE.Mesh(legGeo, stoneMat);
    rl.position.y = -0.42;
    rightLeg.add(rl);

    const armGeo = new THREE.BoxGeometry(0.32, 0.95, 0.36);
    leftArm.position.set(-0.76, 1.65, 0);
    const la = new THREE.Mesh(armGeo, bronzeMat);
    la.position.y = -0.35;
    leftArm.add(la);

    rightArm.position.set(0.76, 1.65, 0);
    const ra = new THREE.Mesh(armGeo, bronzeMat);
    ra.position.y = -0.35;
    rightArm.add(ra);

    bodyPivot.add(torso, core, head, leftLeg, rightLeg, leftArm, rightArm);
  } else {
    // Solar Warden Boss
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x241d2e, roughness: 0.45, metalness: 0.65 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe5a93c, roughness: 0.24, metalness: 0.85 });
    const sunMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.0,
      roughness: 0.15,
    });
    materialsToFlash.push(obsidianMat, goldMat);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.46, 1.45, 8), obsidianMat);
    torso.position.y = 1.72;
    const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), sunMat);
    chestCore.position.set(0, 1.78, 0.48);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.55, 6), goldMat);
    crown.position.y = 2.75;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.25), sunMat);
    visor.position.set(0, 2.72, 0.24);

    halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.06, 8, 32), sunMat);
    halo.position.set(0, 2.25, -0.35);

    const legGeo = new THREE.BoxGeometry(0.38, 1.05, 0.44);
    leftLeg.position.set(-0.38, 1.05, 0);
    const ll = new THREE.Mesh(legGeo, obsidianMat);
    ll.position.y = -0.5;
    leftLeg.add(ll);
    rightLeg.position.set(0.38, 1.05, 0);
    const rl = new THREE.Mesh(legGeo, obsidianMat);
    rl.position.y = -0.5;
    rightLeg.add(rl);

    leftArm.position.set(-0.88, 2.15, 0);
    const lWing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, 0.42), goldMat);
    lWing.position.y = -0.4;
    leftArm.add(lWing);

    rightArm.position.set(0.88, 2.15, 0);
    const rWing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.1, 0.42), goldMat);
    rWing.position.y = -0.4;
    const halberdShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 8), goldMat);
    halberdShaft.position.set(0, -0.1, 0.45);
    halberdShaft.rotation.x = 0.4;
    const halberdTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), sunMat);
    halberdTip.position.set(0, 1.15, 1.0);
    rightArm.add(rWing, halberdShaft, halberdTip);

    bodyPivot.add(torso, chestCore, crown, visor, halo, leftLeg, rightLeg, leftArm, rightArm);
  }

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    halo,
    materialsToFlash,
  };
}

export function buildShrineObeliskGroup(
  runeTex: THREE.Texture,
  stoneAlbedo: THREE.Texture,
  stoneBump: THREE.Texture,
  radius: number,
): { group: THREE.Group; crystal: THREE.Mesh; ringMesh: THREE.Mesh; crystalMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: stoneAlbedo,
    bumpMap: stoneBump,
    bumpScale: 0.05,
    roughness: 0.85,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xc2934b,
    roughness: 0.32,
    metalness: 0.72,
  });
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x34d399,
    emissive: 0x10b981,
    emissiveIntensity: 0.9,
    roughness: 0.16,
    metalness: 0.4,
  });

  // Base plinth
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.55, 8), stoneMat);
  base.position.y = 0.275;
  base.receiveShadow = true;
  group.add(base);

  // Obelisk spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.95, 5.2, 4), stoneMat);
  spire.position.y = 3.1;
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  group.add(spire);

  // 4 Buttress ribs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.2, 0.46), trimMat);
    rib.position.set(Math.sin(a) * 0.9, 1.5, Math.cos(a) * 0.9);
    rib.rotation.y = a;
    group.add(rib);
  }

  // Floating Crystal Core
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), crystalMat);
  crystal.position.y = 6.7;
  group.add(crystal);

  // Ground capture zone ring
  const ringMat = new THREE.MeshBasicMaterial({
    map: runeTex,
    color: 0x34d399,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), ringMat);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.04;
  group.add(ringMesh);

  return { group, crystal, ringMesh, crystalMat };
}
