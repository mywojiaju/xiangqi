
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  BoardState, Color, Piece, Position, GameStatus, PieceType, Move 
} from './types';
import { 
  createInitialBoard, getValidMoves, isValidMove, simulateMove, 
  getGameStatus, boardToFen, isPosEqual, getPieceAt, isCheck
} from './utils/xiangqi';
import { getBestMove } from './utils/ai';
import { soundManager } from './utils/sound';

// --- Components ---

const PieceView = ({ piece, selected, onClick }: { piece: Piece, selected: boolean, onClick: () => void }) => {
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
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`
        absolute rounded-full flex items-center justify-center
        shadow-lg cursor-pointer transition-transform duration-200
        ${selected ? 'scale-115 ring-4 ring-yellow-400 z-10' : 'hover:scale-105'}
        ${isRed ? 'bg-[#f0d9b5] text-red-700 border-4 border-red-700' : 'bg-[#f0d9b5] text-black border-4 border-black'}
      `}
      style={{
        width: '90%',
        height: '90%',
        left: '5%',
        top: '5%',
        fontFamily: '"Ma Shan Zheng", cursive', // Calligraphy font
      }}
    >
      {/* Inner Ring for realism */}
      <div className={`absolute w-[85%] h-[85%] rounded-full border-2 ${isRed ? 'border-red-700/30' : 'border-black/30'}`}></div>
      <span className="text-3xl md:text-4xl font-bold relative -top-[2px] select-none">
        {chars[piece.color][piece.type]}
      </span>
    </div>
  );
};

