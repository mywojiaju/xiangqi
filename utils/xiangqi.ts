import { BoardState, Color, Move, Piece, PieceType, Position, GameStatus } from "../types";

// --- Helpers ---
export const isPosEqual = (p1: Position, p2: Position) => p1.x === p2.x && p1.y === p2.y;
const isValidPos = (p: Position) => p.x >= 0 && p.x <= 8 && p.y >= 0 && p.y <= 9;

// --- Setup ---
export const createInitialBoard = (): BoardState => {
  return fenToBoard("rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR");
};

// --- Movement Logic ---

export const getPieceAt = (board: BoardState, pos: Position): Piece | null => {
  if (!isValidPos(pos)) return null;
  return board[pos.y][pos.x];
};

export const isValidMove = (board: BoardState, move: Move, turnColor: Color): boolean => {
  const { from, to } = move;
  const piece = getPieceAt(board, from);
  const target = getPieceAt(board, to);

  // Basic checks
  if (!piece || piece.color !== turnColor) return false;
  if (!isValidPos(to)) return false;
  if (from.x === to.x && from.y === to.y) return false;
  if (target && target.color === turnColor) return false; // Friendly fire

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  switch (piece.type) {
    case PieceType.GENERAL: // King
      // Must stay in palace (x: 3-5)
      if (to.x < 3 || to.x > 5) return false;
      // Black palace y: 0-2, Red palace y: 7-9
      if (piece.color === Color.BLACK && to.y > 2) return false;
      if (piece.color === Color.RED && to.y < 7) return false;
      return (adx + ady === 1);

    case PieceType.ADVISOR:
      if (to.x < 3 || to.x > 5) return false;
      if (piece.color === Color.BLACK && to.y > 2) return false;
      if (piece.color === Color.RED && to.y < 7) return false;
      return (adx === 1 && ady === 1);

    case PieceType.ELEPHANT:
      if (piece.color === Color.BLACK && to.y > 4) return false; // Cant cross river
      if (piece.color === Color.RED && to.y < 5) return false;
      if (adx !== 2 || ady !== 2) return false;
      // Check eye
      if (getPieceAt(board, { x: from.x + dx / 2, y: from.y + dy / 2 })) return false;
      return true;

    case PieceType.HORSE:
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return false;
      // Check leg
      const legPos = { 
        x: adx === 2 ? from.x + dx / 2 : from.x,
        y: ady === 2 ? from.y + dy / 2 : from.y
      };
      if (getPieceAt(board, legPos)) return false;
      return true;

    case PieceType.ROOK:
      if (from.x !== to.x && from.y !== to.y) return false;
      return countPiecesBetween(board, from, to) === 0;

    case PieceType.CANNON:
      if (from.x !== to.x && from.y !== to.y) return false;
      const cnt = countPiecesBetween(board, from, to);
      if (target) {
        return cnt === 1; // Capture needs 1 screen
      } else {
        return cnt === 0; // Move needs 0 screens
      }

    case PieceType.SOLDIER:
      const forward = piece.color === Color.RED ? -1 : 1;
      
      // Can't move backwards
      if (piece.color === Color.RED && dy > 0) return false;
      if (piece.color === Color.BLACK && dy < 0) return false;

      // Before river: only forward
      const crossedRiver = piece.color === Color.RED ? from.y <= 4 : from.y >= 5;
      
      if (!crossedRiver) {
         return dx === 0 && dy === forward;
      } else {
         // After river: forward or side, 1 step
         return (Math.abs(dx) + Math.abs(dy)) === 1;
      }
  }
  return false;
};

const countPiecesBetween = (board: BoardState, p1: Position, p2: Position): number => {
  let count = 0;
  if (p1.x === p2.x) {
    const min = Math.min(p1.y, p2.y);
    const max = Math.max(p1.y, p2.y);
    for (let y = min + 1; y < max; y++) {
      if (board[y][p1.x]) count++;
    }
  } else if (p1.y === p2.y) {
    const min = Math.min(p1.x, p2.x);
    const max = Math.max(p1.x, p2.x);
    for (let x = min + 1; x < max; x++) {
      if (board[p1.y][x]) count++;
    }
  }
  return count;
};

