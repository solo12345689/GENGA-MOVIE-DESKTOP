import httpx
from typing import List, Optional, Dict, Any
import time

class AnilistService:
    API_URL = "https://graphql.anilist.co"
    _cache = {}

    @staticmethod
    def _get_cache(key: str, max_age: float = 300.0):
        val = AnilistService._cache.get(key)
        if val:
            ts, data = val
            if time.time() - ts < max_age:
                return data
        return None

    @staticmethod
    def _set_cache(key: str, data: Any):
        AnilistService._cache[key] = (time.time(), data)

    @staticmethod
    async def _query(query_str: str, variables: Dict[str, Any] = None):
        async with httpx.AsyncClient(verify=False, timeout=15.0) as client:
            try:
                resp = await client.post(AnilistService.API_URL, json={'query': query_str, 'variables': variables or {}})
                if resp.status_code != 200:
                    print(f"[AnilistService] API error {resp.status_code}: {resp.text[:500]}")
                    return None
                return resp.json().get('data', {})
            except Exception as e:
                print(f"[AnilistService] Query exception: {e}")
                return None

    @staticmethod
    async def get_trending(page: int = 1, per_page: int = 50) -> List[dict]:
        cache_key = f"trending_{page}_{per_page}"
        cached = AnilistService._get_cache(cache_key, max_age=36000.0) # 10 hours
        if cached is not None:
            return cached

        query = """
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id
              title { romaji english native }
              coverImage { extraLarge large }
              bannerImage
              episodes
              description
            }
          }
        }
        """
        data = await AnilistService._query(query, {"page": page, "perPage": per_page})
        if not data:
            return []
        
        results = []
        for m in data.get('Page', {}).get('media', []):
            if not m or not isinstance(m, dict):
                continue
            title_dict = m.get('title') or {}
            title = title_dict.get('english') or title_dict.get('romaji') or title_dict.get('native') or "Unknown Title"
            
            cover_dict = m.get('coverImage') or {}
            poster_url = cover_dict.get('extraLarge') or cover_dict.get('large') or ""
            
            results.append({
                "id": str(m.get('id', '')),
                "title": title,
                "poster_url": poster_url,
                "banner_url": m.get('bannerImage') or "",
                "description": m.get('description') or "",
                "episodes": m.get('episodes'),
                "type": "anime",
                "source": "anilist"
            })
            
        if results:
            AnilistService._set_cache(cache_key, results)
        return results

    @staticmethod
    async def search(query_str: str, page: int = 1, per_page: int = 20) -> List[dict]:
        search_query = """
        query ($page: Int, $perPage: Int, $search: String) {
          Page(page: $page, perPage: $perPage) {
            media(type: ANIME, search: $search) {
              id
              title { romaji english native }
              coverImage { extraLarge large }
              episodes
            }
          }
        }
        """
        data = await AnilistService._query(search_query, {"page": page, "perPage": per_page, "search": query_str})
        if not data:
            return []
        
        results = []
        for m in data.get('Page', {}).get('media', []):
            if not m or not isinstance(m, dict):
                continue
            title_dict = m.get('title') or {}
            title = title_dict.get('english') or title_dict.get('romaji') or title_dict.get('native') or "Unknown Title"
            
            cover_dict = m.get('coverImage') or {}
            poster_url = cover_dict.get('extraLarge') or cover_dict.get('large') or ""
            
            results.append({
                "id": str(m.get('id', '')),
                "title": title,
                "poster_url": poster_url,
                "type": "anime",
                "source": "anilist"
            })
        return results

    @staticmethod
    async def get_info(anime_id: str) -> Optional[dict]:
        cache_key = f"info_{anime_id}"
        cached = AnilistService._get_cache(cache_key, max_age=1800.0) # 30 minutes
        if cached is not None:
            return cached

        query = """
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title { romaji english native }
            description
            coverImage { extraLarge large }
            bannerImage
            episodes
            status
            genres
            averageScore
            seasonYear
            nextAiringEpisode { episode }
          }
        }
        """
        try:
            data = await AnilistService._query(query, {"id": int(anime_id)})
            if not data:
                return None
            
            m = data.get('Media', {})
            if not m:
                return None
            title_dict = m.get('title') or {}
            title = title_dict.get('english') or title_dict.get('romaji') or title_dict.get('native') or "Unknown Title"
            
            cover_dict = m.get('coverImage') or {}
            poster_url = cover_dict.get('extraLarge') or cover_dict.get('large') or ""
            
            next_ep = m.get('nextAiringEpisode')
            next_ep_num = next_ep.get('episode') if (next_ep and isinstance(next_ep, dict)) else None

            results = {
                "id": str(m.get('id', '')),
                "title": title,
                "plot": m.get('description') or "",
                "poster_url": poster_url,
                "banner_url": m.get('bannerImage') or "",
                "episodes_count": m.get('episodes'),
                "next_ep_num": next_ep_num,
                "status": m.get('status') or "UNKNOWN",
                "genres": m.get('genres') or [],
                "rating": (m.get('averageScore', 0) / 10) if m.get('averageScore') else 0,
                "year": m.get('seasonYear'),
                "type": "anime",
                "source": "anilist",
                "hasFullDetails": True
            }
            if results:
                AnilistService._set_cache(cache_key, results)
            return results
        except Exception as e:
            print(f"[AnilistService] get_info error: {e}")
            return None
