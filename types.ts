export enum Color {
  RED = 'r',
  BLACK = 'b',
}

export enum PieceType {
  GENERAL = 'k', // King/General (Shuai/Jiang)
  ADVISOR = 'a', // (Shi)
  ELEPHANT = 'b', // (Xiang)
  HORSE = 'n', // (Ma)
  ROOK = 'r', // (Che)
  CANNON = 'c', // (Pao)
  SOLDIER = 'p', // (Bing/Zu)
}

export interface Piece {
  type: PieceType;
  color: Color;
  id?: string; // Unique ID for React keys
}

export interface Position {
  x: number; // Column (0-8)
  y: number; // Row (0-9)
}

export interface Move {
  from: Position;
  to: Position;
  score?: number;
}

export enum GameStatus {
  PLAYING = 'playing',
  RED_WIN = 'red_win',
  BLACK_WIN = 'black_win',
  DRAW = 'draw',
}

// 10 rows, 9 columns
export type BoardState = (Piece | null)[][];

export const INITIAL_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";