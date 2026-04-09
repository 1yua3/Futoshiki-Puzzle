import React, { useEffect } from "react";
import "./App.css";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/user/Home";
import LayoutClient from "./layouts/user/LayoutClient";
import { Toaster, toast } from "react-hot-toast";
import NotFound404 from "./components/NotFound404";
import Game from "./pages/user/Game";
import Statistics from "./pages/user/Statistics";
import FutoshikiGrid from "./components/FutoshikiGrid";
import GameControls from "./components/GameControls";
import GameInfo from "./components/GameInfo";
import PuzzleSelector from "./components/PuzzleSelector";
import { useSelector, useDispatch } from "react-redux";
import { clearError, newGame } from "./redux/gameSlice";
import Futoshiki from "./pages/user/Futoshiki";

function App() {
  const { error } = useSelector((state) => state.game);
  const dispatch = useDispatch();

  useEffect(() => {
    if (error) {
      toast.error(error, { duration: 3000, position: 'top-center' });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  return (
    <>
      <Toaster />
      <Routes>
        <Route path="/" element={<Futoshiki />} />
        <Route path="*" element={<NotFound404 />} />
      </Routes>
    </>
  );
}

export default App;
