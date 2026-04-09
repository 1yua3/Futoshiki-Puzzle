import { useState } from "react";
import {
  IconPlanet,
  IconBrandGoogleFilled,
  IconEyeOff,
  IconEye,
  IconLock,
} from "@tabler/icons-react";
import { useDispatch } from "react-redux";
import { useGoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import {
  forgot,
  signin,
  signinWithGoogle,
  signup,
} from "../../redux/AuthRedux";

const AuthUser = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [stage, setStage] = useState("login");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log(`Submitting ${stage} form:`, formData);
    if (stage === "login") {
      await dispatch(signin(formData));
      navigate("/");
    } else if (stage === "register") {
      await dispatch(signup(formData));
      navigate("/auth/signin");
    } else if (stage === "forgot") {
      await dispatch(forgot(formData));
    }
  };

  const handleGoogleSuccess = async (googleResponse) => {
    const accessToken = googleResponse.access_token;
    dispatch(signinWithGoogle({ accessToken }));
    navigate("/");
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (error) => console.error("Google Login Failed:", error),
    flow: "implicit",
    scope: "email profile",
  });
  const [isShowPass, setIsShowPass] = useState(false);
  const renderForm = () => {
    switch (stage) {
      case "login":
        return (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 w-full"
            >
              <div className="divider text-gray-500">
                Hoặc đăng nhập bằng email
              </div>

              <div className="space-y-2">
                <label className="label font-medium">Email</label>
                <input
                  name="email"
                  className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  type="email"
                  placeholder="Nhập email của bạn"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2 ">
                <label className="label font-medium">Mật khẩu</label>
                <div className="relative">
                  <IconLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    name="password"
                    className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    type={isShowPass ? "text" : "password"}
                    placeholder="Nhập mật khẩu"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setIsShowPass(!isShowPass)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {isShowPass ? (
                      <IconEyeOff size={20} />
                    ) : (
                      <IconEye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    id="remember"
                  />
                  <label htmlFor="remember" className="cursor-pointer text-sm">
                    Ghi nhớ đăng nhập
                  </label>
                </div>
                <button
                  type="button"
                  className="text-blue-600 hover:underline text-sm"
                  onClick={() => setStage("forgot")}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button
                type="submit"
                className="bg-green-500 hover:bg-green-400 active:scale-95 py-2 px-4 rounded-xl text-white text-lg mt-4"
              >
                Đăng nhập
              </button>
            </form>

            <p className="text-center pt-6 text-gray-600">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setStage("register")}
                className="text-blue-600 font-medium hover:underline"
              >
                Đăng ký ngay
              </button>
            </p>
          </>
        );

      case "register":
        return (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 w-full"
            >
              <div className="divider text-gray-500">Tạo tài khoản mới</div>

              <div className="space-y-2">
                <label className="label font-medium">Tên người dùng</label>
                <input
                  name="fullName"
                  className="input input-bordered w-full"
                  type="text"
                  placeholder="Nhập tên của bạn"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="label font-medium">Email</label>
                <input
                  name="email"
                  className="input input-bordered w-full"
                  type="email"
                  placeholder="Nhập email của bạn"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="label font-medium">Mật khẩu</label>
                <input
                  name="password"
                  className="input input-bordered w-full"
                  type="password"
                  placeholder="Tạo mật khẩu"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  id="terms"
                  required
                />
                <label htmlFor="terms" className="text-sm">
                  Tôi đồng ý với Điều khoản dịch vụ
                </label>
              </div>

              <button
                type="submit"
                className="bg-red-500 hover:bg-red-400 active:scale-95 py-2 px-4 rounded-xl text-white text-lg mt-4"
              >
                Đăng ký
              </button>
            </form>

            <p className="text-center pt-6 text-gray-600">
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setStage("login")}
                className="text-blue-600 font-medium hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </p>
          </>
        );

      case "forgot":
        return (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 w-full"
            >
              <div className="divider text-gray-500">Khôi phục mật khẩu</div>

              <p className="text-gray-600 text-sm mb-2">
                Nhập email của bạn để nhận liên kết đặt lại mật khẩu
              </p>

              <div className="space-y-2">
                <label className="label font-medium">Email</label>
                <input
                  name="email"
                  className="input input-bordered w-full"
                  type="email"
                  placeholder="Nhập email của bạn"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                type="submit"
                className="bg-purple-500 hover:bg-purple-400 active:scale-95 py-2 px-4 rounded-xl text-white text-lg mt-4"
              >
                Gửi liên kết
              </button>
            </form>

            <p className="text-center pt-6 text-gray-600">
              Nhớ mật khẩu?{" "}
              <button
                type="button"
                onClick={() => setStage("login")}
                className="text-blue-600 font-medium hover:underline"
              >
                Đăng nhập
              </button>
            </p>
          </>
        );

      default:
        return null;
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case "login":
        return "Đăng nhập";
      case "register":
        return "Đăng ký tài khoản";
      case "forgot":
        return "Quên mật khẩu";
      default:
        return "Đăng nhập";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="hidden md:block md:w-1/2">
            <img
              className="w-full h-full object-cover"
              src="/omori.jpeg"
              alt="Background"
            />
          </div>
          <div className="w-full md:w-1/2 p-8 md:p-12">
            <div className="flex flex-col h-full justify-center">
              <div className="flex items-center gap-3 mb-8">
                <IconPlanet color="orange" size={40} />
                <p className="text-2xl font-bold">
                  Golden<span className="text-orange-500">Plate</span>
                </p>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                {getStageTitle()}
              </h1>
              {(stage === "login" || stage === "register") && (
                <button
                  className="btn btn-outline w-full border-gray-300 hover:bg-blue-400 bg-blue-500 text-white rounded-xl active:scale-95 mb-6"
                  onClick={loginWithGoogle}
                  type="button"
                >
                  <IconBrandGoogleFilled size={20} />
                  <span>Tiếp tục với Google</span>
                </button>
              )}
              <div className="w-full">{renderForm()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthUser;
