from gaanapy import GaanaPy
from typing import List, Optional, Dict, Any

class MusicService:
    def __init__(self):
        self._gaanapy = None

    @property
    def gaanapy(self):
        if self._gaanapy is None:
            self._gaanapy = GaanaPy()
        return self._gaanapy

    async def search_songs(self, query: str, limit: int = 20):
        # Result is already a list or dict from gaanapy
        return await self.gaanapy.search_songs(query, limit)

    async def get_song_info(self, seokey: str):
        # gaanapy.get_track_info takes a list of seokeys
        result = await self.gaanapy.get_track_info([seokey])
        return result[0] if result else None

    async def search_albums(self, query: str, limit: int = 10):
        return await self.gaanapy.search_albums(query, limit)

    async def get_album_info(self, seokey: str):
        # gaanapy.get_album_info takes a list of seokeys and a detail flag
        result = await self.gaanapy.get_album_info([seokey], True)
        return result[0] if result else None

    async def get_trending(self, language: str = "English"):
        return await self.gaanapy.get_trending(language, 20)

    async def get_new_releases(self, language: str = "English"):
        return await self.gaanapy.get_new_releases(language, 20)

    async def get_charts(self):
        return await self.gaanapy.get_charts(20)

    async def get_playlist_info(self, seokey: str):
        return await self.gaanapy.get_playlist_info(seokey)
