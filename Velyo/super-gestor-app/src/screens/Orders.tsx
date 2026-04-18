import React from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus, Clock } from 'lucide-react-native';
import { MOCK_ORDERS } from '../lib/mockData';

export default function Orders() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="p-6">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-2xl font-bold text-slate-900">Ordens de Serviço</Text>
          <TouchableOpacity 
            onPress={() => navigation.navigate('NewOrder')}
            className="bg-blue-600 p-2 rounded-full shadow-md"
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2 mb-6">
          <TouchableOpacity className="bg-blue-100 px-4 py-2 rounded-full border border-blue-200">
            <Text className="text-blue-700 font-medium text-xs">Todas</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-white px-4 py-2 rounded-full border border-slate-200">
            <Text className="text-slate-600 font-medium text-xs">Pendentes</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={MOCK_ORDERS}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-slate-900 font-bold text-lg">OS #{item.id}</Text>
                <View className={`px-2 py-1 rounded-full ${item.status === 'Concluído' ? 'bg-green-100' : 'bg-amber-100'}`}>
                   <Text className={`text-[10px] font-bold ${item.status === 'Concluído' ? 'text-green-700' : 'text-amber-700'}`}>
                     {item.status.toUpperCase()}
                   </Text>
                </View>
              </View>
              
              <Text className="text-slate-500 mb-4">{item.clientName}</Text>
              
              <View className="flex-row justify-between items-center pt-4 border-t border-slate-50">
                <View className="flex-row items-center">
                  <Clock size={16} color="#94a3b8" />
                  <Text className="text-slate-400 text-xs ml-1">{item.date}</Text>
                </View>
                <Text className="text-slate-900 font-bold">{item.value}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
