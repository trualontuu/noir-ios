// Переходы к артисту/альбому/плейлисту внутри текущей вкладки (у «Моё» и «Поиска» свои стеки).
// С «Волны» и из полноэкранного плеера — во вкладку поиска.
import { router, usePathname } from 'expo-router';
import type { Playlist } from '../ym';

export function useNav() {
  const path = usePathname();
  const tab = path.startsWith('/library') ? 'library' : 'search';
  const go = (screen: 'artist' | 'album' | 'list', params: Record<string, string>) => {
    if (path === '/player') router.back();
    router.push({ pathname: `/${tab}/${screen}` as any, params });
  };
  return {
    artist: (id: string, name = '') => go('artist', { id, name }),
    album: (id: string, title = '') => go('album', { id, title }),
    playlist: (p: Playlist) => go('list', { owner: p.owner, kind: p.kind, title: p.title, cover: p.coverUri }),
  };
}
