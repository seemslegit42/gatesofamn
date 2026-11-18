'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { motion } from 'motion/react';
import {
  Check,
  Dices,
  Eye,
  Lock,
  RotateCw,
  Shield,
  Shirt,
  ShoppingBag,
  Sparkles,
  Swords,
  User,
  X,
} from 'lucide-react';
import type { HeroAppearance, HeroClass } from '@/lib/game/types';
import {
  BODY_TYPE_OPTIONS,
  CLOAK_STYLE_OPTIONS,
  EYE_GLOW_OPTIONS,
  FACE_STYLE_OPTIONS,
  HAIR_COLOR_SWATCHES,
  HAIR_STYLE_OPTIONS,
  OUTFIT_STYLE_OPTIONS,
  OUTFIT_TINT_SWATCHES,
  SKIN_TONE_SWATCHES,
  WEAPON_SKIN_OPTIONS,
  randomizeAppearance,
} from '@/lib/game/appearance';
import { CLASS_SPECS } from '@/lib/game/worldData';
import { createProceduralTexturePack } from '@/lib/three/textures';
import { buildHeroRig } from '@/lib/three/models';

interface CharacterCreatorModalProps {
  open: boolean;
  heroName: string;
  heroClass: HeroClass;
  appearance: HeroAppearance;
  unlockedCosmetics?: string[];
  onOpenStore?: () => void;
  onChangeName: (name: string) => void;
  onChangeClass: (heroClass: HeroClass) => void;
  onChangeAppearance: (appearance: HeroAppearance) => void;
  onClose: () => void;
  onConfirmEnter: () => void;
}

type CreatorTab = 'body' | 'hair' | 'outfit';
type PreviewView = 'portrait' | 'isometric';

