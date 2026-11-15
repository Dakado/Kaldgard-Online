import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudRain,
  CloudSnow,
  Compass,
  Sun,
  Sword,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  CameraPreset,
  HudSnapshot,
  TimeOfDay,
  WeatherMode,
  ZoneId,
} from '../scene/PronteraScene';
import { getPortalsForZone } from '../world/fieldMaps';
import { LANDMARKS } from '../world/pronteraLayout';
import { PronteraMinimap } from './PronteraMinimap';

interface PlayingHudProps {
  hud: HudSnapshot;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  cameraPreset: CameraPreset;
  muted: boolean;
  onSelectTimeOfDay: (mode: TimeOfDay) => void;
  onSelectWeather: (weather: WeatherMode) => void;
  onTriggerLightning: () => void;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onResetNorth: () => void;
  onToggleMute: () => void;
  onAttack: () => void;
  onSelectLandmark: (id: string) => void;
  onWarpZone: (zoneId: ZoneId, spawnX?: number, spawnZ?: number, spawnYaw?: number) => void;
  onMinimapWalk: (x: number, z: number) => void;
}

const TIME_OPTIONS: { id: TimeOfDay; label: string }[] = [
  { id: 'day', label: 'Den' },
  { id: 'sunset', label: 'Západ' },
  { id: 'evening', label: 'Večer' },
];

const WEATHER_OPTIONS: { id: WeatherMode; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'clear', label: 'Jasno', Icon: Sun },
  { id: 'rain', label: 'Déšť', Icon: CloudRain },
  { id: 'snow', label: 'Sníh', Icon: CloudSnow },
];

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'classic', label: 'Klasický' },
  { id: 'wide', label: 'Přehled' },
  { id: 'close', label: 'Detail' },
];

