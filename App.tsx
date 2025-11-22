
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
        relative rounded-full flex items-center justify-center
        shadow-[2px_2px_4px_rgba(0,0,0,0.4)] cursor-pointer transition-transform duration-200 z-20
        ${selected ? 'scale-110 ring-2 ring-yellow-400 z-30' : 'hover:scale-105'}
        ${isRed ? 'bg-[#f2e7d5] text-[#8b1a1a] border-4 border-[#8b1a1a]' : 'bg-[#f2e7d5] text-black border-4 border-black'}
      `}
      style={{
        width: '88%',
        height: '88%',
        fontFamily: '"Ma Shan Zheng", cursive',
        // Wooden texture effect via gradient
        background: 'radial-gradient(circle at 30% 30%, #f7ebd9, #dcb386)', 
        boxShadow: selected ? '0 0 15px rgba(250, 204, 21, 0.6), 4px 4px 8px rgba(0,0,0,0.5)' : '2px 3px 5px rgba(0,0,0,0.4), inset 0 0 5px rgba(255,255,255,0.2)'
      }}
    >
      {/* Engraved Ring effect */}
      <div className={`absolute w-[82%] h-[82%] rounded-full border ${isRed ? 'border-[#8b1a1a]/40' : 'border-black/40'}`}></div>
      <span className="text-2xl md:text-3xl lg:text-4xl font-bold relative -top-[2px] select-none drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
        {chars[piece.color][piece.type]}
      </span>
    </div>
  );
};

const BoardSquare = ({ x, y, children, onClick, isLastMove, isValidCandidate }: any) => {
  // Standard Xiangqi Grid Logic
  const isEdgeFile = x === 0 || x === 8;
  const isTopBank = y === 4;
  const isBottomBank = y === 5;
  
  // Vertical Line Logic (Breaks at river)
  let vertHeight = '100%';
  let vertTop = '0';

  if (!isEdgeFile) {
    if (isTopBank) {
      vertHeight = '50%'; // Top half only
      vertTop = '0';
    } else if (isBottomBank) {
      vertHeight = '50%'; // Bottom half only
      vertTop = '50%';
    }
  }

  // Palace Diagonals Logic
  const renderDiagonals = () => {
    // Shared styles for diagonal lines
    const lineStyle = "absolute bg-black h-px origin-center pointer-events-none z-0";
    // We calculate length roughly based on container. 
    // Since we are using Tailwind classes, precise geometric length with rotation is tricky without fixed pixels.
    // However, 142% width covers the diagonal of a square perfectly (sqrt(2)).
    
    // Slash: \ (Top-Left to Bottom-Right)
    // Backslash: / (Top-Right to Bottom-Left)

    // Center X components
    const SlashFull = () => <div className={`${lineStyle} w-[142%] top-0 left-0 origin-top-left rotate-45`}></div>;
    const BackslashFull = () => <div className={`${lineStyle} w-[142%] top-0 right-0 origin-top-right -rotate-45`}></div>;

    // Corner rays
    const SlashStart = () => <div className={`${lineStyle} w-[75%] top-1/2 left-1/2 origin-left rotate-45`}></div>; // Center -> BR
    const SlashEnd = () => <div className={`${lineStyle} w-[75%] top-1/2 right-1/2 origin-right rotate-45`}></div>; // TL -> Center
    
    const BackslashStart = () => <div className={`${lineStyle} w-[75%] top-1/2 right-1/2 origin-right -rotate-45`}></div>; // Center -> BL
    const BackslashEnd = () => <div className={`${lineStyle} w-[75%] top-1/2 left-1/2 origin-left -rotate-45`}></div>; // TR -> Center

    // Black Palace (y: 0-2, x: 3-5)
    if (x === 3 && y === 0) return <SlashStart />;
    if (x === 5 && y === 0) return <BackslashStart />;
    if (x === 4 && y === 1) return <><SlashFull /><BackslashFull /></>;
    if (x === 3 && y === 2) return <BackslashEnd />;
    if (x === 5 && y === 2) return <SlashEnd />;

    // Red Palace (y: 7-9, x: 3-5)
    if (x === 3 && y === 7) return <SlashStart />;
    if (x === 5 && y === 7) return <BackslashStart />;
    if (x === 4 && y === 8) return <><SlashFull /><BackslashFull /></>;
    if (x === 3 && y === 9) return <BackslashEnd />;
    if (x === 5 && y === 9) return <SlashEnd />;

    return null;
  };

  // Markers (The "L" shaped decorations for Cannons and Soldiers)
  const renderMarkers = () => {
    const markers = [];
    // Colors
    const mColor = "border-black";
    // Distance from center line
    const gap = "3px"; 
    // Size of the L shape
    const size = "w-3 h-3"; 
    const border = "border-t border-l"; // Top-Left L shape default, rotate for others

    // Check if this position needs markers
    // Black Cannons: (1,2), (7,2)
    // Red Cannons: (1,7), (7,7)
    // Black Soldiers: (0,3), (2,3), (4,3), (6,3), (8,3)
    // Red Soldiers: (0,6), (2,6), (4,6), (6,6), (8,6)
    
    const isCannon = (y === 2 || y === 7) && (x === 1 || x === 7);
    const isSoldier = (y === 3 || y === 6) && (x % 2 === 0);

    if (isCannon || isSoldier) {
      // Top Left
      if (x !== 0) {
        markers.push(
            <div key="tl" className={`absolute ${size} ${mColor} ${border}`} style={{ top: gap, left: gap }}></div>
        );
      }
      // Top Right
      if (x !== 8) {
        markers.push(
            <div key="tr" className={`absolute ${size} ${mColor} ${border} rotate-90`} style={{ top: gap, right: gap }}></div>
        );
      }
      // Bottom Right
      if (x !== 8) {
        markers.push(
            <div key="br" className={`absolute ${size} ${mColor} ${border} rotate-180`} style={{ bottom: gap, right: gap }}></div>
        );
      }
      // Bottom Left
      if (x !== 0) {
        markers.push(
            <div key="bl" className={`absolute ${size} ${mColor} ${border} -rotate-90`} style={{ bottom: gap, left: gap }}></div>
        );
      }
    }
    
    // Since we are centering everything in the div, we need to wrap these in a container that sits at the exact intersection center
    if (markers.length > 0) {
        return (
            <div className="absolute top-1/2 left-1/2 w-0 h-0 pointer-events-none z-0">
                {/* Relative container for the 4 corners */}
                <div className="relative">
                    {markers}
                </div>
            </div>
        );
    }
    return null;
  };

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center" 
      onClick={onClick}
    >
      {/* Horizontal Line (Rank) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-px bg-black z-0 pointer-events-none"></div>

      {/* Vertical Line (File) */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 w-px bg-black z-0 pointer-events-none" 
        style={{ height: vertHeight, top: vertTop }}
      ></div>
      
      {/* Palace Diagonals */}
      {renderDiagonals()}

      {/* Fiducial Markers */}
      {renderMarkers()}

      {/* Highlight Valid Move Target */}
      {isValidCandidate && !children && (
        <div className="absolute w-3 h-3 bg-green-600/60 rounded-full z-10 pointer-events-none"></div>
      )}
      
      {/* Last Move Highlight */}
      {isLastMove && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-blue-400/20 rounded z-0 pointer-events-none"></div>
      )}

      {/* Piece Layer */}
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
          handleGameOver(Color.RED);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [turn, gameStatus, board]);

  const executeMove = (move: Move) => {
    const targetPiece = getPieceAt(board, move.to);
    
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

    const nextTurn = turn === Color.RED ? Color.BLACK : Color.RED;
    
    if (isCheck(nextBoard, nextTurn)) {
      soundManager.playCheck();
    }

    const status = getGameStatus(nextBoard, nextTurn);
    if (status !== GameStatus.PLAYING) {
      setGameStatus(status);
      handleGameOver(status === GameStatus.RED_WIN ? Color.RED : Color.BLACK);
    }
  };

  const handleGameOver = (winner: Color) => {
    if (winner === Color.RED) {
      soundManager.playWin();
      setAdvisorText("恭喜！红方获胜！");
    } else {
      soundManager.playLoss();
      setAdvisorText("遗憾！黑方获胜！");
    }
  };

  const handleSquareClick = (x: number, y: number) => {
    if (gameStatus !== GameStatus.PLAYING) return;
    if (turn !== Color.RED) return; 

    const clickedPos = { x, y };
    const clickedPiece = getPieceAt(board, clickedPos);

    if (selectedPos) {
      if (isPosEqual(selectedPos, clickedPos)) {
        setSelectedPos(null);
        return;
      }

      if (clickedPiece && clickedPiece.color === turn) {
        soundManager.playSelect();
        setSelectedPos(clickedPos);
        return;
      }

      const move = { from: selectedPos, to: clickedPos };
      if (isValidMove(board, move, turn)) {
        const tempBoard = simulateMove(board, move);
        if (!isCheck(tempBoard, turn)) {
          executeMove(move);
        }
      } else {
        setSelectedPos(null);
      }
    } else {
      if (clickedPiece && clickedPiece.color === turn) {
        soundManager.playSelect();
        setSelectedPos(clickedPos);
      }
    }
  };

  const getGeminiAdvice = async () => {
    if (!process.env.API_KEY) {
      alert("请配置 API_KEY");
      return;
    }
    setLoadingAdvisor(true);
    setAdvisorText("军师正在思考中...");
    
    try {
      const fen = boardToFen(board, turn);
      const prompt = `你是中国象棋特级大师。当前的盘面FEN是: ${fen}。轮到${turn === Color.RED ? '红' : '黑'}方走。请分析当前局势，并给出一步最好的走法建议，以及简短的战术分析 (100字以内)。`;
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text;
      setAdvisorText(text || "军师默不作声 (无法获取回复)。");
    } catch (error) {
      console.error(error);
      setAdvisorText("军师暂时无法回答。");
    } finally {
      setLoadingAdvisor(false);
    }
  };

  const restartGame = () => {
    setBoard(createInitialBoard());
    setTurn(Color.RED);
    setGameStatus(GameStatus.PLAYING);
    setLastMove(null);
    setSelectedPos(null);
    setAdvisorText("");
  };

  return (
    <div className="min-h-screen bg-[#f0e6d2] text-stone-800 flex flex-col items-center py-6 px-2 font-serif select-none">
      <h1 className="text-4xl font-bold mb-6 font-calligraphy text-[#4a3728] drop-shadow-sm tracking-widest">中国象棋</h1>

      <div className="flex flex-col lg:flex-row gap-8 items-start w-full max-w-6xl justify-center">
        
        {/* Board Outer Frame - Thick black border with wood color */}
        <div className="p-1 bg-black rounded shadow-2xl">
            <div className="p-1 bg-[#d8c38c] border-2 border-[#d8c38c]">
                {/* Board Inner Container - The Grid */}
                <div 
                    className="relative bg-[#d8c38c] grid grid-cols-9 grid-rows-10 w-[342px] h-[380px] md:w-[540px] md:h-[600px] border border-black"
                >
                    {/* Inner Margin Border (The thin line inside the thick frame) */}
                    <div className="absolute top-1 left-1 right-1 bottom-1 border border-black pointer-events-none z-0"></div>

                    {/* River Text */}
                    <div className="absolute top-[45%] left-0 w-full h-[10%] flex justify-between items-center px-14 md:px-24 pointer-events-none z-0 text-black/80 font-calligraphy text-2xl md:text-4xl">
                        <span className="tracking-[0.5em]">楚河</span>
                        <span className="tracking-[0.5em]">汉界</span>
                    </div>

                    {/* Render Squares */}
                    {board.map((row, y) => 
                    row.map((piece, x) => {
                        const isSelected = selectedPos?.x === x && selectedPos?.y === y;
                        const isLastFrom = lastMove?.from.x === x && lastMove?.from.y === y;
                        const isLastTo = lastMove?.to.x === x && lastMove?.to.y === y;
                        
                        let isValidCandidate = false;
                        if (selectedPos && gameStatus === GameStatus.PLAYING && turn === Color.RED) {
                            const move = { from: selectedPos, to: { x, y } };
                            if (isValidMove(board, move, turn)) {
                                isValidCandidate = true; 
                            }
                        }

                        return (
                        <BoardSquare 
                            key={`${x}-${y}`} 
                            x={x} 
                            y={y} 
                            onClick={() => handleSquareClick(x, y)}
                            isLastMove={isLastFrom || isLastTo}
                            isValidCandidate={isValidCandidate}
                        >
                            {piece && (
                            <PieceView 
                                piece={piece} 
                                selected={isSelected} 
                                onClick={() => handleSquareClick(x, y)}
                            />
                            )}
                        </BoardSquare>
                        );
                    })
                    )}
                </div>
            </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          <div className="bg-[#fffcf5] p-6 rounded border border-[#d8c38c] shadow-lg">
             <div className="flex justify-between items-center mb-4 border-b border-[#e5dcc5] pb-2">
               <span className="text-lg font-bold text-[#5c4033]">当前回合</span>
               <span className={`px-4 py-1 rounded text-white font-bold text-sm shadow-sm ${turn === Color.RED ? 'bg-[#8b1a1a]' : 'bg-black'}`}>
                 {turn === Color.RED ? '红方' : '黑方'}
               </span>
             </div>
             
             {gameStatus !== GameStatus.PLAYING && (
               <div className="mt-4 p-4 bg-yellow-50 text-yellow-900 border border-yellow-200 rounded text-center font-bold text-xl animate-pulse">
                  {gameStatus === GameStatus.RED_WIN ? "红方获胜!" : "黑方获胜!"}
               </div>
             )}

             <button 
               onClick={restartGame}
               className="w-full mt-4 py-2 bg-[#5c4033] hover:bg-[#4a332a] text-[#f2e7d5] rounded font-bold transition-colors shadow flex items-center justify-center gap-2"
             >
               重新开始
             </button>
          </div>

          <div className="bg-white p-6 rounded border border-blue-100 shadow-lg relative overflow-hidden">
            <h2 className="text-xl font-bold text-[#5c4033] mb-4 flex items-center gap-2 relative z-10">
              <span className="text-2xl">📜</span> 军师锦囊
            </h2>
            
            <div className="min-h-[100px] bg-[#f9f9f9] p-4 rounded text-sm leading-relaxed text-gray-700 mb-4 border border-gray-100 shadow-inner italic">
               {advisorText || "点击下方按钮，请求军师分析战局..."}
            </div>

            <button 
              onClick={getGeminiAdvice}
              disabled={loadingAdvisor || gameStatus !== GameStatus.PLAYING}
              className={`
                w-full py-2 rounded font-bold text-white transition-all shadow
                flex items-center justify-center gap-2
                ${loadingAdvisor 
                  ? 'bg-gray-400 cursor-wait' 
                  : 'bg-[#8b1a1a] hover:bg-[#a62b2b]'}
              `}
            >
              {loadingAdvisor ? "思考中..." : "请求指点"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
