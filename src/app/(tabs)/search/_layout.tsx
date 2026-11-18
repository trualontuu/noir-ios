import { Stack } from 'expo-router/stack';
import { detailOptions, searchHeader, stackOptions } from '../../../ui/stackOptions';

export default function SearchStack() {
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={searchHeader} />
      <Stack.Screen name="list" options={detailOptions} />
      <Stack.Screen name="album" options={detailOptions} />
      <Stack.Screen name="artist" options={detailOptions} />
    </Stack>
  );
}
