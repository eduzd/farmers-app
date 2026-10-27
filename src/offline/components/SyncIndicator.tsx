import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from '@/components/MayaText';
import { Feather } from '@/components/icons/Feather';
import { useSyncContext } from '@/offline/providers/SyncProvider';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography, BorderRadius } from '@/constants/theme';
import Animated, { useAnimatedStyle, withRepeat, withSequence, withTiming, useSharedValue, withDelay } from 'react-native-reanimated';

import { AppIcon } from "@/components/icons/AppIcon";
export function SyncIndicator() {
  const { syncState, pendingCount, triggerSync, isOnline } = useSyncContext();
  const { theme } = useTheme();

  const rotation = useSharedValue(0);

  React.useEffect(() => {
    if (syncState === 'syncing') {
      rotation.value = withRepeat(
        withSequence(
          withTiming(360, { duration: 1000 }),
        ),
        -1
      );
    } else {
      rotation.value = withTiming(0, { duration: 200 });
    }
  }, [syncState, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (syncState === 'idle' && pendingCount === 0) {
    return null;
  }

  const getStatusColor = () => {
    switch (syncState) {
      case 'syncing':
        return theme.primary;
      case 'success':
        return theme.success;
      case 'error':
        return theme.error;
      case 'offline':
        return theme.warning || '#B25E09';
      default:
        return theme.textSecondary;
    }
  };

  const getStatusIcon = (): keyof typeof Feather.glyphMap => {
    switch (syncState) {
      case 'syncing':
        return 'refresh-cw';
      case 'success':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      case 'offline':
        return 'wifi-off';
      default:
        return 'cloud';
    }
  };

  const getStatusText = () => {
    if (!isOnline) return 'অফলাইন';
    switch (syncState) {
      case 'syncing':
        return 'সিঙ্ক হচ্ছে...';
      case 'success':
        return 'সিঙ্ক সম্পন্ন';
      case 'error':
        return 'সিঙ্ক ব্যর্থ';
      default:
        return pendingCount > 0 ? `${pendingCount}টি অপেক্ষমান` : '';
    }
  };

  return (
    <Pressable
      style={[
        styles.container,
        { backgroundColor: theme.card, borderColor: getStatusColor() },
      ]}
      onPress={() => {
        if (isOnline && (syncState === 'idle' || syncState === 'error')) {
          triggerSync();
        }
      }}
    >
      <Animated.View style={syncState === 'syncing' ? animatedStyle : undefined}>
        <AppIcon name={getStatusIcon()} size={14} color={getStatusColor()} />
      </Animated.View>
      <Text style={[styles.text, { color: getStatusColor() }]}>
        {getStatusText()}
      </Text>
    </Pressable>
  );
}

export function CompactSyncIndicator() {
  const { syncState, pendingCount, isOnline } = useSyncContext();
  const { theme } = useTheme();

  if (syncState === 'idle' && pendingCount === 0 && isOnline) {
    return null;
  }

  const getColor = () => {
    if (!isOnline) return theme.warning || '#B25E09';
    switch (syncState) {
      case 'syncing':
        return theme.primary;
      case 'error':
        return theme.error;
      default:
        return theme.textSecondary;
    }
  };

  return (
    <View style={[styles.compactContainer, { backgroundColor: getColor() }]}>
      {pendingCount > 0 && (
        <Text style={styles.compactText}>{pendingCount}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  text: {
    fontSize: Typography.sizes.xs,
    fontWeight: '500',
  },
  compactContainer: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