export const PlayingHud: React.FC<PlayingHudProps> = ({
  hud,
  timeOfDay,
  weather,
  cameraPreset,
  muted,
  onSelectTimeOfDay,
  onSelectWeather,
  onTriggerLightning,
  onSelectCameraPreset,
  onResetNorth,
  onToggleMute,
  onAttack,
  onSelectLandmark,
  onWarpZone,
  onMinimapWalk,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const expPct = Math.min(100, Math.round((hud.exp / Math.max(1, hud.expNext)) * 100));
  const activePortals = getPortalsForZone(hud.zoneId);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Floating World-Projected Combat Numbers & Loot Rewards */}
      {hud.popups.map((p) => (
        <div
          key={p.id}
          className={`fixed -translate-x-1/2 -translate-y-1/2 font-display font-bold tracking-wide pointer-events-none select-none ${
            p.kind === 'crit'
              ? 'text-lg text-[#ffcf4d]'
              : p.kind === 'levelup'
                ? 'text-base text-[#8ef5a8]'
                : p.kind === 'reward'
                  ? 'text-xs text-[#f5da7d]'
                  : 'text-sm text-[#ffffff]'
          }`}
          style={{
            left: `${p.screenX}px`,
            top: `${p.screenY}px`,
            opacity: p.opacity,
            textShadow: '0 2px 6px rgba(0, 0, 0, 0.95)',
          }}
        >
          {p.text}
        </div>
      ))}

      {/* Top-Center Active Target Mob HP Bar */}
      {hud.targetMob && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-2 rounded-lg bg-[#131924]/92 border border-[#b99b63]/50 shadow-[0_6px_20px_rgba(0,0,0,0.55)] min-w-[210px]">
          <div className="flex items-center justify-between gap-4 text-xs mb-1">
            <span className="font-display font-bold text-[#f4df9a]">
              {hud.targetMob.name}
              <span className="ml-1.5 text-[11px] font-normal text-[#cfc4ae]">
                Lv.{hud.targetMob.level}
              </span>
            </span>
            <span className="font-mono-tabular text-[11px] text-[#e5dccb]">
              {hud.targetMob.hp}/{hud.targetMob.maxHp}
            </span>
          </div>
          <div className="w-full h-2 rounded-sm bg-[#090d14] overflow-hidden border border-[#b99b63]/25">
            <div
              className="h-full bg-[#d94444] transition-all duration-100"
              style={{
                width: `${Math.max(0, Math.min(100, (hud.targetMob.hp / hud.targetMob.maxHp) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Top-Left Compact Zone, District, Stats & Minimap Cluster */}
      <div className="fixed top-4 left-4 pointer-events-auto flex flex-col gap-2 p-2.5 rounded-xl bg-[#131924]/92 border border-[#b99b63]/40 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <div className="flex flex-col gap-1 px-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-xs font-bold tracking-wide text-[#f2d68a] truncate max-w-[138px]">
              {hud.zoneId === 'prontera' ? hud.district : hud.zoneName}
            </div>
            <div className="font-mono-tabular text-[10px] text-[#b8af9e]">
              {hud.x},{hud.z}
            </div>
          </div>
          {hud.zoneId !== 'prontera' && (
            <div className="text-[10px] text-[#b9c6d8] truncate max-w-[165px]">
              {hud.district}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-[#dfd6c3]">
            <span>Lv.{hud.level}</span>
            <span className="text-[#f2cf70]">{hud.zeny} Z</span>
            <span className="text-[#b8c4d4]">{hud.kills}x</span>
          </div>
          <div className="w-full h-1 rounded-full bg-[#0b1018] overflow-hidden">
            <div
              className="h-full bg-[#5ea3e6] transition-all duration-150"
              style={{ width: `${expPct}%` }}
            />
          </div>
        </div>
        <PronteraMinimap
          zoneId={hud.zoneId}
          playerX={hud.x}
          playerZ={hud.z}
          camYaw={hud.camYaw}
          onMapClick={onMinimapWalk}
        />
      </div>

      {/* Top-Right Compact Utility & Sword Attack Icon Buttons */}
      <div className="fixed top-4 right-4 pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Útok mečem [Mezerník / F]"
          title="Útok mečem [Mezerník / F]"
          onClick={(e) => {
            e.currentTarget.blur();
            onAttack();
          }}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#2b1f22]/92 hover:bg-[#8a2e2e] text-[#ffd47a] border border-[#d69a4e]/55 shadow-md transition-colors cursor-pointer"
        >
          <Sword className="w-4 h-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Otočit kameru na sever [C]"
          title="Otočit kameru na sever [C]"
          onClick={(e) => {
            e.currentTarget.blur();
            onResetNorth();
          }}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#131924]/92 hover:bg-[#232f42] text-[#f2d68a] border border-[#b99b63]/45 shadow-md transition-colors cursor-pointer"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label={muted ? 'Zapnout zvuk [M]' : 'Ztlumit zvuk [M]'}
          title={muted ? 'Zapnout zvuk [M]' : 'Ztlumit zvuk [M]'}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#131924]/92 hover:bg-[#232f42] text-[#f2d68a] border border-[#b99b63]/45 shadow-md transition-colors cursor-pointer"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 max-w-[min(1360px,97vw)] pointer-events-auto transition-transform duration-200 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%+16px)]' : 'translate-y-0'
        }`}
      >
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            tabIndex={-1}
            aria-expanded={!dockCollapsed}
            onClick={(e) => {
              e.currentTarget.blur();
              setDockCollapsed((v) => !v);
            }}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 bg-[#131924]/94 hover:bg-[#232f42] text-[#e7dcc4] border border-[#b99b63]/40 shadow transition-transform cursor-pointer whitespace-nowrap ${
              dockCollapsed ? '-translate-y-12' : ''
            }`}
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[#f2d68a]" />
                <span>Zobrazit panel</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[#f2d68a]" />
                <span>Skrýt panel</span>
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#131924]/94 border border-[#b99b63]/45 shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
          {/* Quick-Travel Landmarks & Portals to 4 Kaldgard Fields */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full py-0.5">
            {hud.zoneId === 'prontera' ? (
              <>
                {LANDMARKS.slice(0, 5).map((lm) => {
                  const shortName = lm.name
                    .replace('Centrální kašna', 'Kašna')
                    .replace('Velké tržiště', 'Tržiště')
                    .replace('Cech rytířů', 'Cech')
                    .replace('Kaldgard', '')
                    .replace('U Zlatého gryfa', '')
                    .trim();
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      tabIndex={-1}
                      aria-label={lm.name}
                      title={lm.name}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onSelectLandmark(lm.id);
                      }}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#ede3cf] hover:text-[#1a140a] hover:bg-[#e2bc62] bg-[#1f293a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {shortName}
                    </button>
                  );
                })}
                {activePortals.map((p) => {
                  const dirShort: Record<string, string> = {
                    prt_fild08: 'Jih: Louky',
                    prt_fild06: 'Východ: Údolí',
                    prt_fild05: 'Západ: Pastviny',
                    prt_fild01: 'Sever: Hvozd',
                  };
                  const shortLabel = dirShort[p.toZone] ?? p.label.split('(')[0].trim();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      tabIndex={-1}
                      aria-label={p.label}
                      title={p.subtitle}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onWarpZone(p.toZone, p.targetX, p.targetZ, p.targetYaw);
                      }}
                      className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#c8f7df] hover:text-[#0d1c15] hover:bg-[#5ce0a8] bg-[#18332c] border border-[#38b889]/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onWarpZone('prontera');
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#1a140a] bg-[#e2bc62] hover:bg-[#f5d47a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Zpět do Kaldgardu
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectLandmark(`${hud.zoneId}_crossroads`);
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#ede3cf] hover:text-[#1a140a] hover:bg-[#e2bc62] bg-[#1f293a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Rozcestí
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectLandmark(`${hud.zoneId}_bridge`);
                  }}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#ede3cf] hover:text-[#1a140a] hover:bg-[#e2bc62] bg-[#1f293a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Most
                </button>
                {activePortals
                  .filter((p) => p.toZone !== 'prontera')
                  .map((p) => {
                    const shortName = p.label
                      .replace('Východní kaldgardské údolí', 'Východ')
                      .replace('Západní kaldgardské pastviny', 'Západ')
                      .replace('Cesta k Severnímu hvozdu', 'Sever')
                      .replace('Jižní kaldgardské louky', 'Jih')
                      .replace('Severní kaldgardský hvozd', 'Sever')
                      .replace('Portál na Jižní louky', 'Jih');
                    return (
                      <button
                        key={p.id}
                        type="button"
                        tabIndex={-1}
                        title={p.subtitle}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onWarpZone(p.toZone, p.targetX, p.targetZ, p.targetYaw);
                        }}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-[#c8f7df] hover:text-[#0d1c15] hover:bg-[#5ce0a8] bg-[#18332c] border border-[#38b889]/35 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {shortName}
                      </button>
                    );
                  })}
              </>
            )}
          </div>

          <div className="hidden lg:block w-px h-6 bg-[#b99b63]/25 shrink-0" />

          {/* Time of Day, Weather & Camera Presets */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0c1119] border border-[#b99b63]/20">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectTimeOfDay(opt.id);
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    timeOfDay === opt.id
                      ? 'bg-[#e2bc62] text-[#1a140a]'
                      : 'text-[#cfc4ae] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0c1119] border border-[#b99b63]/20">
              {WEATHER_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectWeather(id);
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    weather === id
                      ? 'bg-[#4f7ba8] text-white'
                      : 'text-[#cfc4ae] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
              {weather === 'rain' && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Vyvolat blesk"
                  title="Vyvolat blesk"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onTriggerLightning();
                  }}
                  className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 bg-[#293a52] hover:bg-[#5e7da6] text-[#ffe28a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Blesk</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0c1119] border border-[#b99b63]/20">
              {CAMERA_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectCameraPreset(opt.id);
                  }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    cameraPreset === opt.id
                      ? 'bg-[#365a8a] text-white'
                      : 'text-[#cfc4ae] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
