import React from 'react';
import { useSnapshot } from 'valtio';
import { authStore } from '@src/features/auth/state/authStore';
import AppStack from '@src/app/navigation/AppStack';
import AuthStack from '@src/app/navigation/AuthStack';

export default function NavigationRoot() {
  const {isAuthenticated} = useSnapshot(authStore);
  return isAuthenticated ?   <AppStack /> : <AuthStack />
}
