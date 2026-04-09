import { Link } from "react-router-dom";

const NotFound404 = () => {
  return (
    <>
      <div className="text-center mt-80 space-y-6">
        <h1 className="text-6xl">404</h1>
        <p className="text-2xl">Trang không tồn tại</p>
        <Link to="/" className="bg-blue-500 rounded-xl py-2 px-4 text-white">
          Về trang chủ
        </Link>
      </div>
    </>
  );
};
export default NotFound404;
