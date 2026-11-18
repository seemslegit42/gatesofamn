import * as THREE from 'three';
import type {
  DynamicWorldEventKind,
  EnemyArchetype,
  HeroAppearance,
  HeroClass,
  SnapshotCompanion,
} from '@/lib/game/types';
import { getDefaultAppearance, getEyeGlowHex } from '@/lib/game/appearance';

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
  appearanceInput?: HeroAppearance,
): AnimatedActorRig {
  const appearance = appearanceInput ?? getDefaultAppearance(heroClass);
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Body type proportions (pivot remains strictly at ground y = 0)
  const bodyScaleX =
    appearance.bodyType === 'titan' ? 1.15 : appearance.bodyType === 'lithe' ? 0.9 : 1.0;
  const bodyScaleY =
    appearance.bodyType === 'titan' ? 1.07 : appearance.bodyType === 'lithe' ? 0.98 : 1.0;
  const bodyScaleZ =
    appearance.bodyType === 'titan' ? 1.12 : appearance.bodyType === 'lithe' ? 0.92 : 1.0;
  bodyPivot.scale.set(bodyScaleX, bodyScaleY, bodyScaleZ);

  root.add(makeContactShadow(shadowTex, appearance.bodyType === 'titan' ? 1.04 : 0.92));

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

  const outfitColor = new THREE.Color(appearance.outfitTint);
  const skinColor = new THREE.Color(appearance.skinTone);
  const hairColor = new THREE.Color(appearance.hairColor);
  const eyeHex = getEyeGlowHex(appearance.eyeGlow);

  const armorMetal =
    appearance.outfitStyle === 'warden'
      ? 0xd9c27e
      : appearance.outfitStyle === 'astral'
        ? 0x7aa2d4
        : appearance.outfitStyle === 'nomad' || appearance.outfitStyle === 'ashstalker'
          ? 0x6b5340
          : appearance.outfitStyle === 'ironbound'
            ? 0x3b424d
            : appearance.outfitStyle === 'wolfguard'
              ? 0x5c6470
              : 0x9fa8b7;

  const clothMat = new THREE.MeshStandardMaterial({
    color: outfitColor,
    roughness: 0.78,
    metalness: 0.12,
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: armorMetal,
    roughness: 0.28,
    metalness: 0.78,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: eyeHex,
    emissive: eyeHex,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.45,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.72,
    metalness: 0.04,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: hairColor,
    roughness: 0.64,
    metalness: 0.08,
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

  // Sculpted Torso (Lathe/Cylinder + Outfit silhouette)
  const isClothTorso =
    appearance.outfitStyle === 'astral' ||
    appearance.outfitStyle === 'nomad' ||
    appearance.outfitStyle === 'ashstalker';
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(
      appearance.bodyType === 'titan' ? 0.35 : 0.3,
      0.24,
      0.68,
      10,
    ),
    isClothTorso ? clothMat : plateMat,
  );
  torso.position.y = 0.98;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Waist Sash / Belt Buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.11, 10), darkMat);
  belt.position.y = 0.72;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), accentMat);
  buckle.position.set(0, 0.72, 0.25);
  bodyPivot.add(belt, buckle);

  // Cloak Silhouette (Wolfskin Pelt, Frostwolf Alpha, Ashen Marauder, or Class Mantle)
  const cloakStyle = appearance.cloakStyle ?? 'standard';
  const cloakShape = new THREE.Shape();
  if (cloakStyle === 'wolfskin' || cloakStyle === 'frostwolf') {
    cloakShape.moveTo(-0.34, 0);
    cloakShape.lineTo(0.34, 0);
    cloakShape.lineTo(0.46, -0.45);
    cloakShape.lineTo(0.36, -0.82);
    cloakShape.lineTo(0.16, -0.74);
    cloakShape.lineTo(0, -1.04);
    cloakShape.lineTo(-0.16, -0.74);
    cloakShape.lineTo(-0.36, -0.82);
    cloakShape.lineTo(-0.46, -0.45);
  } else if (cloakStyle === 'ragged_ash') {
    cloakShape.moveTo(-0.28, 0);
    cloakShape.lineTo(0.28, 0);
    cloakShape.lineTo(0.38, -0.72);
    cloakShape.lineTo(0.22, -0.96);
    cloakShape.lineTo(0.08, -0.78);
    cloakShape.lineTo(-0.08, -1.02);
    cloakShape.lineTo(-0.24, -0.76);
    cloakShape.lineTo(-0.38, -0.92);
  } else if (appearance.outfitStyle === 'nomad' || appearance.outfitStyle === 'ashstalker') {
    cloakShape.moveTo(-0.22, 0);
    cloakShape.lineTo(0.24, 0);
    cloakShape.lineTo(0.28, -0.78);
    cloakShape.lineTo(-0.18, -0.88);
  } else if (appearance.outfitStyle === 'astral') {
    cloakShape.moveTo(-0.28, 0);
    cloakShape.lineTo(0.28, 0);
    cloakShape.lineTo(0.42, -0.92);
    cloakShape.lineTo(0, -1.0);
    cloakShape.lineTo(-0.42, -0.92);
  } else {
    cloakShape.moveTo(-0.26, 0);
    cloakShape.lineTo(0.26, 0);
    cloakShape.lineTo(0.38, -0.84);
    cloakShape.lineTo(0, -0.95);
    cloakShape.lineTo(-0.38, -0.84);
  }
  cloakShape.closePath();
  const cloakGeo = new THREE.ExtrudeGeometry(cloakShape, {
    depth: cloakStyle === 'wolfskin' || cloakStyle === 'frostwolf' ? 0.08 : 0.05,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });

  const cloakMaterial =
    cloakStyle === 'wolfskin'
      ? new THREE.MeshStandardMaterial({ color: 0x5d4937, roughness: 0.92, metalness: 0.04 })
      : cloakStyle === 'frostwolf'
        ? new THREE.MeshStandardMaterial({ color: 0xc5d0dc, roughness: 0.9, metalness: 0.05 })
        : cloakStyle === 'ragged_ash'
          ? new THREE.MeshStandardMaterial({ color: 0x262932, roughness: 0.9, metalness: 0.08 })
          : clothMat;

  if (cloakMaterial !== clothMat) {
    materialsToFlash.push(cloakMaterial);
  }

  const cloak = new THREE.Mesh(cloakGeo, cloakMaterial);
  cloak.position.set(0, 1.24, -0.24);
  cloak.rotation.x = 0.17;
  cloak.castShadow = true;
  bodyPivot.add(cloak);

  if (cloakStyle === 'wolfskin' || cloakStyle === 'frostwolf') {
    const furRuffMat = new THREE.MeshStandardMaterial({
      color: cloakStyle === 'frostwolf' ? 0x9aa8b8 : 0x3b2d22,
      roughness: 0.94,
      metalness: 0.02,
    });
    const furRuff = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.1, 7, 14), furRuffMat);
    furRuff.rotation.x = Math.PI / 2;
    furRuff.position.set(0, 1.32, -0.05);
    bodyPivot.add(furRuff);

    const tuftGeo = new THREE.ConeGeometry(0.11, 0.24, 5);
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(tuftGeo, furRuffMat);
      tuft.position.set(side * 0.31, 1.33, -0.14);
      tuft.rotation.z = side * -0.65;
      tuft.rotation.x = -0.3;
      const clasp = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), plateMat);
      clasp.position.set(side * 0.22, 1.25, 0.21);
      bodyPivot.add(tuft, clasp);
    }
  }

  // Outfit-Specific Armor Silhouettes
  if (
    appearance.outfitStyle === 'sanctuary' ||
    appearance.outfitStyle === 'warden' ||
    appearance.outfitStyle === 'wolfguard' ||
    appearance.outfitStyle === 'ironbound'
  ) {
    const pauldronGeo = new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    const lPauldron = new THREE.Mesh(pauldronGeo, plateMat);
    lPauldron.position.set(-0.41, 1.26, 0);
    lPauldron.rotation.z = 0.42;
    const rPauldron = new THREE.Mesh(pauldronGeo, plateMat);
    rPauldron.position.set(0.41, 1.26, 0);
    rPauldron.rotation.z = -0.42;
    bodyPivot.add(lPauldron, rPauldron);

    if (appearance.outfitStyle === 'warden') {
      const chestCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), accentMat);
      chestCrest.position.set(0, 1.06, 0.31);
      bodyPivot.add(chestCrest);
    } else if (appearance.outfitStyle === 'wolfguard') {
      const furTrimMat = new THREE.MeshStandardMaterial({ color: 0x5c4734, roughness: 0.92, metalness: 0.04 });
      const lPelt = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 10), furTrimMat);
      lPelt.position.set(-0.41, 1.19, 0);
      lPelt.rotation.x = Math.PI / 2;
      const rPelt = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 10), furTrimMat);
      rPelt.position.set(0.41, 1.19, 0);
      rPelt.rotation.x = Math.PI / 2;
      bodyPivot.add(lPelt, rPelt);
    } else if (appearance.outfitStyle === 'ironbound') {
      const spikeGeo = new THREE.ConeGeometry(0.06, 0.28, 4);
      const lSpike = new THREE.Mesh(spikeGeo, plateMat);
      lSpike.position.set(-0.45, 1.44, 0);
      lSpike.rotation.z = 0.45;
      const rSpike = new THREE.Mesh(spikeGeo, plateMat);
      rSpike.position.set(0.45, 1.44, 0);
      rSpike.rotation.z = -0.45;
      const gorget = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 6, 12), plateMat);
      gorget.rotation.x = Math.PI / 2;
      gorget.position.set(0, 1.29, 0.02);
      bodyPivot.add(lSpike, rSpike, gorget);
    }
  } else if (appearance.outfitStyle === 'astral') {
    // Arcane shoulder fins + collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 16), plateMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.31, -0.02);
    const finGeo = new THREE.ConeGeometry(0.14, 0.42, 4);
    const lFin = new THREE.Mesh(finGeo, plateMat);
    lFin.position.set(-0.42, 1.36, -0.02);
    lFin.rotation.z = 0.68;
    const rFin = new THREE.Mesh(finGeo, plateMat);
    rFin.position.set(0.42, 1.36, -0.02);
    rFin.rotation.z = -0.68;
    bodyPivot.add(collar, lFin, rFin);
  } else {
    // Nomad / Ashstalker diagonal leather bandolier + scarf collar
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.065, 8, 16), clothMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 1.3, 0);
    const bandolier = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.56), darkMat);
    bandolier.position.set(0, 1.0, 0);
    bandolier.rotation.z = 0.52;
    bodyPivot.add(scarf, bandolier);
    if (appearance.outfitStyle === 'ashstalker') {
      const daggerGeo = new THREE.ConeGeometry(0.035, 0.34, 4);
      const lSheath = new THREE.Mesh(daggerGeo, plateMat);
      lSheath.position.set(-0.29, 0.68, -0.1);
      lSheath.rotation.x = Math.PI * 0.88;
      const rSheath = new THREE.Mesh(daggerGeo, plateMat);
      rSheath.position.set(0.29, 0.68, -0.1);
      rSheath.rotation.x = Math.PI * 0.88;
      bodyPivot.add(lSheath, rSheath);
    }
  }

  // Head + Facial Features + Hairstyles
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.215, 14, 12), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Expressive Luminous Eyes (paired for close-up & crisp isometric read)
  const eyeGeo = new THREE.BoxGeometry(0.065, 0.04, 0.06);
  const lEye = new THREE.Mesh(eyeGeo, accentMat);
  lEye.position.set(-0.075, 0.03, 0.19);
  const rEye = new THREE.Mesh(eyeGeo, accentMat);
  rEye.position.set(0.075, 0.03, 0.19);
  headGroup.add(lEye, rEye);

  // Facial Feature Details
  if (appearance.faceStyle === 'scarred') {
    const scarMat = new THREE.MeshStandardMaterial({
      color: 0x993344,
      roughness: 0.6,
      metalness: 0.1,
    });
    const scar = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.15, 0.04), scarMat);
    scar.position.set(-0.08, 0.02, 0.205);
    scar.rotation.z = 0.35;
    headGroup.add(scar);
  } else if (appearance.faceStyle === 'painted') {
    const streakGeo = new THREE.BoxGeometry(0.08, 0.028, 0.04);
    const lMark = new THREE.Mesh(streakGeo, accentMat);
    lMark.position.set(-0.11, -0.02, 0.195);
    lMark.rotation.z = -0.25;
    const rMark = new THREE.Mesh(streakGeo, accentMat);
    rMark.position.set(0.11, -0.02, 0.195);
    rMark.rotation.z = 0.25;
    headGroup.add(lMark, rMark);
  } else if (appearance.faceStyle === 'masked') {
    const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.16, 10), plateMat);
    mask.position.set(0, -0.06, 0.03);
    headGroup.add(mask);
  } else {
    // Noble brow circlet
    const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.02, 6, 16), plateMat);
    circlet.rotation.x = Math.PI / 2;
    circlet.position.set(0, 0.09, 0);
    headGroup.add(circlet);
  }

  // Hair / Hood Silhouettes (crafted to read distinctly from top-down!)
  if (appearance.hairStyle === 'hooded') {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.44, 10), clothMat);
    hood.position.set(0, 0.13, -0.05);
    hood.rotation.x = -0.24;
    headGroup.add(hood);
  } else {
    // Hair skull cap
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.228, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat,
    );
    hairCap.position.set(0, 0.03, -0.02);
    hairCap.rotation.x = -0.22;
    headGroup.add(hairCap);

    if (appearance.hairStyle === 'swept') {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), hairMat);
      tuft.position.set(0.03, 0.22, -0.04);
      tuft.rotation.x = -0.55;
      tuft.rotation.z = -0.25;
      headGroup.add(tuft);
    } else if (appearance.hairStyle === 'crest') {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.34), hairMat);
      crest.position.set(0, 0.23, -0.02);
      headGroup.add(crest);
    } else if (appearance.hairStyle === 'braided') {
      const braidGeo = new THREE.CylinderGeometry(0.045, 0.03, 0.36, 6);
      const lBraid = new THREE.Mesh(braidGeo, hairMat);
      lBraid.position.set(-0.2, -0.08, 0.02);
      lBraid.rotation.z = 0.22;
      const rBraid = new THREE.Mesh(braidGeo, hairMat);
      rBraid.position.set(0.2, -0.08, 0.02);
      rBraid.rotation.z = -0.22;
      headGroup.add(lBraid, rBraid);
    } else if (appearance.hairStyle === 'long') {
      const mane = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.48, 8), hairMat);
      mane.position.set(0, -0.1, -0.15);
      mane.rotation.x = 0.26;
      headGroup.add(mane);
    }
  }
  bodyPivot.add(headGroup);

  // Arms & Class Weapons
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.36, 4, 8);
  const handGeo = new THREE.SphereGeometry(0.085, 8, 6);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.4, 1.2, 0);
  const lArmMesh = new THREE.Mesh(armGeo, clothMat);
  lArmMesh.position.y = -0.2;
  const lHand = new THREE.Mesh(handGeo, skinMat);
  lHand.position.y = -0.4;
  leftArm.add(lArmMesh, lHand);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 1.2, 0);
  const rArmMesh = new THREE.Mesh(armGeo, clothMat);
  rArmMesh.position.y = -0.2;
  const rHand = new THREE.Mesh(handGeo, skinMat);
  rHand.position.y = -0.4;
  rightArm.add(rArmMesh, rHand);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0, -0.38, 0.14);
  rightArm.add(weaponPivot);

  let halo: THREE.Object3D | undefined;
  const weaponSkin = appearance.weaponSkin ?? 'standard';
  const weaponMetalMat =
    weaponSkin === 'ashen_fang'
      ? new THREE.MeshStandardMaterial({ color: 0x2c303a, roughness: 0.36, metalness: 0.84 })
      : weaponSkin === 'runeblade'
        ? new THREE.MeshStandardMaterial({ color: 0xd1a34b, roughness: 0.24, metalness: 0.85 })
        : weaponSkin === 'stormcaller'
          ? new THREE.MeshStandardMaterial({ color: 0x5c8dc4, roughness: 0.22, metalness: 0.88 })
          : plateMat;
  const weaponCoreMat =
    weaponSkin === 'ashen_fang'
      ? new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xe11d48,
          emissiveIntensity: 0.8,
          roughness: 0.25,
        })
      : weaponSkin === 'runeblade'
        ? new THREE.MeshStandardMaterial({
            color: 0xfde047,
            emissive: 0xe5a93c,
            emissiveIntensity: 0.85,
            roughness: 0.2,
          })
        : weaponSkin === 'stormcaller'
          ? new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              emissive: 0x0ea5e9,
              emissiveIntensity: 0.9,
              roughness: 0.18,
            })
          : accentMat;

  if (heroClass === 'vanguard') {
    const bladeWidth = weaponSkin === 'ashen_fang' ? 0.15 : weaponSkin === 'runeblade' ? 0.13 : 0.11;
    const bladeLen = weaponSkin === 'stormcaller' ? 1.28 : 1.15;
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(bladeWidth, bladeLen, 0.045),
      weaponMetalMat,
    );
    blade.position.set(0, 0.48, 0.32);
    blade.rotation.x = Math.PI * 0.36;
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(weaponSkin === 'standard' ? 0.36 : 0.44, 0.08, 0.11),
      weaponCoreMat,
    );
    guard.position.set(0, 0.1, 0.05);
    weaponPivot.add(blade, guard);
    if (weaponSkin !== 'standard') {
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), weaponCoreMat);
      tip.position.set(0, 0.88, 0.64);
      tip.rotation.x = Math.PI * 0.36;
      weaponPivot.add(tip);
    }

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 0.08, 6), weaponMetalMat);
    shield.rotation.x = Math.PI / 2;
    shield.position.set(-0.14, -0.2, 0.22);
    const shieldBoss = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), weaponCoreMat);
    shieldBoss.position.set(-0.14, -0.2, 0.28);
    leftArm.add(shield, shieldBoss);
  } else if (heroClass === 'arcanist') {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.55, 8),
      weaponSkin === 'standard' ? darkMat : weaponMetalMat,
    );
    shaft.position.set(0, 0.42, 0.22);
    shaft.rotation.x = 0.22;
    const orb = new THREE.Mesh(
      weaponSkin === 'stormcaller'
        ? new THREE.IcosahedronGeometry(0.19, 0)
        : new THREE.OctahedronGeometry(0.16),
      weaponCoreMat,
    );
    orb.position.set(0, 1.22, 0.4);
    weaponPivot.add(shaft, orb);
    if (weaponSkin !== 'standard') {
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 14), weaponMetalMat);
      crown.position.set(0, 1.22, 0.4);
      crown.rotation.x = 0.6;
      weaponPivot.add(crown);
    }

    halo = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 24), weaponCoreMat);
    halo.position.set(0, 1.38, -0.32);
    bodyPivot.add(halo);
  } else {
    const bowCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.45, 0.15),
      new THREE.Vector3(0, -0.2, weaponSkin === 'standard' ? 0.36 : 0.42),
      new THREE.Vector3(0, 0.2, weaponSkin === 'standard' ? 0.36 : 0.42),
      new THREE.Vector3(0, 0.45, 0.15),
    ]);
    const bow = new THREE.Mesh(
      new THREE.TubeGeometry(bowCurve, 12, weaponSkin === 'standard' ? 0.035 : 0.042, 6, false),
      weaponMetalMat,
    );
    bow.position.set(-0.1, -0.18, 0.15);
    leftArm.add(bow);

    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6), weaponCoreMat);
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
  } else if (archetype === 'thief') {
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.85, metalness: 0.12 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.78, metalness: 0.14 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xb8c4d4, roughness: 0.28, metalness: 0.82 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    materialsToFlash.push(cloakMat, leatherMat);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.64, 8), leatherMat);
    torso.position.y = 0.92;
    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.78, 7), cloakMat);
    cape.position.set(0, 0.86, -0.14);
    cape.rotation.x = 0.22;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), leatherMat);
    head.position.y = 1.42;
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 8), cloakMat);
    hood.position.set(0, 1.54, -0.04);
    hood.rotation.x = -0.2;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.06), eyeMat);
    visor.position.set(0, 1.44, 0.16);

    const legGeo = new THREE.CapsuleGeometry(0.085, 0.38, 4, 6);
    leftLeg.position.set(-0.16, 0.58, 0);
    const ll = new THREE.Mesh(legGeo, cloakMat);
    ll.position.y = -0.22;
    leftLeg.add(ll);
    rightLeg.position.set(0.16, 0.58, 0);
    const rl = new THREE.Mesh(legGeo, cloakMat);
    rl.position.y = -0.22;
    rightLeg.add(rl);

    const armGeo = new THREE.CapsuleGeometry(0.075, 0.32, 4, 6);
    const daggerGeo = new THREE.ConeGeometry(0.045, 0.44, 4);
    leftArm.position.set(-0.32, 1.14, 0);
    const la = new THREE.Mesh(armGeo, cloakMat);
    la.position.y = -0.18;
    const lDagger = new THREE.Mesh(daggerGeo, steelMat);
    lDagger.rotation.x = Math.PI * 0.48;
    lDagger.position.set(0, -0.34, 0.26);
    leftArm.add(la, lDagger);

    rightArm.position.set(0.32, 1.14, 0);
    const ra = new THREE.Mesh(armGeo, cloakMat);
    ra.position.y = -0.18;
    const rDagger = new THREE.Mesh(daggerGeo, steelMat);
    rDagger.rotation.x = Math.PI * 0.48;
    rDagger.position.set(0, -0.34, 0.26);
    rightArm.add(ra, rDagger);

    bodyPivot.add(torso, cape, head, hood, visor, leftLeg, rightLeg, leftArm, rightArm);
  } else if (archetype === 'batras') {
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x333945, roughness: 0.38, metalness: 0.78 });
    const furMat = new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.92, metalness: 0.05 });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    });
    materialsToFlash.push(ironMat, furMat);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.38, 1.12, 8), ironMat);
    torso.position.y = 1.38;
    const pelt = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 7, 14), furMat);
    pelt.rotation.x = Math.PI / 2;
    pelt.position.set(0, 1.88, -0.05);
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.44, 8), ironMat);
    helm.position.y = 2.18;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.16), emberMat);
    visor.position.set(0, 2.16, 0.2);
    const hornGeo = new THREE.ConeGeometry(0.075, 0.45, 5);
    const lHorn = new THREE.Mesh(hornGeo, furMat);
    lHorn.position.set(-0.28, 2.38, 0);
    lHorn.rotation.z = 0.58;
    const rHorn = new THREE.Mesh(hornGeo, furMat);
    rHorn.position.set(0.28, 2.38, 0);
    rHorn.rotation.z = -0.58;

    const legGeo = new THREE.BoxGeometry(0.32, 0.88, 0.36);
    leftLeg.position.set(-0.3, 0.88, 0);
    const ll = new THREE.Mesh(legGeo, ironMat);
    ll.position.y = -0.44;
    leftLeg.add(ll);
    rightLeg.position.set(0.3, 0.88, 0);
    const rl = new THREE.Mesh(legGeo, ironMat);
    rl.position.y = -0.44;
    rightLeg.add(rl);

    leftArm.position.set(-0.68, 1.78, 0);
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.84, 0.28), ironMat);
    lArm.position.y = -0.32;
    leftArm.add(lArm);

    rightArm.position.set(0.68, 1.78, 0);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.84, 0.28), ironMat);
    rArm.position.y = -0.32;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.15, 0.07), ironMat);
    blade.position.set(0, 0.15, 0.65);
    blade.rotation.x = Math.PI * 0.34;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), emberMat);
    core.position.set(0, -0.36, 0.26);
    rightArm.add(rArm, blade, core);

    bodyPivot.add(
      torso,
      pelt,
      helm,
      visor,
      lHorn,
      rHorn,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
    );
  } else {
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

export function buildWarhorseMountGroup(accentHex = 0xe5a93c): THREE.Group {
  const horse = new THREE.Group();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.78, metalness: 0.08 });
  const maneMat = new THREE.MeshStandardMaterial({ color: 0x191513, roughness: 0.88, metalness: 0.05 });
  const tackMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.35, metalness: 0.72 });

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 1.72), coatMat);
  barrel.position.set(0, 0.96, 0);
  barrel.castShadow = true;

  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.66), tackMat);
  saddle.position.set(0, 1.31, -0.05);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.66, 0.46), coatMat);
  neck.position.set(0, 1.38, 0.72);
  neck.rotation.x = 0.38;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.56), coatMat);
  head.position.set(0, 1.66, 1.04);
  head.rotation.x = 0.26;

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.54, 0.14), maneMat);
  crest.position.set(0, 1.48, 0.56);
  crest.rotation.x = 0.38;

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.76, 6), maneMat);
  tail.position.set(0, 0.82, -0.96);
  tail.rotation.x = -0.32;

  const legGeo = new THREE.CylinderGeometry(0.09, 0.065, 0.82, 6);
  const legOffsets: [number, number][] = [
    [-0.25, 0.62],
    [0.25, 0.62],
    [-0.25, -0.62],
    [0.25, -0.62],
  ];
  for (const [lx, lz] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, coatMat);
    leg.position.set(lx, 0.41, lz);
    horse.add(leg);
  }

  horse.add(barrel, saddle, neck, head, crest, tail);
  return horse;
}

