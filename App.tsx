import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  BoardState, Color, Piece, Position, GameStatus, PieceType 
} from './types';
import { 
  createInitialBoard, getValidMoves, isValidMove, simulateMove, 
  getGameStatus, boardToFen, isPosEqual 
} from './utils/xiangqi';
import { getBestMove } from './utils/ai';

// --- Components ---

const PieceView = ({ piece, selected }: { piece: Piece, selected: boolean }) => {
  const isRed = piece.color === Color.RED;
  
  // Chinese Characters Mapping
  const chars: Record<string, Record<PieceType, string>> = {
    [Color.RED]: {
      [PieceType.GENERAL]: '帅',
      [PieceType.ADVISOR]: '仕',
      [PieceType.ELEPHANT]: '相',
      [PieceType.HORSE]: '马',
      [PieceType.ROOK]: '车',
      [PieceType.CANNON]: '炮',
      [PieceType.SOLDIER]: '兵',
    },
    [Color.BLACK]: {
      [PieceType.GENERAL]: '将',
      [PieceType.ADVISOR]: '士',
      [PieceType.ELEPHANT]: '象',
      [PieceType.HORSE]: '马',
      [PieceType.ROOK]: '车',
      [PieceType.CANNON]: '炮',
      [PieceType.SOLDIER]: '卒',
    }
  };

  return (
    <div 
      className={`
        w-[90%] h-[90%] rounded-full flex items-center justify-center 
        shadow-md border-2 cursor-pointer select-none transition-transform
        ${selected ? 'scale-110 ring-4 ring-yellow-400 z-10' : 'hover:scale-105'}
        ${isRed ? 'bg-[#f0d9b5] border-red-600 text-red-600' : 'bg-[#f0d9b5] border-black text-black'}
      `}
      style={{
        boxShadow: '2px 2px 4px rgba(0,0,0,0.3), inset -2px -2px 4px rgba(0,0,0,0.1)'
      }}
    >
      <span className="text-2xl font-bold font-calligraphy" style={{ fontFamily: '"Ma Shan Zheng", cursive' }}>
        {chars[piece.color][piece.type]}
      </span>
    </div>
  );
};

