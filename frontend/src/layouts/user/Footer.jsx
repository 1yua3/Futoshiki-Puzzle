import {
  IconArrowForward,
  IconBowlChopsticks,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandX,
  IconPlanet,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <>
      <div className="bg-neutral-800 text-white  px-[10vw] pt-[4vh] lg:py-[10vh]">
        <div className="flex flex-col gap-4 lg:hidden mb-[4vh]">
          <div className="flex items-center gap-4 p-child">
            <IconPlanet color="orange" size={56} />
            <p className="text-xl">
              Golden<span className="text-warning">Plate</span>
            </p>
          </div>
          <div className="lg:hidden flex flex-row gap-2 px-[2vw]">
            <IconBrandInstagram />
            <IconBrandFacebook />
            <IconBrandX />
            <IconBrandLinkedin />
          </div>
        </div>
        <div className="  grid lg:grid-cols-4 grid-cols-3 gap-8 pb-[4vh] border-b border-white/50">
          <div className="lg:flex flex-col gap-4 hidden">
            <div className="flex items-center gap-4 p-child">
              <IconPlanet color="orange" size={56} />
              <p className="text-xl">
                Golden<span className="text-warning">Plate</span>
              </p>
            </div>
            <p className="lg:block hidden">
              Khám phá những nhà hoa đặc biệt nhất , các nhà hàng sang trọng đến
              đạt sao Michelin và dịch vụ xịn xò.
            </p>
            <div className="flex flex-row gap-2">
              <IconBrandInstagram />
              <IconBrandFacebook />
              <IconBrandX />
              <IconBrandLinkedin />
            </div>
          </div>
          <div>
            <h1 className="font-playfair text-2xl">Team</h1>
            <ul className="space-y-4 mt-8">
              <li>
                <Link to="/aboutUs" className="link link-hover">
                  Giới Thiệu
                </Link>
              </li>
              <li>
                <Link to="/contact" className="link link-hover" href="">
                  Liên Hệ
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h1 className="font-playfair text-2xl">Tính Hợp Pháp</h1>
            <ul className="space-y-4 mt-8 text-sm">
              <li>
                <a className="link link-hover" href="">
                  Điều Lệ
                </a>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h1>Theo Dõi</h1>
            <p className="lg:block hidden">
              Đăng ký nhận bản tin của chúng tôi để nhận cảm hứng du lịch và các
              ưu đãi đặc biệt.
            </p>
            <div className="text-black flex">
              <input
                type="text"
                placeholder="Your Email"
                className="input border lg:w-[10vw] w-[30vw]"
              />
              <button className="btn btn-neutral">
                <IconArrowForward />
              </button>
            </div>
          </div>
        </div>
        <div className="pt-[4vh]">
          © 2025 Golden Plate. All rights reserved.
        </div>
        <a
          href="https://www.facebook.com/sharer/sharer.php?u=https://youtube.com"
          target="_blank"
        >
          Chia sẻ lên Facebook
        </a>
      </div>
    </>
  );
};

export default Footer;
