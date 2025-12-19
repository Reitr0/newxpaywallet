// src/navigation/BottomTabs.js
import React, { useCallback, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import HomeScreen from '@src/app/screens/home/HomeScreen';
import MarketScreen from '@src/app/screens/trending/ui/MarketScreen';
import SwapScreen from '@src/app/screens/swap/ui/SwapScreen';
import DappsDiscoverScreen from '@src/app/screens/discover/ui/DappsDiscoverScreen';
import SettingsScreen from '@src/app/screens/setting/ui/SettingsScreen';

import VIcon from '@src/shared/ui/atoms/VIcon';
import VText from '@src/shared/ui/primitives/VText';

const Tab = createBottomTabNavigator();

function getIcon(routeName, focused) {
  switch (routeName) {
    case 'Home':
      return { name: focused ? 'home' : 'home-outline', type: 'MaterialCommunityIcons' };
    case 'Trending':
      return { name: 'trending-up', type: 'Feather' };
    case 'Swap':
      return { name: 'swap-horizontal', type: 'MaterialCommunityIcons' };
    case 'Discover':
      return { name: 'compass-outline', type: 'MaterialCommunityIcons' };
    case 'Setting':
      return { name: 'account-circle', type: 'MaterialCommunityIcons' };
    default:
      return { name: 'circle-outline', type: 'MaterialCommunityIcons' };
  }
}

/** Custom tab bar */
function AppTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // map route names → localized labels
  const labels = useMemo(
    () => ({
      Home: t('nav.home', 'Home'),
      Trending: t('nav.trending', 'Trending'),
      Swap: t('nav.swap', 'Swap'),
      Discover: t('nav.discover', 'Discover'),
      Setting: t('nav.settings', 'Settings'),
    }),
    [t]
  );

  return (
    <View
      className="bg-app border-t-[0.5px] border-border-subtle h-16"
      style={{ paddingBottom: Math.max(insets.bottom, 6) }}
    >
      <View className="flex-row justify-between px-3 pt-2">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const icon = getIcon(route.name, focused);
          const label = labels[route.name] ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel || label}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              className="items-center rounded-full px-4 py-1 flex-1"
              android_ripple={{ color: '#00000010', borderless: false }}
            >
              <View className="relative items-center">
                <VIcon
                  name={icon.name}
                  type={icon.type}
                  size={24}
                  className={focused ? 'text-link' : 'text-muted'}
                />
                {/* Example: tiny red dot on Trending (change/remove if not needed) */}
                {route.name === 'Trending' && (
                  <View className="w-2 h-2 rounded-full bg-danger absolute -top-1 right-3" />
                )}
              </View>
              <VText
                numberOfLines={1}
                className={(focused ? 'text-link' : 'text-muted') + ' text-xs mt-1'}
              >
                {label}
              </VText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function BottomTabs() {
  const renderTabBar = useCallback((props) => <AppTabBar {...props} />, []);
  return (
    <Tab.Navigator
      id="BottomTabs"
      screenOptions={{ headerShown: false }}
      tabBar={renderTabBar}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Trending" component={MarketScreen} />
      <Tab.Screen name="Swap" component={SwapScreen} />
      <Tab.Screen name="Discover" component={DappsDiscoverScreen} />
      <Tab.Screen name="Setting" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
