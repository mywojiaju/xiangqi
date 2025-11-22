import { BoardState, Color, Move, Piece, PieceType } from "../types";
import { getValidMoves, simulateMove, isCheck, getPieceAt, areGeneralsFacing } from "./xiangqi";

// Material values
const PIECE_VALUES: Record<PieceType, number> = {
  [PieceType.GENERAL]: 10000,
  [PieceType.ROOK]: 90,
  [PieceType.CANNON]: 45,
  [PieceType.HORSE]: 40,
  [PieceType.ELEPHANT]: 20,
  [PieceType.ADVISOR]: 20,
  [PieceType.SOLDIER]: 10,
};

// Position bonuses (Simplified)
const getPositionBonus = (piece: Piece, x: number, y: number): number => {
    // Advance soldiers get bonus
    if (piece.type === PieceType.SOLDIER) {
        if (piece.color === Color.BLACK && y > 4) return 20; // Crossed river
        if (piece.color === Color.RED && y < 5) return 20;
    }
    // Central cannons/horses get slight bonus
    if (piece.type === PieceType.CANNON || piece.type === PieceType.HORSE) {
        if (x >= 3 && x <= 5) return 5;
    }
    return 0;
};

const evaluateBoard = (board: BoardState): number => {
    let score = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (p) {
                const val = PIECE_VALUES[p.type] + getPositionBonus(p, x, y);
                score += p.color === Color.RED ? val : -val;
            }
        }
    }
    return score;
};

export const getBestMove = (board: BoardState, depth: number = 2): Move | null => {
    // AI plays BLACK (negative score is good for Black)
    // But Minimax usually maximizes for current player. 
    // Standard: Red maximizes, Black minimizes.
    const { move } = minimax(board, depth, -Infinity, Infinity, false);
    return move;
};

const minimax = (
    board: BoardState, 
    depth: number, 
    alpha: number, 
    beta: number, 
    isMaximizing: boolean
): { score: number, move: Move | null } => {
    
    if (depth === 0) {
        return { score: evaluateBoard(board), move: null };
    }

    const turn = isMaximizing ? Color.RED : Color.BLACK;
    const validMoves = getValidMoves(board, turn);

    if (validMoves.length === 0) {
        // Checkmate or Stalemate
        if (isCheck(board, turn)) {
            return { score: isMaximizing ? -100000 : 100000, move: null };
        }
        return { score: 0, move: null }; // Stalemate
    }

    // Simple move ordering: captures first (optimization)
    validMoves.sort((a, b) => {
        const targetA = getPieceAt(board, a.to);
        const targetB = getPieceAt(board, b.to);
        const valA = targetA ? PIECE_VALUES[targetA.type] : 0;
        const valB = targetB ? PIECE_VALUES[targetB.type] : 0;
        return valB - valA;
    });

    let bestMove: Move | null = null;

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of validMoves) {
            const newBoard = simulateMove(board, move);
            const evaluation = minimax(newBoard, depth - 1, alpha, beta, false).score;
            
            if (evaluation > maxEval) {
                maxEval = evaluation;
                bestMove = move;
            }
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
    } else {
        let minEval = Infinity;
        for (const move of validMoves) {
            const newBoard = simulateMove(board, move);
            const evaluation = minimax(newBoard, depth - 1, alpha, beta, true).score;
            
            if (evaluation < minEval) {
                minEval = evaluation;
                bestMove = move;
            }
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
    }
};