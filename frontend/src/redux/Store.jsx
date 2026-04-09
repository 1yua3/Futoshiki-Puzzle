import { configureStore } from "@reduxjs/toolkit";
import authreducer from "./AuthRedux";
import gamereducer from "./gameSlice";

export const store = configureStore({
  reducer: {
    auth: authreducer,
    game:gamereducer,
  },
});
