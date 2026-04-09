import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import toast from "react-hot-toast";

axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

axios.defaults.withCredentials = true;

export const signin = createAsyncThunk(
  "/auth/signin",
  async (uploadData, thunkAPI) => {
    try {
      const { data } = await axios.post("/auth/signin", uploadData);
      if (!data.success) {
        return thunkAPI.rejectWithValue({ message: data.message });
      }
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue({ message: error });
    }
  }
);
export const signup = createAsyncThunk(
  "/auth/signup",
  async (uploadData, thunkAPI) => {
    try {
      const { data } = await axios.post("/auth/signup", uploadData);
      if (!data.success) {
        return thunkAPI.rejectWithValue({ message: data.message });
      }
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue({ message: error });
    }
  }
);
export const forgot = createAsyncThunk(
  "/auth/forgot",
  async (uploadData, thunkAPI) => {
    try {
      const { data } = await axios.post("/auth/forgot-password", uploadData);
      if (!data.success) {
        return thunkAPI.rejectWithValue({ message: data.message });
      }
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue({ message: error });
    }
  }
);
export const authCheck = createAsyncThunk("auth/check", async (thunkAPI) => {
  try {
    const { data } = await axios.get("/auth/check", {
      withCredentials: true,
    });
    if (!data.success) {
      return thunkAPI.rejectWithValue({ message: data.message });
    }
    return data;
  } catch (error) {
    return thunkAPI.rejectWithValue({ message: error });
  }
});
export const logout = createAsyncThunk(
  "/auth/logout",
  async (_data, thunkAPI) => {
    try {
      const { data } = await axios.post("/auth/logout");
      if (!data.success) {
        return thunkAPI.rejectWithValue({ message: data.message });
      }
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue({ message: error });
    }
  }
);
export const signinWithGoogle = createAsyncThunk(
  "/auth/google",
  async ({ accessToken }, thunkAPI) => {
    try {
      const { data } = await axios.post("/auth/google", { accessToken });

      if (!data.success) {
        return thunkAPI.rejectWithValue({ message: data.message });
      }
      return data;
    } catch (error) {
      return thunkAPI.rejectWithValue(error.message);
    }
  }
);
const AuthSlice = createSlice({
  name: "auth",
  initialState: {
    loading: false,
    error: null,
    isSignin: false,
    currentAccount: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder

      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.loading = false;
        toast.success(action.payload.message);
      })
      .addCase(signup.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload.message);
      })
      .addCase(forgot.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(forgot.fulfilled, (state, action) => {
        state.loading = false;
        toast.success(action.payload.message);
      })
      .addCase(forgot.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload.message);
      })

      .addCase(signin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signin.fulfilled, (state, action) => {
        state.loading = false;
        state.isSignin = true;
        state.currentAccount = action.payload.user;
        toast.success(action.payload.message);
      })
      .addCase(signin.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload.message);
      })
      .addCase(authCheck.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(authCheck.fulfilled, (state, action) => {
        state.loading = false;
        state.isSignin = true;
        state.currentAccount = action.payload.user;
        toast.success(action.payload.message);
      })
      .addCase(authCheck.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload || "lmao");
      })
      .addCase(logout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state, action) => {
        state.loading = false;
        state.isSignin = false;
        toast.success(action.payload.message);
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload.message);
      })
      .addCase(signinWithGoogle.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signinWithGoogle.fulfilled, (state, action) => {
        state.loading = false;
        state.isSignin = true;
        state.currentAccount = action.payload.user;
        toast.success(action.payload.message);
      })
      .addCase(signinWithGoogle.rejected, (state, action) => {
        state.loading = false;
        toast.error(action.payload.message);
      });
  },
});
export default AuthSlice.reducer;