const BoardSquare = ({ x, y, children, onClick, isLastMove, isValidCandidate }: any) => {
  // Grid lines logic
  const isRiver = y === 4;
  
  return (
    <div 
      className="relative w-full h-full flex items-center justify-center" 
      onClick={onClick}
    >
      {/* Grid Lines */}
      <div className="absolute w-full h-0.5 bg-amber-800 z-0" style={{ display: (y === 4 && x < 8) ? 'none' : 'block' }}></div> {/* Horiz */}
      <div className="absolute h-full w-0.5 bg-amber-800 z-0" style={{ display: (y === 4 || y === 5) ? 'none' : 'block' }}></div> {/* Vert */}
      
      {/* River Fix: The vertical lines stop at the river, but horizontal lines on row 4 and 5 exist? 
          Actually standard board has gap in middle. We render a background grid image or SVG usually.
          Let's simplify: Render grid lines relative to center of cell.
      */}
    
      {/* Highlight Valid Move */}
      {isValidCandidate && !children && (
        <div className="absolute w-3 h-3 bg-green-500 rounded-full opacity-50 z-0 pointer-events-none"></div>
      )}
      
      {/* Last Move Highlight */}
      {isLastMove && (
        <div className="absolute w-full h-full bg-blue-200/30 animate-pulse z-0 pointer-events-none"></div>
      )}

      {children}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [turn, setTurn] = useState<Color>(Color.RED);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.PLAYING);
  const [lastMove, setLastMove] = useState<{from: Position, to: Position} | null>(null);
  const [advisorText, setAdvisorText] = useState<string>("");
  const [loadingAdvisor, setLoadingAdvisor] = useState(false);

  // Initialize Audio Context on first interaction
  useEffect(() => {
    const handleInteraction = () => soundManager.resume();
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, []);

  // AI Turn
  useEffect(() => {
    if (turn === Color.BLACK && gameStatus === GameStatus.PLAYING) {
      const timer = setTimeout(() => {
        const move = getBestMove(board, 3); // Depth 3
        if (move) {
          executeMove(move);
        } else {
          // No moves available for AI
          handleGameOver(Color.RED);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [turn, gameStatus, board]);

  const executeMove = (move: Move) => {
    const targetPiece = getPieceAt(board, move.to);
    
    // Play Sound
    if (targetPiece) {
      soundManager.playCapture();
    } else {
      soundManager.playMove();
    }

    const nextBoard = simulateMove(board, move);
    setBoard(nextBoard);
    setTurn(prev => prev === Color.RED ? Color.BLACK : Color.RED);
    setLastMove({ from: move.from, to: move.to });
    setSelectedPos(null);

    // Check Status
    const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
    
    // Check sound
    if (isCheck(nextBoard, nextTurn)) {
      soundManager.playCheck();
    }

    const status = getGameStatus(nextBoard, nextTurn);
    if (status !== GameStatus.PLAYING) {
      setGameStatus(status);
      if (status === GameStatus.RED_WIN) soundManager.playWin();
      else soundManager.playLoss();
    }
  };

  const handleGameOver = (winner: Color) => {
    setGameStatus(winner === Color.RED ? GameStatus.RED_WIN : GameStatus.BLACK_WIN);
    if (winner === Color.RED) soundManager.playWin();
    else soundManager.playLoss();
  };

  const handleSquareClick = (x: number, y: number) => {
    if (gameStatus !== GameStatus.PLAYING || turn !== Color.RED) return;

    const clickedPos = { x, y };
    const piece = getPieceAt(board, clickedPos);

    // Select own piece
    if (piece && piece.color === turn) {
      if (selectedPos && isPosEqual(selectedPos, clickedPos)) {
        setSelectedPos(null); // Deselect
      } else {
        setSelectedPos(clickedPos);
        soundManager.playSelect();
      }
      return;
    }

    // Move to target (empty or enemy)
    if (selectedPos) {
      const move = { from: selectedPos, to: clickedPos };
      if (isValidMove(board, move, turn)) {
         // Ensure not checking self (already handled in getValidMoves usually, but safe check)
         const tempBoard = simulateMove(board, move);
         if (!isCheck(tempBoard, turn)) {
            executeMove(move);
         } else {
             // Invalid move (leaves king in check) - shake effect could go here
             soundManager.playSelect(); // Just play a blip to indicate click registered but invalid
         }
      } else {
        // Clicked invalid square, deselect
        setSelectedPos(null);
      }
    }
  };

  const getAdvisorHelp = async () => {
    if (loadingAdvisor || gameStatus !== GameStatus.PLAYING) return;
    
    setLoadingAdvisor(true);
    setAdvisorText("正在思考战局...");
    
    try {
      const fen = boardToFen(board, turn);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = `
        你是中国象棋特级大师。
        当前局面 (FEN): ${fen}
        我是红方 (Red). 
        请分析当前局势，并用中文给出一步最好的走法建议，或者告诉我接下来该注意什么。
        字数控制在 50 字以内，语言要像个军师一样古风一点。
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      setAdvisorText(response.text);
    } catch (e) {
      console.error(e);
      setAdvisorText("军师暂时掉线了...");
    } finally {
      setLoadingAdvisor(false);
    }
  };

  const resetGame = () => {
    setBoard(createInitialBoard());
    setTurn(Color.RED);
    setGameStatus(GameStatus.PLAYING);
    setLastMove(null);
    setSelectedPos(null);
    setAdvisorText("");
  };

  // SVG Grid Generator
  const renderGrid = () => {
    return (
      <svg className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none" viewBox="0 0 90 100">
        <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#5c4033" strokeWidth="0.5"/>
            </pattern>
        </defs>
        
        {/* Background color */}
        <rect width="90" height="100" fill="#eecfa1" />
        
        {/* Main Grid Lines */}
        {Array.from({ length: 10 }).map((_, i) => (
           <line key={`h-${i}`} x1="5" y1={5 + i * 10} x2="85" y2={5 + i * 10} stroke="#5c4033" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
           <line key={`v-${i}`} 
             x1={5 + i * 10} y1="5" 
             x2={5 + i * 10} y2="95" 
             stroke="#5c4033" strokeWidth="0.5" 
             display={(i > 0 && i < 8) ? undefined : undefined} // Border lines always solid
           />
        ))}

        {/* River (Clear vertical lines in middle) */}
        <rect x="6" y="46" width="78" height="8" fill="#eecfa1" />
        
        {/* River Borders */}
        <line x1="5" y1="45" x2="85" y2="45" stroke="#5c4033" strokeWidth="0.5" /> 
        <line x1="5" y1="55" x2="85" y2="55" stroke="#5c4033" strokeWidth="0.5" /> 

        {/* Palace Diagonals */}
        {/* Red Palace (Bottom) */}
        <line x1="35" y1="75" x2="55" y2="95" stroke="#5c4033" strokeWidth="0.5" />
        <line x1="55" y1="75" x2="35" y2="95" stroke="#5c4033" strokeWidth="0.5" />
        {/* Black Palace (Top) */}
        <line x1="35" y1="5" x2="55" y2="25" stroke="#5c4033" strokeWidth="0.5" />
        <line x1="55" y1="5" x2="35" y2="25" stroke="#5c4033" strokeWidth="0.5" />
        
        {/* River Text */}
        <text x="20" y="51" fontFamily="Ma Shan Zheng" fontSize="5" fill="#5c4033" textAnchor="middle" dominantBaseline="middle">楚 河</text>
        <text x="70" y="51" fontFamily="Ma Shan Zheng" fontSize="5" fill="#5c4033" textAnchor="middle" dominantBaseline="middle">汉 界</text>

        {/* Intersection Crosses (Soldier/Cannon markers) */}
        {[
            [1, 2], [7, 2], // Cannons Black
            [0, 3], [2, 3], [4, 3], [6, 3], [8, 3], // Soldiers Black
            [1, 7], [7, 7], // Cannons Red
            [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]  // Soldiers Red
        ].map(([gx, gy], idx) => {
            const cx = 5 + gx * 10;
            const cy = 5 + gy * 10;
            const s = 1; // size
            const o = 0.5; // offset
            return (
                <g key={idx} stroke="#5c4033" strokeWidth="0.5" fill="none">
                    {/* Top Left */}
                    {gx > 0 && <path d={`M ${cx-o-s} ${cy-o} L ${cx-o} ${cy-o} L ${cx-o} ${cy-o-s}`} />}
                    {/* Top Right */}
                    {gx < 8 && <path d={`M ${cx+o+s} ${cy-o} L ${cx+o} ${cy-o} L ${cx+o} ${cy-o-s}`} />}
                    {/* Bottom Left */}
                    {gx > 0 && <path d={`M ${cx-o-s} ${cy+o} L ${cx-o} ${cy+o} L ${cx-o} ${cy+o+s}`} />}
                    {/* Bottom Right */}
                    {gx < 8 && <path d={`M ${cx+o+s} ${cy+o} L ${cx+o} ${cy+o} L ${cx+o} ${cy+o+s}`} />}
                </g>
            )
        })}
      </svg>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-100 text-stone-800 p-4">
      <div className="max-w-4xl w-full flex flex-col md:flex-row gap-8 items-center md:items-start">
        
        {/* Left: Game Board */}
        <div className="flex-shrink-0 relative select-none shadow-2xl rounded-lg overflow-hidden border-8 border-[#8b5a2b] bg-[#eecfa1]">
          <div 
            className="relative w-[360px] h-[400px] md:w-[450px] md:h-[500px]"
          >
             {/* SVG Grid Layer */}
             {renderGrid()}

             {/* Interactive Layer */}
             <div className="absolute inset-0 grid grid-cols-9 grid-rows-10" 
                  style={{ padding: '0px' }}> {/* No padding, handled by SVG logic */}
                
                {/* Cells overlay for clicking */}
                {board.map((row, y) => (
                    row.map((piece, x) => {
                        const isSelected = selectedPos?.x === x && selectedPos?.y === y;
                        const isLastMoveFrom = lastMove?.from.x === x && lastMove?.from.y === y;
                        const isLastMoveTo = lastMove?.to.x === x && lastMove?.to.y === y;
                        
                        // Check if valid move candidate
                        let isValidCandidate = false;
                        if (selectedPos && turn === Color.RED && !piece) {
                           if (isValidMove(board, {from: selectedPos, to: {x,y}}, turn)) {
                             // Extra check for suicide check
                             const temp = simulateMove(board, {from: selectedPos, to: {x,y}});
                             if (!isCheck(temp, turn)) isValidCandidate = true;
                           }
                        } else if (selectedPos && turn === Color.RED && piece && piece.color === Color.BLACK) {
                             // Capture candidate
                             if (isValidMove(board, {from: selectedPos, to: {x,y}}, turn)) {
                                const temp = simulateMove(board, {from: selectedPos, to: {x,y}});
                                if (!isCheck(temp, turn)) isValidCandidate = true;
                             }
                        }

                        return (
                            <div key={`${x}-${y}`} className="relative w-full h-full">
                                {/* Highlight/Marker Logic */}
                                {(isLastMoveFrom || isLastMoveTo) && (
                                   <div className="absolute inset-2 bg-blue-500/20 rounded-full blur-[2px]"></div>
                                )}
                                {isValidCandidate && (
                                   <div className={`absolute inset-0 flex items-center justify-center`}>
                                     <div className={`w-3 h-3 rounded-full ${piece ? 'border-2 border-green-600 w-full h-full scale-90' : 'bg-green-600/50'}`}></div>
                                   </div>
                                )}

                                {/* Piece */}
                                {piece && (
                                    <PieceView 
                                        piece={piece} 
                                        selected={isSelected} 
                                        onClick={() => handleSquareClick(x, y)}
                                    />
                                )}

                                {/* Invisible click handler for empty squares */}
                                {!piece && (
                                    <div 
                                        className="absolute inset-0 z-10 cursor-pointer"
                                        onClick={() => handleSquareClick(x, y)}
                                    />
                                )}
                            </div>
                        );
                    })
                ))}
             </div>
          </div>
        </div>

        {/* Right: Info & Controls */}
        <div className="flex flex-col gap-6 w-full max-w-sm">
          <header className="text-center md:text-left">
            <h1 className="text-4xl font-bold mb-2 font-calligraphy text-stone-900">中国象棋</h1>
            <p className="text-stone-600">人机对弈 & Gemini 军师</p>
          </header>

          {/* Status Card */}
          <div className="bg-white p-6 rounded-xl shadow-md border border-stone-200">
             <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold">当前状态:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                    gameStatus === GameStatus.PLAYING 
                    ? (turn === Color.RED ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-800')
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                    {gameStatus === GameStatus.PLAYING 
                      ? (turn === Color.RED ? "红方思考中" : "AI 思考中...")
                      : (gameStatus === GameStatus.RED_WIN ? "红方获胜!" : "黑方获胜!")}
                </span>
             </div>
             
             {/* Buttons */}
             <div className="grid grid-cols-2 gap-3">
                <button 
                   onClick={resetGame}
                   className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-lg font-semibold transition-colors"
                >
                   重新开始
                </button>
                <button 
                   onClick={getAdvisorHelp}
                   disabled={loadingAdvisor || gameStatus !== GameStatus.PLAYING}
                   className={`px-4 py-2 rounded-lg font-semibold text-white transition-all
                     ${loadingAdvisor 
                        ? 'bg-purple-400 cursor-not-allowed' 
                        : 'bg-purple-600 hover:bg-purple-700 shadow-lg hover:shadow-purple-500/30'}
                   `}
                >
                   {loadingAdvisor ? '连线中...' : '军师锦囊'}
                </button>
             </div>
          </div>

          {/* Gemini Advisor Chat Bubble */}
          {(advisorText || loadingAdvisor) && (
            <div className="relative bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🧙‍♂️</span>
                    </div>
                    <div>
                        <h3 className="font-bold text-stone-800 mb-1">军师建议</h3>
                        <p className="text-stone-600 text-sm leading-relaxed min-h-[3rem]">
                            {advisorText || "正在观察棋局，请稍候..."}
                        </p>
                    </div>
                </div>
                {/* Triangle tail */}
                <div className="absolute top-6 -left-2 w-4 h-4 bg-white border-l border-b border-purple-500 transform rotate-45"></div>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-xs text-stone-400">
        Powered by Gemini 2.5 Flash • React • Vercel
      </div>
    </div>
  );
}
