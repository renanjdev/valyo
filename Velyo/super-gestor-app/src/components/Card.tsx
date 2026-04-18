import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <View 
      className={`bg-white p-4 rounded-3xl shadow-sm border border-slate-50 ${className}`} 
      {...props}
    >
      {children}
    </View>
  );
};
