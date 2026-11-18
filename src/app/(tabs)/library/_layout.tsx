import { Stack } from 'expo-router/stack';
import { detailOptions, stackOptions } from '../../../ui/stackOptions';

export default function LibraryStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="list" options={detailOptions} />
      <Stack.Screen name="album" options={detailOptions} />
      <Stack.Screen name="artist" options={detailOptions} />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
