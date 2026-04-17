import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LayoutDashboard, Users, FileText, Settings, User } from 'lucide-react-native';

export default function Dashboard() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-6">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-slate-400 text-sm">Bem-vindo,</Text>
            <Text className="text-2xl font-bold text-slate-900">Renan</Text>
          </View>
          <TouchableOpacity className="bg-white p-2 rounded-full shadow-sm border border-slate-100">
            <User size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-4 mb-8">
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <Text className="text-slate-400 text-xs mb-1">A receber</Text>
            <Text className="text-lg font-bold text-slate-900">R$ 1.250</Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <Text className="text-slate-400 text-xs mb-1">OS Abertas</Text>
            <Text className="text-lg font-bold text-slate-900">12</Text>
          </View>
        </View>

        {/* Action Grid */}
        <Text className="text-lg font-semibold text-slate-900 mb-4">Ações Rápidas</Text>
        <View className="flex-row flex-wrap gap-4">
          <TouchableOpacity className="bg-blue-600 w-[47%] p-4 rounded-2xl shadow-md items-center">
            <View className="bg-blue-500 p-3 rounded-xl mb-2">
              <FileText size={24} color="white" />
            </View>
            <Text className="text-white font-medium">Nova OS</Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="bg-white w-[47%] p-4 rounded-2xl shadow-sm border border-slate-100 items-center">
            <View className="bg-slate-50 p-3 rounded-xl mb-2">
              <Users size={24} color="#334155" />
            </View>
            <Text className="text-slate-700 font-medium">Clientes</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <Text className="text-lg font-semibold text-slate-900 mt-8 mb-4">Atividade Recente</Text>
        <View className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {[1, 2, 3].map((item) => (
            <View key={item} className="p-4 border-b border-slate-50 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center mr-3">
                <FileText size={20} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-900 font-medium">OS #2024-00{item}</Text>
                <Text className="text-slate-400 text-xs">Cliente: João da Silva</Text>
              </View>
              <Text className="text-slate-900 font-bold">R$ 450</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
