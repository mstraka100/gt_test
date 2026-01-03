import { useState, useEffect, useCallback, useRef } from 'react';

// Board dimensions
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 24;

// Tetromino shapes and colors
const TETROMINOES = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f5ff' },
  O: { shape: [[1, 1], [1, 1]], color: '#ffff00' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },
};

type TetrominoType = keyof typeof TETROMINOES;
type Board = (string | null)[][];

interface Piece {
  type: TetrominoType;
  shape: number[][];
  x: number;
  y: number;
  color: string;
}

function createEmptyBoard(): Board {
  return Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null));
}

function getRandomTetromino(): TetrominoType {
  const types = Object.keys(TETROMINOES) as TetrominoType[];
  return types[Math.floor(Math.random() * types.length)];
}

function createPiece(type: TetrominoType): Piece {
  const tetromino = TETROMINOES[type];
  return {
    type,
    shape: tetromino.shape.map(row => [...row]),
    x: Math.floor((BOARD_WIDTH - tetromino.shape[0].length) / 2),
    y: 0,
    color: tetromino.color,
  };
}

function rotatePiece(piece: Piece): Piece {
  const rows = piece.shape.length;
  const cols = piece.shape[0].length;
  const rotated = Array(cols).fill(null).map(() => Array(rows).fill(0));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rotated[c][rows - 1 - r] = piece.shape[r][c];
    }
  }

  return { ...piece, shape: rotated };
}

function isValidPosition(board: Board, piece: Piece, offsetX = 0, offsetY = 0): boolean {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c]) {
        const newX = piece.x + c + offsetX;
        const newY = piece.y + r + offsetY;

        if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
          return false;
        }
        if (newY >= 0 && board[newY][newX]) {
          return false;
        }
      }
    }
  }
  return true;
}

function placePiece(board: Board, piece: Piece): Board {
  const newBoard = board.map(row => [...row]);
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (piece.shape[r][c] && piece.y + r >= 0) {
        newBoard[piece.y + r][piece.x + c] = piece.color;
      }
    }
  }
  return newBoard;
}

function clearLines(board: Board): { board: Board; linesCleared: number } {
  const newBoard = board.filter(row => row.some(cell => !cell));
  const linesCleared = BOARD_HEIGHT - newBoard.length;

  while (newBoard.length < BOARD_HEIGHT) {
    newBoard.unshift(Array(BOARD_WIDTH).fill(null));
  }

  return { board: newBoard, linesCleared };
}

function calculateScore(linesCleared: number, level: number): number {
  const baseScores = [0, 100, 300, 500, 800];
  return baseScores[linesCleared] * (level + 1);
}

