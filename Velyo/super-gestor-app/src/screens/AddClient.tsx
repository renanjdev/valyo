import React, { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';

export default function AddClient() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const handleSave = () => {
    if (!form.name || !form.phone) {
      Alert.alert('Ops!', 'Nome e telefone são obrigatórios.');
      return;
    }

    setLoading(true);
    
    // Simulating save for local testing
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Sucesso!', 'Cliente cadastrado localmente.', [
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
          <Text className="text-2xl font-bold text-slate-900">Novo Cliente</Text>
        </View>

        {/* Form */}
        <View>
          <Input 
            label="Nome Completo" 
            placeholder="Ex: João da Silva"
            value={form.name}
            onChangeText={(t) => setForm({...form, name: t})}
          />
          <Input 
            label="Telefone / WhatsApp" 
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(t) => setForm({...form, phone: t})}
          />
          <Input 
            label="E-mail" 
            placeholder="exemplo@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={form.email}
            onChangeText={(t) => setForm({...form, email: t})}
          />
          <Input 
            label="Endereço" 
            placeholder="Rua, Número, Bairro..."
            multiline
            numberOfLines={2}
            value={form.address}
            onChangeText={(t) => setForm({...form, address: t})}
          />
        </View>

        <Button 
          title="Cadastrar Cliente" 
          onPress={handleSave} 
          loading={loading}
          className="mt-6"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
