import { useDispatch, useSelector } from "react-redux";
import FutoshikiGrid from "../../components/FutoshikiGrid";
import GameControls from "../../components/GameControls";
import GameInfo from "../../components/GameInfo";
import PuzzleSelector from "../../components/PuzzleSelector";
import { newGame } from "../../redux/gameSlice";

const Futoshiki=()=>{
  const { isSolved, isSolvedByAI } = useSelector((state) => state.game);
  const dispatch = useDispatch();

    return(
        <>
        {isSolved && !isSolvedByAI && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm transition-opacity duration-300">
           <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl transform scale-100 animate-bounce">
              <div className="text-6xl mb-4">🏆</div>
              <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-blue-500 mb-2">
                CHIẾN THẮNG!
              </h2>
              <button 
                 onClick={() => dispatch(newGame())}
                 className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
              >
                 Chơi Ván Mới
              </button>
           </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 
                           bg-clip-text text-transparent mb-2">
              Futoshiki Puzzle
            </h1>
            <p className="text-gray-600 text-lg font-medium">
              Logic Puzzle - Điền số thỏa mãn các ràng buộc
            </p>
          </header>
          
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 overflow-hidden">
                <FutoshikiGrid />
              </div>
              <div className="mt-6">
                <GameControls />
              </div>
            </div>
            
            <div className="space-y-6">
              <GameInfo />
              <PuzzleSelector />
            </div>
          </div>
        </div>
      </div>
        </>
    )
}
export default Futoshiki;