export function buildCompanionRig(
  companion: SnapshotCompanion,
  shadowTex: THREE.Texture,
  runeTex: THREE.Texture,
): AnimatedActorRig {
  const accentNum = Number.parseInt(companion.accentColor.replace('#', ''), 16) || 0x38bdf8;
  const heroClass: HeroClass =
    companion.role === 'Outrider'
      ? 'ranger'
      : companion.role === 'Tactician'
        ? 'arcanist'
        : 'vanguard';

  const appearance = getDefaultAppearance(heroClass);
  appearance.outfitTint = companion.accentColor;
  appearance.cloakStyle =
    companion.id === 'haft' || companion.id === 'worgen' ? 'wolfskin' : 'standard';
  appearance.bodyType = companion.id === 'haft' ? 'titan' : companion.id === 'graymstrum' ? 'lithe' : 'balanced';

  const rig = buildHeroRig(heroClass, false, shadowTex, runeTex, appearance);
  if (companion.mounted) {
    const horse = buildWarhorseMountGroup(accentNum);
    rig.bodyPivot.add(horse);
    for (const child of rig.bodyPivot.children) {
      if (child !== horse) {
        child.position.y += 0.72;
      }
    }
  }
  return rig;
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

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.1, 0.55, 8), stoneMat);
  base.position.y = 0.275;
  base.receiveShadow = true;
  group.add(base);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.95, 5.2, 4), stoneMat);
  spire.position.y = 3.1;
  spire.rotation.y = Math.PI / 4;
  spire.castShadow = true;
  group.add(spire);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.2, 0.46), trimMat);
    rib.position.set(Math.sin(a) * 0.9, 1.5, Math.cos(a) * 0.9);
    rib.rotation.y = a;
    group.add(rib);
  }

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.68), crystalMat);
  crystal.position.y = 6.7;
  group.add(crystal);

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

