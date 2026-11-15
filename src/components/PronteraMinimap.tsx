import React, { useMemo } from 'react';
import {
  FIELD_MAPS,
  PRONTERA_PORTALS,
  ZoneId,
  getPortalsForZone,
  zoneCliffSlopeAt,
  zoneTrailMaskAt,
  zoneWaterDepthAt,
} from '../world/fieldMaps';
import { BUILDINGS, CITY_WALL_POS } from '../world/pronteraLayout';

interface PronteraMinimapProps {
  zoneId: ZoneId;
  playerX: number;
  playerZ: number;
  camYaw: number;
  onMapClick: (worldX: number, worldZ: number) => void;
}

const SIZE = 140;
const PRONTERA_EXTENT = 108;

function toSvg(v: number, extent: number): number {
  return ((v + extent) / (extent * 2)) * SIZE;
}

function toWorld(px: number, extent: number): number {
  return (px / SIZE) * (extent * 2) - extent;
}

/**
 * Bakes a Ragnarok-Online-inspired high-detail minimap bitmap for any Field Map:
 * sunlit olive-chartreuse meadows, winding ochre dirt trails, shadowed rocky cliff ridges,
 * deep navy water coves, border Prontera stone wall, and dense green tree clusters.
 */
function buildFieldMinimapDataUrl(zoneId: Exclude<ZoneId, 'prontera'>): string {
  if (typeof document === 'undefined') return '';
  const spec = FIELD_MAPS[zoneId];
  const res = 156;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const img = ctx.createImageData(res, res);
  const data = img.data;
  const ext = spec.playableExtent;

  for (let py = 0; py < res; py++) {
    const z = (py / (res - 1)) * (ext * 2) - ext;
    for (let px = 0; px < res; px++) {
      const x = (px / (res - 1)) * (ext * 2) - ext;
      const idx = (py * res + px) * 4;

      // Perimeter border framing cliffs
      if (Math.abs(x) > ext - 5 || Math.abs(z) > ext - 5) {
        data[idx] = 28;
        data[idx + 1] = 32;
        data[idx + 2] = 24;
        data[idx + 3] = 255;
        continue;
      }

      const water = zoneWaterDepthAt(zoneId, x, z);
      const slope = zoneCliffSlopeAt(zoneId, x, z);
      const trail = zoneTrailMaskAt(zoneId, x, z);
      const grain = Math.sin(x * 0.8 + z * 0.7) * 6;

      let r = 136 + grain;
      let g = 172 + grain;
      let b = 64 + grain * 0.4;

      if (trail > 0.25) {
        const t = Math.min(1, (trail - 0.25) / 0.55);
        r = r * (1 - t) + 234 * t;
        g = g * (1 - t) + 220 * t;
        b = b * (1 - t) + 148 * t;
      }

      if (slope > 0.40) {
        const c = Math.min(1, (slope - 0.40) / 0.35);
        r = r * (1 - c) + 42 * c;
        g = g * (1 - c) + 48 * c;
        b = b * (1 - c) + 34 * c;
      }

      if (water > 0.02) {
        r = 16;
        g = 36;
        b = 88;
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Stamp Tree clusters with dark drop shadow + leafy green crown
  for (const t of spec.trees) {
    const sx = ((t.x + ext) / (ext * 2)) * res;
    const sy = ((t.z + ext) / (ext * 2)) * res;
    const rad = Math.max(1.4, t.scale * 1.45);
    ctx.fillStyle = 'rgba(20, 34, 14, 0.45)';
    ctx.beginPath();
    ctx.arc(sx + 1.1, sy + 1.1, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.kind === 'pine' ? '#2c5424' : t.kind === 'birch' ? '#588c34' : '#3d6e28';
    ctx.beginPath();
    ctx.arc(sx, sy, rad * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  // City Stone Border Wall along adjacent Prontera edge
  ctx.fillStyle = '#5c5852';
  ctx.strokeStyle = '#1b1e22';
  ctx.lineWidth = 1.2;
  const wcSvg = ((spec.cityWallCoord + ext) / (ext * 2)) * res;
  if (spec.cityWallEdge === 'north' || spec.cityWallEdge === 'south') {
    ctx.fillRect(0, wcSvg - 3.5, res, 7);
    ctx.strokeRect(0, wcSvg - 3.5, res, 7);
    ctx.fillStyle = '#e8dc96';
    ctx.fillRect(res * 0.5 - 5, wcSvg - 4, 10, 8);
  } else {
    ctx.fillRect(wcSvg - 3.5, 0, 7, res);
    ctx.strokeRect(wcSvg - 3.5, 0, 7, res);
    ctx.fillStyle = '#e8dc96';
    ctx.fillRect(wcSvg - 4, res * 0.5 - 5, 8, 10);
  }

  return canvas.toDataURL();
}

export const PronteraMinimap: React.FC<PronteraMinimapProps> = ({
  zoneId,
  playerX,
  playerZ,
  camYaw,
  onMapClick,
}) => {
  const extent = zoneId === 'prontera' ? PRONTERA_EXTENT : FIELD_MAPS[zoneId].playableExtent;
  const portals = getPortalsForZone(zoneId);

  const fieldBgUrl = useMemo(() => {
    if (zoneId === 'prontera') return '';
    return buildFieldMinimapDataUrl(zoneId);
  }, [zoneId]);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SIZE;
    onMapClick(toWorld(sx, extent), toWorld(sy, extent));
  };

  const px = toSvg(playerX, extent);
  const pz = toSvg(playerZ, extent);
  const camDeg = (-camYaw * 180) / Math.PI;
  const wallMin = toSvg(-CITY_WALL_POS, extent);
  const wallMax = toSvg(CITY_WALL_POS, extent);
  const wallSpan = wallMax - wallMin;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      onClick={handleClick}
      role="img"
      aria-label={`Minimapa (${zoneId}) — kliknutím vyberete cíl cesty`}
      className="w-[136px] h-[136px] rounded-lg cursor-crosshair block border border-[#b99b63]/50 bg-[#233824]"
    >
      {zoneId === 'prontera' ? (
        <>
          {/* Moat outer water ring */}
          <rect
            x={toSvg(-83, extent)}
            y={toSvg(-83, extent)}
            width={toSvg(83, extent) - toSvg(-83, extent)}
            height={toSvg(83, extent) - toSvg(-83, extent)}
            fill="#245d78"
            rx={3}
          />

          {/* Inner city grass bed */}
          <rect
            x={wallMin}
            y={wallMin}
            width={wallSpan}
            height={wallSpan}
            fill="#44693a"
          />

          {/* Main Avenues & Inner Ring Cobblestone */}
          <rect
            x={toSvg(-6.5, extent)}
            y={toSvg(-64, extent)}
            width={toSvg(6.5, extent) - toSvg(-6.5, extent)}
            height={toSvg(104, extent) - toSvg(-64, extent)}
            fill="#cbb994"
          />
          <rect
            x={toSvg(-104, extent)}
            y={toSvg(-6.5, extent)}
            width={toSvg(104, extent) - toSvg(-104, extent)}
            height={toSvg(6.5, extent) - toSvg(-6.5, extent)}
            fill="#cbb994"
          />
          <rect
            x={toSvg(-16, extent)}
            y={toSvg(-16, extent)}
            width={toSvg(16, extent) - toSvg(-16, extent)}
            height={toSvg(16, extent) - toSvg(-16, extent)}
            fill="#d6c5a0"
          />
          <rect
            x={toSvg(-39, extent)}
            y={toSvg(-58, extent)}
            width={toSvg(39, extent) - toSvg(-39, extent)}
            height={toSvg(58, extent) - toSvg(-58, extent)}
            fill="none"
            stroke="#cbb994"
            strokeWidth={4.5}
          />
          <rect
            x={toSvg(-58, extent)}
            y={toSvg(-39, extent)}
            width={toSvg(58, extent) - toSvg(-58, extent)}
            height={toSvg(39, extent) - toSvg(-39, extent)}
            fill="none"
            stroke="#cbb994"
            strokeWidth={4.5}
          />

          {/* Citadel Perimeter Walls with Gate Gaps */}
          <rect
            x={wallMin}
            y={wallMin}
            width={wallSpan}
            height={wallSpan}
            fill="none"
            stroke="#e6dcc6"
            strokeWidth={2.2}
          />
          <rect x={toSvg(-6.5, extent)} y={wallMax - 2} width={toSvg(6.5, extent) - toSvg(-6.5, extent)} height={4} fill="#cbb994" />
          <rect x={wallMin - 2} y={toSvg(-6.5, extent)} width={4} height={toSvg(6.5, extent) - toSvg(-6.5, extent)} fill="#cbb994" />
          <rect x={wallMax - 2} y={toSvg(-6.5, extent)} width={4} height={toSvg(6.5, extent) - toSvg(-6.5, extent)} fill="#cbb994" />

          {/* Buildings */}
          {BUILDINGS.map((b) => {
            const rotated = Math.abs(Math.sin(b.rotY)) > 0.7;
            const bw = rotated ? b.depth : b.width;
            const bd = rotated ? b.width : b.depth;
            const fill =
              b.kind === 'castle'
                ? '#5278b0'
                : b.kind === 'cathedral'
                  ? '#5d8eb8'
                  : b.kind === 'chivalry'
                    ? '#788894'
                    : '#b56e52';
            return (
              <rect
                key={b.id}
                x={toSvg(b.x - bw / 2, extent)}
                y={toSvg(b.z - bd / 2, extent)}
                width={toSvg(b.x + bw / 2, extent) - toSvg(b.x - bw / 2, extent)}
                height={toSvg(b.z + bd / 2, extent) - toSvg(b.z - bd / 2, extent)}
                fill={fill}
                stroke="#1f252e"
                strokeWidth={0.6}
              />
            );
          })}

          {/* Central Fountain */}
          <circle cx={toSvg(0, extent)} cy={toSvg(0, extent)} r={3.4} fill="#5ec2e6" stroke="#f5efe2" strokeWidth={0.9} />

          {/* Cardinal Portal Red Dots */}
          {PRONTERA_PORTALS.map((p) => (
            <circle
              key={p.id}
              cx={toSvg(p.x, extent)}
              cy={toSvg(p.z, extent)}
              r={3.2}
              fill="#ef2323"
              stroke="#fff4e0"
              strokeWidth={0.8}
            />
          ))}
        </>
      ) : (
        <>
          {fieldBgUrl && (
            <image href={fieldBgUrl} x={0} y={0} width={SIZE} height={SIZE} preserveAspectRatio="none" />
          )}
          {/* Ragnarok Red Portal Markers */}
          {portals.map((p) => (
            <circle
              key={p.id}
              cx={toSvg(p.x, extent)}
              cy={toSvg(p.z, extent)}
              r={3.5}
              fill="#ef2323"
              stroke="#fff6e8"
              strokeWidth={0.9}
            />
          ))}
        </>
      )}

      {/* Camera Viewing Cone & Player Indicator */}
      <g transform={`translate(${px}, ${pz}) rotate(${camDeg})`}>
        <path d="M 0 0 L -10 -18 A 20 20 0 0 1 10 -18 Z" fill="rgba(255, 224, 130, 0.30)" />
        <circle cx={0} cy={0} r={3.5} fill="#ffdf6b" stroke="#161d29" strokeWidth={1.2} />
      </g>
    </svg>
  );
};