export default function TetrisGame() {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [currentPiece, setCurrentPiece] = useState<Piece | null>(null);
  const [nextPiece, setNextPiece] = useState<TetrominoType>(getRandomTetromino);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const gameRef = useRef<HTMLDivElement>(null);

  const spawnPiece = useCallback(() => {
    const piece = createPiece(nextPiece);
    setNextPiece(getRandomTetromino());

    if (!isValidPosition(board, piece)) {
      setGameOver(true);
      setIsPlaying(false);
      return null;
    }

    return piece;
  }, [board, nextPiece]);

  const startGame = useCallback(() => {
    const newBoard = createEmptyBoard();
    setBoard(newBoard);
    setScore(0);
    setLines(0);
    setLevel(0);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);

    const firstType = getRandomTetromino();
    setNextPiece(getRandomTetromino());
    setCurrentPiece(createPiece(firstType));

    gameRef.current?.focus();
  }, []);

  const moveDown = useCallback(() => {
    if (!currentPiece || isPaused || gameOver) return;

    if (isValidPosition(board, currentPiece, 0, 1)) {
      setCurrentPiece({ ...currentPiece, y: currentPiece.y + 1 });
    } else {
      // Place piece and spawn new one
      const newBoard = placePiece(board, currentPiece);
      const { board: clearedBoard, linesCleared } = clearLines(newBoard);

      setBoard(clearedBoard);

      if (linesCleared > 0) {
        const newLines = lines + linesCleared;
        setLines(newLines);
        setScore(prev => prev + calculateScore(linesCleared, level));
        setLevel(Math.floor(newLines / 10));
      }

      const newPiece = spawnPiece();
      setCurrentPiece(newPiece);
    }
  }, [board, currentPiece, isPaused, gameOver, level, lines, spawnPiece]);

  const moveLeft = useCallback(() => {
    if (!currentPiece || isPaused || gameOver) return;
    if (isValidPosition(board, currentPiece, -1, 0)) {
      setCurrentPiece({ ...currentPiece, x: currentPiece.x - 1 });
    }
  }, [board, currentPiece, isPaused, gameOver]);

  const moveRight = useCallback(() => {
    if (!currentPiece || isPaused || gameOver) return;
    if (isValidPosition(board, currentPiece, 1, 0)) {
      setCurrentPiece({ ...currentPiece, x: currentPiece.x + 1 });
    }
  }, [board, currentPiece, isPaused, gameOver]);

  const rotate = useCallback(() => {
    if (!currentPiece || isPaused || gameOver) return;
    const rotated = rotatePiece(currentPiece);

    // Try rotation, with wall kicks
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (isValidPosition(board, rotated, kick, 0)) {
        setCurrentPiece({ ...rotated, x: rotated.x + kick });
        return;
      }
    }
  }, [board, currentPiece, isPaused, gameOver]);

  const hardDrop = useCallback(() => {
    if (!currentPiece || isPaused || gameOver) return;

    let dropDistance = 0;
    while (isValidPosition(board, currentPiece, 0, dropDistance + 1)) {
      dropDistance++;
    }

    const droppedPiece = { ...currentPiece, y: currentPiece.y + dropDistance };
    const newBoard = placePiece(board, droppedPiece);
    const { board: clearedBoard, linesCleared } = clearLines(newBoard);

    setBoard(clearedBoard);
    setScore(prev => prev + dropDistance * 2 + calculateScore(linesCleared, level));

    if (linesCleared > 0) {
      const newLines = lines + linesCleared;
      setLines(newLines);
      setLevel(Math.floor(newLines / 10));
    }

    const newPiece = spawnPiece();
    setCurrentPiece(newPiece);
  }, [board, currentPiece, isPaused, gameOver, level, lines, spawnPiece]);

  const togglePause = useCallback(() => {
    if (!isPlaying || gameOver) return;
    setIsPaused(prev => !prev);
  }, [isPlaying, gameOver]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying) {
        if (e.key === 'Enter' || e.key === ' ') {
          startGame();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveLeft();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveRight();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
        case 'p':
        case 'P':
        case 'Escape':
          e.preventDefault();
          togglePause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, moveLeft, moveRight, moveDown, rotate, hardDrop, togglePause, startGame]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || isPaused || gameOver) return;

    const speed = Math.max(100, 1000 - level * 100);
    const interval = setInterval(moveDown, speed);

    return () => clearInterval(interval);
  }, [isPlaying, isPaused, gameOver, level, moveDown]);

  // Render the board with current piece
  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]);

    // Add current piece to display
    if (currentPiece) {
      for (let r = 0; r < currentPiece.shape.length; r++) {
        for (let c = 0; c < currentPiece.shape[r].length; c++) {
          if (currentPiece.shape[r][c]) {
            const y = currentPiece.y + r;
            const x = currentPiece.x + c;
            if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
              displayBoard[y][x] = currentPiece.color;
            }
          }
        }
      }

      // Add ghost piece (drop preview)
      let ghostY = currentPiece.y;
      while (isValidPosition(board, { ...currentPiece, y: ghostY + 1 })) {
        ghostY++;
      }

      if (ghostY !== currentPiece.y) {
        for (let r = 0; r < currentPiece.shape.length; r++) {
          for (let c = 0; c < currentPiece.shape[r].length; c++) {
            if (currentPiece.shape[r][c]) {
              const y = ghostY + r;
              const x = currentPiece.x + c;
              if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && !displayBoard[y][x]) {
                displayBoard[y][x] = currentPiece.color + '40'; // 25% opacity
              }
            }
          }
        }
      }
    }

    return displayBoard;
  };

  // Render next piece preview
  const renderNextPiece = () => {
    const tetromino = TETROMINOES[nextPiece];
    return (
      <div className="flex flex-col items-center">
        {tetromino.shape.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => (
              <div
                key={c}
                className="border border-gray-700"
                style={{
                  width: 16,
                  height: 16,
                  backgroundColor: cell ? tetromino.color : 'transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={gameRef}
      tabIndex={0}
      className="flex-1 flex items-center justify-center gap-8 p-4 outline-none bg-[var(--slack-bg)]"
    >
      {/* Game board */}
      <div className="relative">
        <div
          className="border-2 border-gray-600 bg-black"
          style={{
            width: BOARD_WIDTH * CELL_SIZE,
            height: BOARD_HEIGHT * CELL_SIZE,
          }}
        >
          {renderBoard().map((row, r) => (
            <div key={r} className="flex">
              {row.map((cell, c) => (
                <div
                  key={c}
                  className="border border-gray-900"
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: cell || 'transparent',
                    boxShadow: cell && !cell.endsWith('40') ? 'inset 2px 2px 4px rgba(255,255,255,0.3), inset -2px -2px 4px rgba(0,0,0,0.3)' : 'none',
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Overlays */}
        {!isPlaying && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">TETRIS</h2>
              <p className="text-gray-400 mb-4">Press ENTER or SPACE to start</p>
              <div className="text-gray-500 text-sm">
                <p>Arrow keys to move</p>
                <p>Up arrow to rotate</p>
                <p>Space for hard drop</p>
                <p>P or ESC to pause</p>
              </div>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">PAUSED</h2>
              <p className="text-gray-400">Press P or ESC to resume</p>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-500 mb-2">GAME OVER</h2>
              <p className="text-white text-lg mb-4">Score: {score}</p>
              <p className="text-gray-400">Press ENTER or SPACE to play again</p>
            </div>
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-4">
        {/* Score */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm mb-1">SCORE</h3>
          <p className="text-white text-2xl font-bold">{score.toLocaleString()}</p>
        </div>

        {/* Level */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm mb-1">LEVEL</h3>
          <p className="text-white text-2xl font-bold">{level}</p>
        </div>

        {/* Lines */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm mb-1">LINES</h3>
          <p className="text-white text-2xl font-bold">{lines}</p>
        </div>

        {/* Next piece */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-gray-400 text-sm mb-2">NEXT</h3>
          <div className="flex justify-center">
            {renderNextPiece()}
          </div>
        </div>

        {/* Controls hint */}
        <div className="bg-gray-800 p-4 rounded-lg text-xs text-gray-500">
          <p>Left/Right: Move</p>
          <p>Down: Soft drop</p>
          <p>Up: Rotate</p>
          <p>Space: Hard drop</p>
          <p>P/Esc: Pause</p>
        </div>
      </div>
    </div>
  );
}
