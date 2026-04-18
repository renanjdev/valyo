import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  className?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <View className={`mb-4 ${className}`}>
      <Text className="text-slate-500 text-xs font-semibold uppercase mb-2 ml-1">
        {label}
      </Text>
      <View className={`bg-white border ${error ? 'border-red-500' : 'border-slate-100'} p-4 rounded-2xl shadow-sm`}>
        <TextInput 
          className="text-slate-900 text-lg"
          placeholderTextColor="#94a3b8"
          {...props}
        />
      </View>
      {error && <Text className="text-red-500 text-xs mt-1 ml-1">{error}</Text>}
    </View>
  );
};
