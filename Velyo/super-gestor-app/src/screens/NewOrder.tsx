import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';

export default function NewOrder() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string; price: string }[]>([]);

  const handleCreateOrder = () => {
    if (items.length === 0) {
      Alert.alert('Ops!', 'Adicione pelo menos um item ao pedido.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Sucesso!', 'Ordem de Serviço criada localmente.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }, 1000);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1 p-6">
        {/* Header */}
        <View className="flex-row items-center mb-8">
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-10 h-10 bg-white items-center justify-center rounded-full mr-4 shadow-sm border border-slate-100"
          >
            <ArrowLeft size={20} color="#334155" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-slate-900">Nova OS</Text>
        </View>

        {/* Step 1: Select Client */}
        <Text className="text-slate-500 text-xs font-semibold uppercase mb-3 ml-1">Cliente</Text>
        <TouchableOpacity className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex-row justify-between items-center mb-8">
          <Text className="text-slate-400 text-lg">Selecionar cliente...</Text>
          <ChevronRight size={20} color="#94a3b8" />
        </TouchableOpacity>

        {/* Step 2: Items */}
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-slate-500 text-xs font-semibold uppercase ml-1">Itens do Pedido</Text>
          <TouchableOpacity className="flex-row items-center">
            <Plus size={16} color="#2563eb" />
            <Text className="text-blue-600 font-bold text-xs ml-1">Adicionar Item</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View className="bg-slate-100 p-8 rounded-2xl items-center border border-dashed border-slate-300 mb-8">
            <Text className="text-slate-400 text-center">Nenhum item adicionado ainda.</Text>
          </View>
        ) : (
          <View className="mb-8">
            {/* List items here */}
          </View>
        )}

        {/* Total Preview */}
        <Card className="mb-8 bg-blue-50 border-blue-100">
          <View className="flex-row justify-between items-center">
            <Text className="text-blue-900 font-medium">Total Estimado</Text>
            <Text className="text-2xl font-bold text-blue-900">R$ 0,00</Text>
          </View>
        </Card>

        <Button 
          title="Salvar Ordem de Serviço" 
          onPress={handleCreateOrder} 
          loading={loading}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
