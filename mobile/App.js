// ============================================================================
// ChAI Mobile — Zero Auth, Face ID, No Keys
// Trust Fund CAN / Diana Smith — All Rights Reserved
// ============================================================================
//
// LEGAL NOTICE — Trust Fund CAN / ChAI AI Ninja
// Malware is malicious software. Any unauthorized access, deployment of
// malicious code, injection attacks, or abuse of this app is strictly
// prohibited. All access is logged. All activity is monitored.
// https://mycan.website
//
// ZERO AUTH:
//   - Face ID unlocks Solana wallet in device Secure Enclave
//   - Wallet signs ed25519 messages for every authenticated action
//   - No passwords. No API keys. No keys visible. No keys stored in memory.
//   - PDA = address. Signature = proof. Chain = authority.
//
// 17 PROGRAMS. 17 LEVELS. ZERO AUTH.
// ============================================================================

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import WalletScreen from './screens/WalletScreen';
import TasksScreen from './screens/TasksScreen';
import RoofScreen from './screens/RoofScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#0a0a0a' },
  headerTintColor: '#b8b8c0',
  headerTitleStyle: { fontWeight: '600', letterSpacing: 1 },
  contentStyle: { backgroundColor: '#0a0a0a' },
  animation: 'fade',
};

export default function App() {
  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: '#029691',
          background: '#0a0a0a',
          card: '#141414',
          text: '#e0e0e0',
          border: '#222222',
          notification: '#029691',
        },
      }}
    >
      <StatusBar style="light" backgroundColor="#0a0a0a" />
      <Stack.Navigator initialRouteName="Auth" screenOptions={screenOptions}>
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: 'CAN_', headerBackVisible: false }}
        />
        <Stack.Screen
          name="Wallet"
          component={WalletScreen}
          options={{ title: 'Wallet' }}
        />
        <Stack.Screen
          name="Tasks"
          component={TasksScreen}
          options={{ title: 'Tasks' }}
        />
        <Stack.Screen
          name="Roof"
          component={RoofScreen}
          options={{ title: 'ROOF' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