export function buildWorldEventPortalGroup(
  kind: DynamicWorldEventKind,
  runeTex: THREE.Texture,
  radius: number,
): { group: THREE.Group; core: THREE.Object3D; ring: THREE.Mesh; beam: THREE.Mesh } {
  const group = new THREE.Group();
  const colorHex =
    kind === 'tempest'
      ? 0x38bdf8
      : kind === 'dungeon_rift' || kind === 'barrow_ambush'
        ? 0xf59e0b
        : 0xc084fc;

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x262936,
    roughness: 0.72,
    metalness: 0.28,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.0,
    roughness: 0.18,
    metalness: 0.45,
  });

  // Ground event zone rune circle
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: runeTex,
      color: colorHex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  // Twin archway pillars + crown (3-5 composite parts grounded at y=0)
  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.7), stoneMat);
  leftPillar.position.set(-1.6, 2.2, 0);
  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.4, 0.7), stoneMat);
  rightPillar.position.set(1.6, 2.2, 0);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.65, 0.9), stoneMat);
  crown.position.set(0, 4.6, 0);
  group.add(leftPillar, rightPillar, crown);

  // Rotating Portal / Vortex Core
  const core = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 8, 24), glowMat);
  core.position.set(0, 2.5, 0);
  group.add(core);

  // Tall Beacon Beam visible across isometric view
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 1.1, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.set(0, 11, 0);
  group.add(beam);

  return { group, core, ring, beam };
}
