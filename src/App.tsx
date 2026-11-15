/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayingHud } from './components/PlayingHud';
import { TitleOverlay } from './components/TitleOverlay';
import {
  CameraPreset,
  HudSnapshot,
  PronteraController,
  TimeOfDay,
  WeatherMode,
  ZoneId,
  mountPronteraScene,
} from './scene/PronteraScene';
import { getZoneName } from './world/fieldMaps';
import { PLAYER_SPAWN, getDistrictAt } from './world/pronteraLayout';

function getInitialMode(): 'title' | 'playing' {
  if (typeof window === 'undefined') return 'title';
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1' ? 'playing' : 'title';
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<PronteraController | null>(null);

  const [mode, setMode] = useState<'title' | 'playing'>(getInitialMode);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [weather, setWeather] = useState<WeatherMode>('clear');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('classic');
  const [muted, setMuted] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>({
    zoneId: 'prontera',
    zoneName: getZoneName('prontera'),
    x: PLAYER_SPAWN.x,
    z: PLAYER_SPAWN.z,
    yaw: PLAYER_SPAWN.yaw,
    camYaw: 0,
    district: getDistrictAt(PLAYER_SPAWN.x, PLAYER_SPAWN.z),
    isMoving: false,
    level: 1,
    exp: 0,
    expNext: 60,
    zeny: 0,
    kills: 0,
    targetMob: null,
    popups: [],
  });

  // Sync body[data-state] for accessibility and state clarity
  useEffect(() => {
    document.body.dataset.state = mode;
  }, [mode]);

  // Mount Three.js Prontera world once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const initialMode = getInitialMode();
    const ctrl = mountPronteraScene(
      el,
      initialMode,
      (snap) => {
        setHud(snap);
      },
      (lost) => {
        setContextLost(lost);
      },
    );
    controllerRef.current = ctrl;

    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    setMode('playing');
    document.body.dataset.state = 'playing';
    controllerRef.current?.setPlaying(true);
  }, []);

  const handleSelectTime = useCallback((next: TimeOfDay) => {
    setTimeOfDay(next);
    controllerRef.current?.setTimeOfDay(next);
  }, []);

  const handleSelectWeather = useCallback((next: WeatherMode) => {
    setWeather(next);
    controllerRef.current?.setWeather(next);
  }, []);

  const handleTriggerLightning = useCallback(() => {
    controllerRef.current?.triggerLightning();
  }, []);

  const handleSelectCameraPreset = useCallback((next: CameraPreset) => {
    setCameraPreset(next);
    controllerRef.current?.setCameraPreset(next);
  }, []);

  const handleResetNorth = useCallback(() => {
    setCameraPreset('classic');
    controllerRef.current?.resetCameraNorth();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!controllerRef.current) return;
    const isNowMuted = controllerRef.current.toggleMute();
    setMuted(isNowMuted);
  }, []);

  const handleAttack = useCallback(() => {
    controllerRef.current?.attackNearest();
  }, []);

  const handleSelectLandmark = useCallback((id: string) => {
    controllerRef.current?.teleportToLandmark(id);
  }, []);

  const handleWarpZone = useCallback(
    (zoneId: ZoneId, spawnX?: number, spawnZ?: number, spawnYaw?: number) => {
      controllerRef.current?.warpToZone(zoneId, spawnX, spawnZ, spawnYaw);
    },
    [],
  );

  const handleMinimapWalk = useCallback((x: number, z: number) => {
    controllerRef.current?.walkToWorldPoint(x, z);
  }, []);

  // Keyboard shortcuts for Title Start (Enter/Space) and HUD hotkeys (M/C)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStart();
        return;
      }
      if (mode === 'playing') {
        if (e.code === 'KeyM') {
          handleToggleMute();
        } else if (e.code === 'KeyC') {
          handleResetNorth();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleStart, handleToggleMute, handleResetNorth]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#182230]">
      {/* Dedicated WebGL Mount Container isolated from React HUD re-renders */}
      <div
        ref={mountRef}
        data-testid="prontera-canvas-mount"
        className="absolute inset-0 w-full h-full"
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141c28]/95 text-[#f5efe2] p-6">
          <div className="max-w-md text-center space-y-2 p-6 rounded-xl border border-[#b99b63]/50 bg-[#1d2738]">
            <h2 className="font-display text-xl font-bold text-[#f2d68a]">
              Obnovení 3D grafiky
            </h2>
            <p className="text-sm text-[#d4cbb8]">
              WebGL kontext byl dočasně pozastaven. Obnovte prosím stránku, pokud se scéna sama nenačte.
            </p>
          </div>
        </div>
      )}

      {mode === 'title' ? (
        <TitleOverlay onStart={handleStart} />
      ) : (
        <PlayingHud
          hud={hud}
          timeOfDay={timeOfDay}
          weather={weather}
          cameraPreset={cameraPreset}
          muted={muted}
          onSelectTimeOfDay={handleSelectTime}
          onSelectWeather={handleSelectWeather}
          onTriggerLightning={handleTriggerLightning}
          onSelectCameraPreset={handleSelectCameraPreset}
          onResetNorth={handleResetNorth}
          onToggleMute={handleToggleMute}
          onAttack={handleAttack}
          onSelectLandmark={handleSelectLandmark}
          onWarpZone={handleWarpZone}
          onMinimapWalk={handleMinimapWalk}
        />
      )}
    </div>
  );
}