export const getValidMoves = (board: BoardState, turn: Color): Move[] => {
  const moves: Move[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece && piece.color === turn) {
        // Check all board squares for validity
        for (let ty = 0; ty < 10; ty++) {
          for (let tx = 0; tx < 9; tx++) {
            const move = { from: { x, y }, to: { x: tx, y: ty } };
            if (isValidMove(board, move, turn)) {
                const tempBoard = simulateMove(board, move);
                // You cannot make a move that leaves your general checked
                if (!isCheck(tempBoard, turn) && !areGeneralsFacing(tempBoard)) {
                    moves.push(move);
                }
            }
          }
        }
      }
    }
  }
  return moves;
};

export const simulateMove = (board: BoardState, move: Move): BoardState => {
  const newBoard = board.map(row => [...row]);
  newBoard[move.to.y][move.to.x] = newBoard[move.from.y][move.from.x];
  newBoard[move.from.y][move.from.x] = null;
  return newBoard;
};

const findGeneral = (board: BoardState, color: Color): Position | null => {
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (p && p.type === PieceType.GENERAL && p.color === color) {
        return { x, y };
      }
    }
  }
  return null;
};

export const areGeneralsFacing = (board: BoardState): boolean => {
  const rGen = findGeneral(board, Color.RED);
  const bGen = findGeneral(board, Color.BLACK);
  
  if (!rGen || !bGen) return false; 
  
  if (rGen.x === bGen.x) {
    if (countPiecesBetween(board, rGen, bGen) === 0) return true;
  }
  return false;
};

export const isCheck = (board: BoardState, color: Color): boolean => {
    const generalPos = findGeneral(board, color);
    if(!generalPos) return true; 

    const enemyColor = color === Color.RED ? Color.BLACK : Color.RED;
    
    // Simple check: can any enemy piece attack the general?
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (p && p.color === enemyColor) {
                // Note: We pass false for "checkGeneralsFacing" inside isValidMove to avoid infinite recursion if we added it there
                // But here we just use basic isValidMove logic.
                // IMPORTANT: isValidMove for Cannon/Rook checks pieces between.
                if (isValidMove(board, {from: {x, y}, to: generalPos}, enemyColor)) {
                   return true;
                }
            }
        }
    }
    return false;
};

export const getGameStatus = (board: BoardState, turn: Color): GameStatus => {
    const moves = getValidMoves(board, turn);
    if (moves.length === 0) {
        return turn === Color.RED ? GameStatus.BLACK_WIN : GameStatus.RED_WIN;
    }
    // Simplified draw detection (not implementing full 50-move rule)
    return GameStatus.PLAYING;
};

// --- FEN Converter ---

export const boardToFen = (board: BoardState, turn: Color = Color.RED): string => {
  let fen = "";
  for (let y = 0; y < 10; y++) {
    let emptyCount = 0;
    for (let x = 0; x < 9; x++) {
      const p = board[y][x];
      if (!p) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fen += emptyCount;
          emptyCount = 0;
        }
        const char = p.type;
        fen += p.color === Color.RED ? char.toUpperCase() : char.toLowerCase();
      }
    }
    if (emptyCount > 0) fen += emptyCount;
    if (y < 9) fen += "/";
  }
  fen += ` ${turn === Color.RED ? 'w' : 'b'} - - 0 1`;
  return fen;
};

export const fenToBoard = (fen: string): BoardState => {
  const board: BoardState = Array(10).fill(null).map(() => Array(9).fill(null));
  const rows = fen.split(' ')[0].split('/');
  
  rows.forEach((rowStr, y) => {
    let x = 0;
    for (const char of rowStr) {
      if (/\d/.test(char)) {
        x += parseInt(char);
      } else {
        const color = char === char.toUpperCase() ? Color.RED : Color.BLACK;
        const type = char.toLowerCase() as PieceType;
        if (x < 9) {
            board[y][x] = { type, color, id: `${x}-${y}-${Math.random()}` };
            x++;
        }
      }
    }
  });
  return board;
};