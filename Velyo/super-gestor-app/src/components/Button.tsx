import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  title, 
  onPress, 
  variant = 'primary', 
  loading = false,
  className = ''
}) => {
  const baseStyles = "py-4 px-6 rounded-2xl flex-row items-center justify-center";
  const variants = {
    primary: "bg-blue-600 shadow-md active:bg-blue-700",
    secondary: "bg-slate-200 active:bg-slate-300",
    outline: "bg-transparent border border-slate-200 active:bg-slate-50"
  };

  const textVariants = {
    primary: "text-white font-bold text-lg",
    secondary: "text-slate-900 font-bold text-lg",
    outline: "text-slate-600 font-bold text-lg"
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? "white" : "#64748b"} />
      ) : (
        <Text className={textVariants[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