export default function App() {
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [turn, setTurn] = useState<Color>(Color.RED); // Player is RED
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [validDestinations, setValidDestinations] = useState<Position[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [advisorMessage, setAdvisorMessage] = useState<string>("");
  const [thinking, setThinking] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  
  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    if (process.env.API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }, []);

  // AI Turn Handler
  useEffect(() => {
    if (turn === Color.BLACK && gameStatus === GameStatus.PLAYING) {
      setAiThinking(true);
      // Small delay for UX
      setTimeout(() => {
        const bestMove = getBestMove(board, 3); // Depth 3
        if (bestMove) {
          const newBoard = simulateMove(board, bestMove);
          setBoard(newBoard);
          setTurn(Color.RED);
          setGameStatus(getGameStatus(newBoard, Color.RED));
        } else {
            // AI has no moves -> Red wins
            setGameStatus(GameStatus.RED_WIN);
        }
        setAiThinking(false);
      }, 500);
    }
  }, [turn, board, gameStatus]);

  const handleSquareClick = (x: number, y: number) => {
    if (gameStatus !== GameStatus.PLAYING || turn !== Color.RED || aiThinking) return;

    const clickedPiece = board[y][x];
    const isSelfPiece = clickedPiece && clickedPiece.color === turn;

    if (isSelfPiece) {
      // Select piece
      setSelectedPos({ x, y });
      // Calculate valid moves for highlighting
      const moves = getValidMoves(board, turn);
      const dests = moves
        .filter(m => isPosEqual(m.from, {x, y}))
        .map(m => m.to);
      setValidDestinations(dests);
    } else if (selectedPos) {
      // Try to move
      const move = { from: selectedPos, to: { x, y } };
      if (isValidMove(board, move, turn)) {
          // Double check validity (checkmate prevention etc)
          const moves = getValidMoves(board, turn);
          const isValid = moves.some(m => isPosEqual(m.from, selectedPos) && isPosEqual(m.to, {x, y}));
          
          if (isValid) {
            const newBoard = simulateMove(board, move);
            setBoard(newBoard);
            setTurn(Color.BLACK);
            setSelectedPos(null);
            setValidDestinations([]);
            setGameStatus(getGameStatus(newBoard, Color.BLACK));
          }
      }
    }
  };

  const askAdvisor = async () => {
    if (!aiRef.current) {
      setAdvisorMessage("请先配置 API Key (Process.env.API_KEY)");
      return;
    }
    setThinking(true);
    setAdvisorMessage("军师正在思考...");
    
    try {
      const fen = boardToFen(board, turn);
      const prompt = `Here is the current Xiangqi (Chinese Chess) board in FEN: ${fen}. It is ${turn === 'r' ? 'Red' : 'Black'}'s turn. 
      You are a Grandmaster advisor. Provide a brief, strategic advice for the current player in Chinese. 
      Keep it under 50 words. Focus on the most critical threat or opportunity.`;
      
      const response = await aiRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      setAdvisorMessage(response.text || "军师沉默不语。");
    } catch (e) {
      setAdvisorMessage("军师暂时无法回应。");
      console.error(e);
    } finally {
      setThinking(false);
    }
  };

  const restartGame = () => {
    setBoard(createInitialBoard());
    setTurn(Color.RED);
    setGameStatus(GameStatus.PLAYING);
    setAdvisorMessage("");
    setSelectedPos(null);
    setValidDestinations([]);
  };

  return (
    <div className="min-h-screen bg-[#fdf6e3] flex flex-col items-center py-8">
      <h1 className="text-4xl font-bold mb-2 text-amber-900 font-calligraphy">中国象棋</h1>
      
      <div className="flex gap-4 mb-6 items-center">
        <div className={`px-4 py-2 rounded-lg font-bold ${turn === Color.RED ? 'bg-red-100 text-red-700 border-2 border-red-500' : 'text-gray-500'}`}>
           {gameStatus === GameStatus.RED_WIN ? "红方胜利！" : "红方走棋"}
        </div>
        <div className={`px-4 py-2 rounded-lg font-bold ${turn === Color.BLACK ? 'bg-gray-200 text-black border-2 border-black' : 'text-gray-500'}`}>
           {gameStatus === GameStatus.BLACK_WIN ? "黑方胜利！" : aiThinking ? "黑方思考中..." : "黑方等待"}
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Board Wrapper */}
        <div className="relative bg-[#deb887] p-1 rounded shadow-2xl select-none" style={{ width: 'min(90vw, 500px)', aspectRatio: '9/10' }}>
           {/* Grid Lines SVG Layer */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 90 100">
              {/* Background */}
              <rect x="0" y="0" width="90" height="100" fill="#deb887" />
              
              {/* Border */}
              <rect x="4" y="4" width="82" height="92" fill="none" stroke="#5d4037" strokeWidth="0.5" />
              
              {/* Horizontal Lines */}
              {Array.from({ length: 10 }).map((_, i) => (
                <line key={`h-${i}`} x1="5" y1={5 + i * 10} x2="85" y2={5 + i * 10} stroke="#5d4037" strokeWidth="0.3" />
              ))}
              
              {/* Vertical Lines (Top) */}
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={`vt-${i}`} x1={15 + i * 10} y1="5" x2={15 + i * 10} y2="45" stroke="#5d4037" strokeWidth="0.3" />
              ))}
               {/* Vertical Lines (Bottom) */}
              {Array.from({ length: 7 }).map((_, i) => (
                <line key={`vb-${i}`} x1={15 + i * 10} y1="55" x2={15 + i * 10} y2="95" stroke="#5d4037" strokeWidth="0.3" />
              ))}
              {/* Outer Verticals (Full height) */}
              <line x1="5" y1="5" x2="5" y2="95" stroke="#5d4037" strokeWidth="0.3" />
              <line x1="85" y1="5" x2="85" y2="95" stroke="#5d4037" strokeWidth="0.3" />

              {/* Palaces */}
              {/* Top (Black) */}
              <line x1="35" y1="5" x2="55" y2="25" stroke="#5d4037" strokeWidth="0.3" />
              <line x1="55" y1="5" x2="35" y2="25" stroke="#5d4037" strokeWidth="0.3" />
              {/* Bottom (Red) */}
              <line x1="35" y1="75" x2="55" y2="95" stroke="#5d4037" strokeWidth="0.3" />
              <line x1="55" y1="75" x2="35" y2="95" stroke="#5d4037" strokeWidth="0.3" />

              {/* River Text */}
              <text x="25" y="52" fontSize="4" fill="#5d4037" fontFamily="SimSun" fontWeight="bold">楚 河</text>
              <text x="65" y="52" fontSize="4" fill="#5d4037" fontFamily="SimSun" fontWeight="bold" textAnchor="end">汉 界</text>
           </svg>

           {/* Pieces Grid */}
           <div className="relative w-full h-full grid grid-cols-9 grid-rows-10 z-10">
              {board.map((row, y) => 
                row.map((piece, x) => {
                  const isDest = validDestinations.some(p => p.x === x && p.y === y);
                  const isSelected = selectedPos?.x === x && selectedPos?.y === y;

                  return (
                    <div 
                      key={`${x}-${y}`} 
                      className="relative flex items-center justify-center w-full h-full"
                      onClick={() => handleSquareClick(x, y)}
                    >
                      {/* Destination Highlight */}
                      {isDest && (
                        <div className="absolute w-3 h-3 bg-green-500 rounded-full opacity-50 z-0 pointer-events-none animate-pulse" />
                      )}

                      {/* Piece */}
                      {piece && (
                        <PieceView piece={piece} selected={isSelected} />
                      )}
                    </div>
                  );
                })
              )}
           </div>
        </div>

        {/* Sidebar Controls */}
        <div className="flex flex-col gap-4 w-full max-w-[300px]">
           <div className="bg-white p-4 rounded-lg shadow-md border border-amber-200">
              <h2 className="font-bold text-lg text-amber-900 mb-2 flex items-center gap-2">
                <span>🛡️</span> 军师锦囊 (Gemini)
              </h2>
              <p className="text-sm text-gray-600 min-h-[60px] bg-gray-50 p-2 rounded border border-gray-200 mb-3 leading-relaxed">
                {advisorMessage || "点击下方按钮，寻求Gemini军师的战术建议..."}
              </p>
              <button 
                onClick={askAdvisor}
                disabled={thinking || gameStatus !== GameStatus.PLAYING}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded shadow transition-colors disabled:opacity-50"
              >
                {thinking ? "分析局势中..." : "求助军师"}
              </button>
           </div>

           <div className="bg-white p-4 rounded-lg shadow-md border border-amber-200">
             <h2 className="font-bold text-lg text-amber-900 mb-2">游戏控制</h2>
             <button 
                onClick={restartGame}
                className="w-full py-2 bg-stone-600 hover:bg-stone-700 text-white rounded shadow transition-colors"
              >
                重新开始
             </button>
             <div className="mt-4 text-xs text-gray-500 text-center">
               单机人机对战 (AI Level: 3)
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}