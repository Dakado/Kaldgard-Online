import React from 'react';
import { BUILDINGS, CITY_WALL_POS } from '../world/pronteraLayout';

interface PronteraMinimapProps {
  playerX: number;
  playerZ: number;
  camYaw: number;
  onMapClick: (worldX: number, worldZ: number) => void;
}

const MAP_EXTENT = 92; // [-92..92] meters mapped to [0..140] SVG viewBox
const SIZE = 140;

function toSvg(v: number): number {
  return ((v + MAP_EXTENT) / (MAP_EXTENT * 2)) * SIZE;
}

function toWorld(px: number): number {
  return (px / SIZE) * (MAP_EXTENT * 2) - MAP_EXTENT;
}

export const PronteraMinimap: React.FC<PronteraMinimapProps> = ({
  playerX,
  playerZ,
  camYaw,
  onMapClick,
}) => {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * SIZE;
    const sy = ((e.clientY - rect.top) / rect.height) * SIZE;
    onMapClick(toWorld(sx), toWorld(sy));
  };

  const px = toSvg(playerX);
  const pz = toSvg(playerZ);
  const camDeg = (-camYaw * 180) / Math.PI;
  const wallMin = toSvg(-CITY_WALL_POS);
  const wallMax = toSvg(CITY_WALL_POS);
  const wallSpan = wallMax - wallMin;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      onClick={handleClick}
      role="img"
      aria-label="Minimapa města Prontera — kliknutím vyberete cíl cesty"
      className="w-[132px] h-[132px] rounded-lg cursor-crosshair block border border-[#b99b63]/45 bg-[#29442a]"
    >
      {/* Moat outer water ring */}
      <rect
        x={toSvg(-83)}
        y={toSvg(-83)}
        width={toSvg(83) - toSvg(-83)}
        height={toSvg(83) - toSvg(-83)}
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
      <rect x={toSvg(-6.5)} y={toSvg(-64)} width={toSvg(6.5) - toSvg(-6.5)} height={toSvg(92) - toSvg(-64)} fill="#cbb994" />
      <rect x={toSvg(-92)} y={toSvg(-6.5)} width={toSvg(92) - toSvg(-92)} height={toSvg(6.5) - toSvg(-6.5)} fill="#cbb994" />
      <rect x={toSvg(-16)} y={toSvg(-16)} width={toSvg(16) - toSvg(-16)} height={toSvg(16) - toSvg(-16)} fill="#d6c5a0" />
      <rect x={toSvg(-39)} y={toSvg(-58)} width={toSvg(39) - toSvg(-39)} height={toSvg(58) - toSvg(-58)} fill="none" stroke="#cbb994" strokeWidth={5.2} />
      <rect x={toSvg(-58)} y={toSvg(-39)} width={toSvg(58) - toSvg(-58)} height={toSvg(39) - toSvg(-39)} fill="none" stroke="#cbb994" strokeWidth={5.2} />

      {/* Citadel Perimeter Walls with Gate Gaps */}
      <rect
        x={wallMin}
        y={wallMin}
        width={wallSpan}
        height={wallSpan}
        fill="none"
        stroke="#e6dcc6"
        strokeWidth={2.6}
      />
      {/* Gate openings */}
      <rect x={toSvg(-6.5)} y={wallMax - 2} width={toSvg(6.5) - toSvg(-6.5)} height={4} fill="#cbb994" />
      <rect x={wallMin - 2} y={toSvg(-6.5)} width={4} height={toSvg(6.5) - toSvg(-6.5)} fill="#cbb994" />
      <rect x={wallMax - 2} y={toSvg(-6.5)} width={4} height={toSvg(6.5) - toSvg(-6.5)} fill="#cbb994" />

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
            x={toSvg(b.x - bw / 2)}
            y={toSvg(b.z - bd / 2)}
            width={toSvg(b.x + bw / 2) - toSvg(b.x - bw / 2)}
            height={toSvg(b.z + bd / 2) - toSvg(b.z - bd / 2)}
            fill={fill}
            stroke="#1f252e"
            strokeWidth={0.7}
          />
        );
      })}

      {/* Central Fountain */}
      <circle cx={toSvg(0)} cy={toSvg(0)} r={3.8} fill="#5ec2e6" stroke="#f5efe2" strokeWidth={1} />

      {/* Camera Viewing Cone */}
      <g transform={`translate(${px}, ${pz}) rotate(${camDeg})`}>
        <path d="M 0 0 L -10 -18 A 20 20 0 0 1 10 -18 Z" fill="rgba(255, 224, 130, 0.28)" />
        <circle cx={0} cy={0} r={3.6} fill="#ffdf6b" stroke="#161d29" strokeWidth={1.3} />
      </g>
    </svg>
  );
};