export default function CharacterCreatorModal({
  open,
  heroName,
  heroClass,
  appearance,
  unlockedCosmetics = [],
  onOpenStore,
  onChangeName,
  onChangeClass,
  onChangeAppearance,
  onClose,
  onConfirmEnter,
}: CharacterCreatorModalProps) {
  const previewMountRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<CreatorTab>('body');
  const [viewMode, setViewMode] = useState<PreviewView>('portrait');

  const viewModeRef = useRef<PreviewView>(viewMode);
  const yawRef = useRef<number>(0.45);
  const rebuildHeroRef = useRef<(() => void) | null>(null);
  const heroClassRef = useRef(heroClass);
  const appearanceRef = useRef(appearance);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    heroClassRef.current = heroClass;
    appearanceRef.current = appearance;
    rebuildHeroRef.current?.();
  }, [heroClass, appearance]);

  // Isolated Three.js Character Studio Preview
  useEffect(() => {
    if (!open) return;
    const container = previewMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const w = Math.max(200, container.clientWidth || 360);
    const h = Math.max(240, container.clientHeight || 400);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.setSize(w, h);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1624);
    scene.fog = new THREE.FogExp2(0x0f1624, 0.035);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xb8dbff, 0x2b241d, 0.85);
    const key = new THREE.DirectionalLight(0xffe8c2, 2.2);
    key.position.set(4, 7, 5);
    key.castShadow = !isSoftwareGl;
    const rim = new THREE.DirectionalLight(0x52b8ff, 0.9);
    rim.position.set(-4, 4, -5);
    scene.add(hemi, key, rim);

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.2, 40);

    const textures = createProceduralTexturePack(renderer.capabilities.getMaxAnisotropy());

    // Sculpted Stone Plinth
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x394150,
      map: textures.stoneAlbedo,
      bumpMap: textures.stoneBump,
      bumpScale: 0.03,
      roughness: 0.78,
      metalness: 0.14,
    });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.75, 0.35, 24), plinthMat);
    plinth.position.y = -0.175;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const trimRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.035, 8, 36),
      new THREE.MeshStandardMaterial({ color: 0xe5a93c, roughness: 0.3, metalness: 0.8 }),
    );
    trimRing.rotation.x = Math.PI / 2;
    trimRing.position.y = 0.01;
    scene.add(trimRing);

    let heroRig = buildHeroRig(
      heroClassRef.current,
      true,
      textures.contactShadow,
      textures.runeRing,
      appearanceRef.current,
    );
    scene.add(heroRig.root);

    rebuildHeroRef.current = () => {
      scene.remove(heroRig.root);
      heroRig = buildHeroRig(
        heroClassRef.current,
        true,
        textures.contactShadow,
        textures.runeRing,
        appearanceRef.current,
      );
      scene.add(heroRig.root);
    };

    // Drag-to-orbit turntable pointer handler
    let dragging = false;
    let lastX = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      yawRef.current += dx * 0.012;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(120, entry.contentRect.width);
        const ch = Math.max(120, entry.contentRect.height);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
        renderer.setSize(cw, ch);
      }
    });
    resizeObserver.observe(container);

    let disposed = false;
    let frameId = 0;
    let lastMs = performance.now();
    let elapsed = 0;
    const camPos = new THREE.Vector3(0, 1.5, 4.4);
    const camLook = new THREE.Vector3(0, 1.05, 0);

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const st = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (st === gl.UNSIGNALED) {
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
      const now = performance.now();
      const dt = Math.min((now - lastMs) / 1000, 0.05);
      lastMs = now;
      elapsed += dt;

      if (!dragging) {
        yawRef.current += dt * 0.35;
      }

      heroRig.bodyPivot.rotation.y = yawRef.current;
      heroRig.leftArm.rotation.x = Math.sin(elapsed * 1.6) * 0.06;
      heroRig.rightArm.rotation.x = -Math.sin(elapsed * 1.6) * 0.06;
      if (heroRig.halo) heroRig.halo.rotation.z += dt * 1.2;
      if (heroRig.auraRing) heroRig.auraRing.rotation.z += dt * 0.35;

      const isIso = viewModeRef.current === 'isometric';
      const targetPos = isIso ? new THREE.Vector3(3.6, 4.8, 3.6) : new THREE.Vector3(0, 1.48, 3.85);
      const targetLook = isIso ? new THREE.Vector3(0, 0.85, 0) : new THREE.Vector3(0, 1.08, 0);

      camPos.lerp(targetPos, 1 - Math.exp(-9 * dt));
      camLook.lerp(targetLook, 1 - Math.exp(-9 * dt));
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      rebuildHeroRef.current = null;
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      textures.dispose();
      plinth.geometry.dispose();
      plinthMat.dispose();
      trimRing.geometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [open]);

  if (!open) return null;

  const spec = CLASS_SPECS[heroClass];

  return (
    <div
      data-testid="character-creator-modal"
      className="fixed inset-0 z-40 bg-[#080b12]/88 flex items-center justify-center p-3 sm:p-6 pointer-events-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-4xl rounded-2xl bg-[#0d121c] border border-[#e5a93c]/35 shadow-[0_28px_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#101725]">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#f8f5ee]">
              Hero Forge
            </h2>
            <div className="text-xs text-[#9fb0c7] flex items-center gap-2">
              <span>{spec.name}</span>
              <span aria-hidden="true">·</span>
              <span>{spec.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChangeAppearance(randomizeAppearance(Date.now()))}
              className="h-10 px-3 rounded-xl bg-[#161f30] border border-white/15 hover:border-[#e5a93c]/60 text-xs font-semibold text-[#f8f5ee] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Dices className="w-4 h-4 text-[#e5a93c]" />
              <span>Randomize</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Character Creator"
              className="w-10 h-10 rounded-xl bg-[#161f30] border border-white/15 hover:border-white/35 flex items-center justify-center text-[#f8f5ee] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Split: Live 3D Preview (Left) + Customization Tabs (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
          {/* 3D Preview Viewport */}
          <div className="md:col-span-5 relative bg-[#0f1624] min-h-[260px] md:min-h-[420px] border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
            <div ref={previewMountRef} className="w-full h-full flex-1 cursor-grab active:cursor-grabbing" />

            {/* Camera Angle Toggle (Close-Up vs Top-Down Isometric) */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="pointer-events-auto inline-flex p-1 rounded-xl bg-[#0c1018]/90 border border-white/15 gap-1">
                <button
                  type="button"
                  onClick={() => setViewMode('portrait')}
                  className={`px-2.5 h-8 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    viewMode === 'portrait'
                      ? 'bg-[#e5a93c] text-[#0c1018]'
                      : 'text-[#b8c2d4] hover:text-[#f8f5ee]'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Close-Up</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('isometric')}
                  className={`px-2.5 h-8 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    viewMode === 'isometric'
                      ? 'bg-[#e5a93c] text-[#0c1018]'
                      : 'text-[#b8c2d4] hover:text-[#f8f5ee]'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Top-Down</span>
                </button>
              </div>
            </div>

            <div className="px-3 py-2 bg-[#0b1019] border-t border-white/10 text-[11px] text-[#9fb0c7] flex items-center justify-between">
              <span>Drag to rotate hero</span>
              <span className="capitalize">{appearance.bodyType} · {appearance.outfitStyle}</span>
            </div>
          </div>

          {/* Customization Controls */}
          <div className="md:col-span-7 flex flex-col min-h-0">
            {/* Name & Class Strip */}
            <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] text-[#9fb0c7] font-semibold mb-1">
                  Hero Name
                </span>
                <input
                  type="text"
                  maxLength={20}
                  value={heroName}
                  onChange={(e) => onChangeName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-[#080b12] border border-white/15 text-sm text-[#f8f5ee] focus:outline-none focus:border-[#e5a93c]"
                />
              </label>

              <div>
                <span className="block text-[11px] text-[#9fb0c7] font-semibold mb-1">
                  Class Path
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['vanguard', 'arcanist', 'ranger'] as HeroClass[]).map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => onChangeClass(cid)}
                      className={`h-10 rounded-lg border text-xs font-semibold capitalize cursor-pointer whitespace-nowrap ${
                        heroClass === cid
                          ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                          : 'bg-[#090d14] border-white/10 text-[#9fb0c7] hover:border-white/25'
                      }`}
                    >
                      {CLASS_SPECS[cid].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feature Tabs */}
            <div className="px-4 sm:px-5 pt-3 flex gap-1.5">
              {(
                [
                  { id: 'body', label: 'Body & Face', icon: User },
                  { id: 'hair', label: 'Hair & Glow', icon: Sparkles },
                  { id: 'outfit', label: 'Outfit & Dye', icon: Shirt },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex-1 h-10 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    tab === id
                      ? 'bg-[#e5a93c] text-[#0c1018] border-[#e5a93c]'
                      : 'bg-[#121927] text-[#b8c2d4] border-white/10 hover:border-white/25'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Active Tab Panel */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              {tab === 'body' && (
                <>
                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Body Build</div>
                    <div className="grid grid-cols-3 gap-2">
                      {BODY_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onChangeAppearance({ ...appearance, bodyType: opt.id })}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer min-h-[54px] ${
                            appearance.bodyType === opt.id
                              ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                              : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                          }`}
                        >
                          <div className="text-xs font-bold">{opt.label}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">{opt.summary}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Facial Features</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {FACE_STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onChangeAppearance({ ...appearance, faceStyle: opt.id })}
                          className={`h-11 rounded-xl border text-xs font-semibold cursor-pointer ${
                            appearance.faceStyle === opt.id
                              ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                              : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Skin Tone</div>
                    <div className="flex flex-wrap gap-2.5">
                      {SKIN_TONE_SWATCHES.map((sw) => {
                        const active = appearance.skinTone.toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() => onChangeAppearance({ ...appearance, skinTone: sw.hex })}
                            title={sw.label}
                            className={`h-11 px-3 rounded-xl border flex items-center gap-2 text-xs cursor-pointer ${
                              active
                                ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                                : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                              style={{ backgroundColor: sw.hex }}
                            />
                            <span>{sw.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {tab === 'hair' && (
                <>
                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Hairstyle &amp; Hood</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HAIR_STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onChangeAppearance({ ...appearance, hairStyle: opt.id })}
                          className={`h-11 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                            appearance.hairStyle === opt.id
                              ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                              : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Hair Color</div>
                    <div className="flex flex-wrap gap-2.5">
                      {HAIR_COLOR_SWATCHES.map((sw) => {
                        const active = appearance.hairColor.toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() => onChangeAppearance({ ...appearance, hairColor: sw.hex })}
                            className={`h-11 px-3 rounded-xl border flex items-center gap-2 text-xs cursor-pointer ${
                              active
                                ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                                : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                              style={{ backgroundColor: sw.hex }}
                            />
                            <span>{sw.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Aether Eye Glow</div>
                    <div className="flex flex-wrap gap-2">
                      {EYE_GLOW_OPTIONS.map((opt) => {
                        const active = appearance.eyeGlow === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangeAppearance({ ...appearance, eyeGlow: opt.id })}
                            className={`h-11 px-3 rounded-xl border flex items-center gap-2 text-xs font-semibold cursor-pointer ${
                              active
                                ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                                : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: opt.hex }}
                            />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {tab === 'outfit' && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#d7dfec]">Armor &amp; Vestment</span>
                      {onOpenStore && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenStore();
                          }}
                          className="text-[11px] font-semibold text-[#e5a93c] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          <span>Solis Armory</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {OUTFIT_STYLE_OPTIONS.map((opt) => {
                        const locked = Boolean(opt.cosmeticId && !unlockedCosmetics.includes(opt.cosmeticId));
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              if (!locked) onChangeAppearance({ ...appearance, outfitStyle: opt.id });
                            }}
                            className={`p-2.5 rounded-xl border text-left min-h-[54px] ${
                              locked
                                ? 'bg-[#080b12] border-white/10 text-[#64748b] cursor-not-allowed'
                                : appearance.outfitStyle === opt.id
                                  ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee] cursor-pointer'
                                  : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold">
                              <span className="flex items-center gap-1.5">
                                {locked ? (
                                  <Lock className="w-3.5 h-3.5 text-[#64748b]" />
                                ) : (
                                  <Shield className="w-3.5 h-3.5 text-[#e5a93c]" />
                                )}
                                <span>{opt.label}</span>
                              </span>
                              {locked && <span className="text-[10px] font-normal">Armory</span>}
                            </div>
                            <div className="text-[11px] opacity-80 mt-0.5">{opt.summary}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Cloak &amp; Fur Mantle</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CLOAK_STYLE_OPTIONS.map((opt) => {
                        const locked = Boolean(opt.cosmeticId && !unlockedCosmetics.includes(opt.cosmeticId));
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              if (!locked) onChangeAppearance({ ...appearance, cloakStyle: opt.id });
                            }}
                            className={`p-2.5 rounded-xl border text-left min-h-[52px] ${
                              locked
                                ? 'bg-[#080b12] border-white/10 text-[#64748b] cursor-not-allowed'
                                : appearance.cloakStyle === opt.id
                                  ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee] cursor-pointer'
                                  : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold">
                              <span className="flex items-center gap-1.5">
                                {locked && <Lock className="w-3 h-3 text-[#64748b]" />}
                                <span>{opt.label}</span>
                              </span>
                              {locked && <span className="text-[10px] font-normal">Armory</span>}
                            </div>
                            <div className="text-[10px] opacity-80 mt-0.5">{opt.summary}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Weapon Design</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {WEAPON_SKIN_OPTIONS.map((opt) => {
                        const locked = Boolean(opt.cosmeticId && !unlockedCosmetics.includes(opt.cosmeticId));
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={locked}
                            onClick={() => {
                              if (!locked) onChangeAppearance({ ...appearance, weaponSkin: opt.id });
                            }}
                            className={`p-2.5 rounded-xl border text-left min-h-[52px] ${
                              locked
                                ? 'bg-[#080b12] border-white/10 text-[#64748b] cursor-not-allowed'
                                : appearance.weaponSkin === opt.id
                                  ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee] cursor-pointer'
                                  : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs font-bold">
                              <span className="flex items-center gap-1.5">
                                {locked ? (
                                  <Lock className="w-3 h-3 text-[#64748b]" />
                                ) : (
                                  <Swords className="w-3.5 h-3.5 text-[#e5a93c]" />
                                )}
                                <span>{opt.label}</span>
                              </span>
                              {locked && <span className="text-[10px] font-normal">Armory</span>}
                            </div>
                            <div className="text-[10px] opacity-80 mt-0.5">{opt.summary}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#d7dfec] mb-2">Cloak &amp; Armor Dye</div>
                    <div className="flex flex-wrap gap-2.5">
                      {OUTFIT_TINT_SWATCHES.map((sw) => {
                        const active = appearance.outfitTint.toLowerCase() === sw.hex.toLowerCase();
                        return (
                          <button
                            key={sw.hex}
                            type="button"
                            onClick={() => onChangeAppearance({ ...appearance, outfitTint: sw.hex })}
                            className={`h-11 px-3 rounded-xl border flex items-center gap-2 text-xs cursor-pointer ${
                              active
                                ? 'bg-[#1a2436] border-[#e5a93c] text-[#f8f5ee]'
                                : 'bg-[#0a0e16] border-white/10 text-[#9fb0c7] hover:border-white/25'
                            }`}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-white/25 shrink-0"
                              style={{ backgroundColor: sw.hex }}
                            />
                            <span>{sw.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer Action */}
            <div className="px-4 sm:px-5 py-3.5 border-t border-white/10 bg-[#101725] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 px-4 rounded-xl bg-[#161f30] border border-white/15 hover:border-white/30 text-xs font-semibold text-[#f8f5ee] cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                data-testid="confirm-hero-forge"
                onClick={onConfirmEnter}
                className="h-11 px-5 rounded-xl bg-[#e5a93c] hover:bg-[#f0b94d] text-[#0c1018] font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save &amp; Enter Realm</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
