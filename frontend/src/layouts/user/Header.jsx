import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  IconArticle,
  IconBell,
  IconHelpCircle,
  IconHome,
  IconLogin,
  IconLogout,
  IconMenu,
  IconMoon,
  IconSearch,
  IconSettings,
  IconShield,
  IconShoppingCart,
  IconSun,
  IconUser,
  IconUserPlus,
  IconX,
} from "@tabler/icons-react";
import SearchBar from "../../components/SearchBar";
import { logout } from "../../redux/AuthRedux";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isSearchBarOpen, setIsSearchBarOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const { isSignin, currentAccount, loading } = useSelector(
    (state) => state.auth,
  );
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location]);
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/auth/signin");
  };
  const navItems = [
    { name: "Trang chủ", path: "/", icon: <IconHome size={18} /> },
    {
      name: "Sản phẩm",
      path: "/products",
      icon: <IconShoppingCart size={18} />,
    },
    { name: "Giới thiệu", path: "/about", icon: <IconHelpCircle size={18} /> },
    { name: "Bài viết", path: "/blogs", icon: <IconArticle size={18} /> },
    { name: "Liên hệ", path: "/contact", icon: <IconUser size={18} /> },
  ];
  const userMenuItems = [
    { name: "Hồ sơ", path: "/profile", icon: <IconUser size={16} /> },
    { name: "Cài đặt", path: "/settings", icon: <IconSettings size={16} /> },
    { name: "Admin", path: "/admin/dashboard", icon: <IconShield size={16} /> },
    { type: "divider" },
    {
      name: "Đăng xuất",
      action: handleLogout,
      icon: <IconLogout size={16} />,
    },
  ];

  return (
    <nav className="bg-white dark:bg-gray-900 shadow-md border-b dark:border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">Y</span>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                YU<span className="text-blue-600">A</span>
              </span>
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            {navItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-800"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSearchBarOpen(!isSearchBarOpen)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              <IconSearch size={20} />
            </button>
            {isSearchBarOpen && (
              <SearchBar onClose={() => setIsSearchBarOpen(false)} />
            )}

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <IconSun size={20} className="text-yellow-500" />
              ) : (
                <IconMoon
                  size={20}
                  className="text-gray-700 dark:text-gray-300"
                />
              )}
            </button>
            <button className="relative p-2 rounded-lg hover:bg-gray-100">
              <IconBell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            {loading ? (
              <div className="animate-pulse w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            ) : isSignin ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 py-2 px-4 focus:outline-none bg-blue-600 rounded-2xl hover:bg-blue-400 active:scale-95"
                >
                  <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-white font-semibold">
                    <img
                      src={currentAccount?.avatar || "/omori.jpeg"}
                      alt=""
                      className="w-8 h-8 rounded-full"
                    />
                  </div>
                  <span className="hidden md:inline font-medium text-gray-700 dark:text-gray-300">
                    {currentAccount.fullName}
                  </span>
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border dark:border-gray-800 py-1 z-50">
                    <div className="px-4 py-2 border-b dark:border-gray-800">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {currentAccount.fullName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {currentAccount.email}
                      </p>
                    </div>

                    {userMenuItems.map((item, index) =>
                      item.type === "divider" ? (
                        <div
                          key={index}
                          className="border-t dark:border-gray-800 my-1"
                        ></div>
                      ) : (
                        <Link
                          key={item.name}
                          to={item.action ? "#" : item.path}
                          onClick={item.action || (() => {})}
                          className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          {item.icon}
                          <span>{item.name}</span>
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/auth/signin"
                  className="flex items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <IconLogin size={16} />
                  <span>Đăng nhập</span>
                </Link>
                <Link
                  to="/auth/signup"
                  className="hidden md:flex items-center space-x-1 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                >
                  <IconUserPlus size={16} />
                  <span>Đăng ký</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <IconX size={24} className="text-gray-700 dark:text-gray-300" />
              ) : (
                <IconMenu
                  size={24}
                  className="text-gray-700 dark:text-gray-300"
                />
              )}
            </button>
          </div>
        </div>
        {isMobileMenuOpen && (
          <div className="md:hidden border-t dark:border-gray-800 py-4">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === item.path
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-gray-800"
                      : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              ))}
              {!isSignin && (
                <>
                  <div className="border-t dark:border-gray-800 pt-2 mt-2">
                    <Link
                      to="/auth/signin"
                      className="flex items-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <IconLogin size={16} />
                      <span>Đăng nhập</span>
                    </Link>
                    <Link
                      to="/register"
                      className="flex items-center space-x-2 px-4 py-3 mt-2 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                    >
                      <IconUserPlus size={16} />
                      <span>Đăng ký</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Header;
