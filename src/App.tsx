/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Trophy, AlertCircle, Zap, Moon, Sun } from 'lucide-react';

// Constants
const BUBBLE_RADIUS = 20;
const GRID_COLS = 10;
const GRID_ROWS = 14;
const COLORS = ['#FF5F5D', '#3FC1C0', '#20AD65', '#9452A5', '#F8C02E'];
const SHOTS_BEFORE_NEW_ROW = 5;

type Bubble = {
  x: number;
  y: number;
  color: string;
  vx?: number;
  vy?: number;
  alpha?: number;
  scale?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
};

type GridBubble = Bubble | null;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'playing' | 'gameover' | 'victory'>('playing');
  const [nextColor, setNextColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [missedShots, setMissedShots] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Game state refs
  const nextColorRef = useRef(nextColor);
  const gameStateRef = useRef(gameState);
  const isDarkModeRef = useRef(isDarkMode);

  useEffect(() => {
    nextColorRef.current = nextColor;
  }, [nextColor]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isDarkModeRef.current = isDarkMode;
  }, [isDarkMode]);

  const gridRef = useRef<GridBubble[][]>([]);
  const activeBubbleRef = useRef<Bubble | null>(null);
  const fallingBubblesRef = useRef<Bubble[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);
  const cannonRef = useRef({ angle: 0, recoil: 0 });

  // Initialize grid
  const initGrid = () => {
    const newGrid: GridBubble[][] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      newGrid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        if (row < 5) {
          const { x, y } = getBubbleCoords(row, col);
          newGrid[row][col] = { x, y, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
        } else {
          newGrid[row][col] = null;
        }
      }
    }
    gridRef.current = newGrid;
    setScore(0);
    setGameState('playing');
    setMissedShots(0);
    activeBubbleRef.current = null;
    fallingBubblesRef.current = [];
    particlesRef.current = [];
  };

  const getBubbleCoords = (row: number, col: number) => {
    const xOffset = row % 2 === 0 ? BUBBLE_RADIUS : BUBBLE_RADIUS * 2;
    return {
      x: xOffset + col * (BUBBLE_RADIUS * 2),
      y: BUBBLE_RADIUS + row * (BUBBLE_RADIUS * 1.75),
    };
  };

  const getGridPos = (x: number, y: number) => {
    const row = Math.round((y - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 1.75));
    const xOffset = row % 2 === 0 ? BUBBLE_RADIUS : BUBBLE_RADIUS * 2;
    const col = Math.round((x - xOffset) / (BUBBLE_RADIUS * 2));
    return { row, col };
  };

  const checkCollision = (bubble: Bubble) => {
    if (bubble.y - BUBBLE_RADIUS <= 0) return true;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const target = gridRef.current[row][col];
        if (target) {
          const dx = bubble.x - target.x;
          const dy = bubble.y - target.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < BUBBLE_RADIUS * 1.8) return true;
        }
      }
    }
    return false;
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        color,
        life: 1,
        size: Math.random() * 4 + 2,
      });
    }
  };

  const snapToGrid = (bubble: Bubble) => {
    const { row, col } = getGridPos(bubble.x, bubble.y);
    const safeRow = Math.max(0, Math.min(GRID_ROWS - 1, row));
    const safeCol = Math.max(0, Math.min(GRID_COLS - 1, col));

    const { x, y } = getBubbleCoords(safeRow, safeCol);
    gridRef.current[safeRow][safeCol] = { x, y, color: bubble.color };

    handlePop(safeRow, safeCol);
    
    if (safeRow >= GRID_ROWS - 2) {
      setGameState('gameover');
    }

    let hasBubbles = false;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (gridRef.current[r][c]) hasBubbles = true;
      }
    }
    if (!hasBubbles) setGameState('victory');
  };

  const getNeighbors = (row: number, col: number) => {
    const neighbors = [];
    const offsets = row % 2 === 0 
      ? [[-1, 0], [-1, -1], [0, -1], [0, 1], [1, -1], [1, 0]]
      : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];

    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        neighbors.push({ row: nr, col: nc });
      }
    }
    return neighbors;
  };

  const handlePop = (row: number, col: number) => {
    const color = gridRef.current[row][col]?.color;
    if (!color) return;

    const cluster: { row: number, col: number }[] = [];
    const queue = [{ row, col }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.row},${current.col}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const bubble = gridRef.current[current.row][current.col];
      if (bubble && bubble.color === color) {
        cluster.push(current);
        const neighbors = getNeighbors(current.row, current.col);
        for (const n of neighbors) {
          queue.push(n);
        }
      }
    }

    if (cluster.length >= 3) {
      cluster.forEach(({ row, col }) => {
        const b = gridRef.current[row][col];
        if (b) createParticles(b.x, b.y, b.color);
        gridRef.current[row][col] = null;
      });
      setScore(prev => prev + cluster.length * 10);
      handleGravity();
    } else {
      setMissedShots(prev => {
        const next = prev + 1;
        if (next >= SHOTS_BEFORE_NEW_ROW) {
          addNewRow();
          return 0;
        }
        return next;
      });
    }
  };

  const handleGravity = () => {
    const connected = new Set<string>();
    const queue: { row: number, col: number }[] = [];

    for (let col = 0; col < GRID_COLS; col++) {
      if (gridRef.current[0][col]) {
        queue.push({ row: 0, col });
      }
    }

    while (queue.length > 0) {
      const { row, col } = queue.shift()!;
      const key = `${row},${col}`;
      if (connected.has(key)) continue;
      connected.add(key);

      const neighbors = getNeighbors(row, col);
      for (const n of neighbors) {
        if (gridRef.current[n.row][n.col]) {
          queue.push(n);
        }
      }
    }

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const b = gridRef.current[r][c];
        if (b && !connected.has(`${r},${c}`)) {
          fallingBubblesRef.current.push({
            ...b,
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 2,
            alpha: 1,
          });
          gridRef.current[r][c] = null;
        }
      }
    }
    if (fallingBubblesRef.current.length > 0) {
      setScore(prev => prev + fallingBubblesRef.current.length * 20);
    }
  };

  const addNewRow = () => {
    for (let r = GRID_ROWS - 1; r > 0; r--) {
      gridRef.current[r] = [...gridRef.current[r - 1]];
      for (let c = 0; c < GRID_COLS; c++) {
        const b = gridRef.current[r][c];
        if (b) {
          const { x, y } = getBubbleCoords(r, c);
          b.x = x;
          b.y = y;
        }
      }
    }
    gridRef.current[0] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const { x, y } = getBubbleCoords(0, c);
      gridRef.current[0][c] = { x, y, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
    }

    for (let c = 0; c < GRID_COLS; c++) {
      if (gridRef.current[GRID_ROWS - 2][c]) {
        setGameState('gameover');
      }
    }
  };

  const drawCannon = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const angle = cannonRef.current.angle;
    const recoil = cannonRef.current.recoil;

    ctx.save();
    ctx.translate(x, y);

    // Base
    ctx.fillStyle = '#374151';
    ctx.beginPath();
    ctx.arc(0, 0, 40, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.arc(0, 0, 25, Math.PI, 0);
    ctx.fill();

    // Barrel
    ctx.rotate(angle);
    ctx.translate(0, recoil);
    
    // Barrel body
    const gradient = ctx.createLinearGradient(-15, -50, 15, -50);
    gradient.addColorStop(0, '#4B5563');
    gradient.addColorStop(0.5, '#9CA3AF');
    gradient.addColorStop(1, '#4B5563');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(-15, -60, 30, 60, 5);
    ctx.fill();
    
    // Barrel tip
    ctx.fillStyle = '#1F2937';
    ctx.beginPath();
    ctx.roundRect(-18, -65, 36, 10, 2);
    ctx.fill();

    // Next Bubble inside barrel tip
    if (!activeBubbleRef.current && gameStateRef.current === 'playing') {
      ctx.fillStyle = nextColorRef.current;
      ctx.beginPath();
      ctx.arc(0, -75, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(-5, -80, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Update recoil
    if (cannonRef.current.recoil > 0) {
      cannonRef.current.recoil *= 0.85;
      if (cannonRef.current.recoil < 0.1) cannonRef.current.recoil = 0;
    }
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Cannon Angle
    const startX = canvas.width / 2;
    const startY = canvas.height - 40;
    const dx = mousePosRef.current.x - startX;
    const dy = mousePosRef.current.y - startY;
    cannonRef.current.angle = Math.atan2(dy, dx) + Math.PI / 2;

    // Draw Grid
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const bubble = gridRef.current[r][c];
        if (bubble) {
          ctx.fillStyle = bubble.color;
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath();
          ctx.arc(bubble.x - 6, bubble.y - 6, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw Particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Falling Bubbles
    fallingBubblesRef.current = fallingBubblesRef.current.filter(b => b.y < canvas.height + 50);
    fallingBubblesRef.current.forEach(b => {
      b.vy! += 0.2; // Gravity
      b.x += b.vx!;
      b.y += b.vy!;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Active Bubble
    if (activeBubbleRef.current) {
      const b = activeBubbleRef.current;
      b.x += b.vx!;
      b.y += b.vy!;

      if (b.x - BUBBLE_RADIUS <= 0 || b.x + BUBBLE_RADIUS >= canvas.width) {
        b.vx! *= -1;
      }

      if (checkCollision(b)) {
        snapToGrid(b);
        activeBubbleRef.current = null;
      } else {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BUBBLE_RADIUS - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Cannon
    drawCannon(ctx, canvas.width / 2, canvas.height - 40);

    // Draw Aim Line
    if (!activeBubbleRef.current && gameStateRef.current === 'playing') {
      ctx.setLineDash([8, 12]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = isDarkModeRef.current ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height - 40);
      const aimX = canvas.width / 2 + Math.cos(cannonRef.current.angle - Math.PI/2) * 1000;
      const aimY = canvas.height - 40 + Math.sin(cannonRef.current.angle - Math.PI/2) * 1000;
      ctx.lineTo(aimX, aimY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }

    // Dead line
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 100);
    ctx.lineTo(canvas.width, canvas.height - 100);
    ctx.stroke();
    ctx.setLineDash([]);

    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    initGrid();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleShoot = () => {
    if (activeBubbleRef.current || gameStateRef.current !== 'playing') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const startX = canvas.width / 2;
    const startY = canvas.height - 40;
    const dx = mousePosRef.current.x - startX;
    const dy = mousePosRef.current.y - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speed = 12;
    activeBubbleRef.current = {
      x: startX,
      y: startY,
      color: nextColorRef.current,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
    };

    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    cannonRef.current.recoil = 15;
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-4 font-sans text-slate-200">
      <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border-8 border-slate-800 relative">
        {/* Header */}
        <div className="bg-slate-800 p-6 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Zap className="w-6 h-6 text-indigo-400 fill-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Score</p>
              <p className="text-2xl font-black text-white tabular-nums">{score}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black">Next</p>
              <div className="flex justify-end mt-1">
                <motion.div 
                  key={nextColor}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-8 h-8 rounded-full border-2 border-white/20 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)]"
                  style={{ backgroundColor: nextColor }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className={`relative aspect-[10/14] cursor-crosshair overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <canvas
            ref={canvasRef}
            width={400}
            height={560}
            className="w-full h-full"
            onMouseMove={handleMouseMove}
            onClick={handleShoot}
          />

          {/* New Row Progress */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-300">
            <motion.div 
              className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              animate={{ width: `${(missedShots / SHOTS_BEFORE_NEW_ROW) * 100}%` }}
            />
          </div>

          {/* Overlays */}
          <AnimatePresence>
            {gameState !== 'playing' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-8 text-center z-50"
              >
                <motion.div 
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-slate-900 rounded-[2rem] p-10 shadow-2xl border-4 border-slate-700 w-full"
                >
                  {gameState === 'victory' ? (
                    <>
                      <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Trophy className="w-10 h-10 text-yellow-500" />
                      </div>
                      <h2 className="text-4xl font-black mb-2 text-white">VICTORY</h2>
                      <p className="text-slate-400 mb-8">All bubbles managed. You're the ultimate supervisor!</p>
                    </>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                      </div>
                      <h2 className="text-4xl font-black mb-2 text-white">GAME OVER</h2>
                      <p className="text-slate-400 mb-8">The bubbles reached the floor. Corporate is not happy!</p>
                    </>
                  )}
                  <button
                    onClick={initGrid}
                    className="group flex items-center justify-center gap-3 w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-500 transition-all active:scale-95 shadow-[0_10px_20px_rgba(79,70,229,0.3)]"
                  >
                    <RotateCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                    RESTART GAME
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Info */}
        <div className="p-4 bg-slate-800 text-center border-t border-slate-700">
          <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500 font-black">
            Aim with mouse • Click to fire • Match 3 colors
          </p>
        </div>
      </div>

      {/* Aesthetic Accents */}
      <div className="mt-12 text-center opacity-10 pointer-events-none select-none">
        <h1 className="text-7xl font-black tracking-tighter italic text-white">CANON X</h1>
      </div>
    </div>
  );
}
