// import { IconEye, IconShoppingCart, IconStar } from "@tabler/icons-react";
// import { useDispatch } from "react-redux";
// import { useNavigate } from "react-router-dom";
// import { addCartProduct, getCartProduct } from "../redux/client/CartRedux";

// const Card = ({ products }) => {
//   const navigate = useNavigate();
//   const dispatch = useDispatch();
//   const handleSubmit = async (e, productId) => {
//     e.preventDefault();
//     const uploadData = {
//       quantity: 1,
//     };
//     await dispatch(
//       addCartProduct({ productId: productId, uploadData: uploadData })
//     );
//     dispatch(getCartProduct());
//   };
//   return (
//     <>
//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
//         {products?.map((product, idx) => {
//           const discountedPrice = product.discountPercentage
//             ? Number(
//                 (
//                   product.price -
//                   (product.price * product.discountPercentage) / 100
//                 ).toFixed(2)
//               )
//             : product.price;
//           return (
//             <div
//               key={idx}
//               className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
//             >
//               <figure className="relative">
//                 <img
//                   src={product.thumbnail || "/omori.jpeg"}
//                   alt={product.title}
//                   className="h-64 w-full object-cover"
//                 />
//                 {product.discountPercentage && (
//                   <div className="absolute top-3 left-3 badge badge-secondary text-white">
//                     -{product.discountPercentage}%
//                   </div>
//                 )}
//                 {product.featured && (
//                   <div className="absolute top-12 left-3 badge badge-warning text-white">
//                     Featured
//                   </div>
//                 )}
//                 <div className="absolute top-3 right-3 flex flex-col gap-2">
//                   <button className="btn btn-circle btn-sm bg-white hover:bg-gray-100 border-none">
//                     <IconEye className="text-gray-700" />
//                   </button>
//                   <button className="btn btn-circle btn-sm bg-white hover:bg-gray-100 border-none">
//                     <IconShoppingCart className="text-gray-700" />
//                   </button>
//                 </div>
//               </figure>
//               <div className="card-body">
//                 <h3
//                   onClick={() => navigate(`/products/detail/${product.slug}`)}
//                   className="card-title cursor-pointer hover:text-primary transition-colors"
//                 >
//                   {product.title}
//                 </h3>
//                 <p className="text-gray-600 line-clamp-2">
//                   {product.description}
//                 </p>

//                 {/* Rating */}
//                 <div className="flex items-center gap-1">
//                   {[...Array(5)].map((_, i) => (
//                     <IconStar
//                       key={i}
//                       className={`${
//                         i < Math.floor(product.rating || 4)
//                           ? "text-yellow-400"
//                           : "text-gray-300"
//                       }`}
//                     />
//                   ))}
//                   <span className="ml-2 text-gray-600">
//                     ({product.rating || 4})
//                   </span>
//                 </div>

//                 {/* Price */}
//                 <div className="flex items-center gap-3 mt-2">
//                   <span className="text-2xl font-bold text-primary">
//                     ${discountedPrice || product.price}
//                   </span>
//                   {product.price > discountedPrice && (
//                     <span className="text-lg text-gray-400 line-through">
//                       ${product.price}
//                     </span>
//                   )}
//                 </div>

//                 {/* Action Buttons */}
//                 <div className="card-actions justify-between items-center mt-4">
//                   <button
//                     onClick={() => navigate(`/products/detail/${product.slug}`)}
//                     className="btn btn-outline btn-primary btn-sm"
//                   >
//                     View Details
//                   </button>
//                   <button
//                     onClick={(e) => handleSubmit(e, product._id)}
//                     className="btn btn-primary btn-sm gap-2"
//                   >
//                     <IconShoppingCart />
//                     Add to Cart
//                   </button>
//                 </div>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </>
//   );
// };
// export default Card;
import React from "react";
import "./Card.css";

const Card = ({ suit, rank, x, y, width, height, isDragged = false }) => {
  const getSuitSymbol = (suit) => {
    const symbols = {
      SPADES: "♠",
      HEARTS: "♥",
      CLUBS: "♣",
      DIAMONDS: "♦",
    };
    return symbols[suit] || "?";
  };

  const getRankDisplay = (rank) => {
    const rankMap = {
      1: "A",
      11: "J",
      12: "Q",
      13: "K",
    };
    return rankMap[rank] || rank.toString();
  };

  const getSuitColor = (suit) => {
    return suit === "HEARTS" || suit === "DIAMONDS" ? "red" : "black";
  };

  const cardStyle = {
    position: "absolute",
    left: x,
    top: y,
    width,
    height,
    opacity: isDragged ? 0.6 : 1,
    zIndex: isDragged ? 100 : 1,
  };

  return (
    <div className={`card ${getSuitColor(suit)}`} style={cardStyle}>
      <div className="card-corner top-left">
        <div>{getRankDisplay(rank)}</div>
        <div>{getSuitSymbol(suit)}</div>
      </div>
      <div className="card-center">{getSuitSymbol(suit)}</div>
      <div className="card-corner bottom-right">
        <div>{getRankDisplay(rank)}</div>
        <div>{getSuitSymbol(suit)}</div>
      </div>
    </div>
  );
};

export default Card;
