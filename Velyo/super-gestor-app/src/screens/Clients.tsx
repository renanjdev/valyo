import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Search, User } from 'lucide-react-native';

export default function Clients() {
  const clients = [
    { id: '1', name: 'João da Silva', phone: '(11) 98888-7777', email: 'joao@email.com' },
    { id: '2', name: 'Maria Oliveira', phone: '(21) 97777-6666', email: 'maria@email.com' },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-slate-900">Clientes</Text>
          <TouchableOpacity className="bg-blue-600 p-2 rounded-full shadow-md">
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 mb-6 flex-row items-center">
          <Search size={20} color="#94a3b8" />
          <Text className="text-slate-400 ml-2">Buscar cliente...</Text>
        </View>

        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
                <User size={24} color="#2563eb" />
              </View>
              <View>
                <Text className="text-slate-900 font-bold text-lg">{item.name}</Text>
                <Text className="text-slate-500">{item.phone}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
