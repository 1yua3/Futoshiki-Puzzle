import React from "react";
import "./Button.css";

const Button = ({
  children,
  onClick,
  color = "blue",
  disabled = false,
  className = "",
}) => {
  const getColorClass = () => {
    const colors = {
      blue: "btn-blue",
      orange: "btn-orange",
      gray: "btn-gray",
      purple: "btn-purple",
      green: "btn-green",
      red: "btn-red",
    };
    return colors[color] || colors.blue;
  };

  return (
    <button
      className={`btn ${getColorClass()} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
