import "./src/global.css";
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LayoutDashboard, Users, FileText, Settings } from 'lucide-react-native';

// Screens
import Dashboard from './src/screens/Dashboard';
import Clients from './src/screens/Clients';
import Orders from './src/screens/Orders';
import AddClient from './src/screens/AddClient';
import NewOrder from './src/screens/NewOrder';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-50">
      <Text className="text-slate-900 font-bold text-xl">Configurações</Text>
      <Text className="text-slate-400">Em desenvolvimento...</Text>
    </View>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#f1f5f9',
            height: 65,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Início') return <LayoutDashboard size={size} color={color} />;
            if (route.name === 'Clientes') return <Users size={size} color={color} />;
            if (route.name === 'Serviços') return <FileText size={size} color={color} />;
            if (route.name === 'Ajustes') return <Settings size={size} color={color} />;
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
          }
        })}
      >
        <Tab.Screen name="Início" component={Dashboard} />
        <Tab.Screen name="Clientes" component={Clients} />
        <Tab.Screen name="Serviços" component={Orders} />
        <Tab.Screen name="Ajustes" component={SettingsScreen} />
      </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="AddClient" component={AddClient} />
        <Stack.Screen name="NewOrder" component={NewOrder} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
