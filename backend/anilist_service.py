import httpx
from typing import List, Optional, Dict, Any

class AnilistService:
    API_URL = "https://graphql.anilist.co"

    @staticmethod
    async def _query(query_str: str, variables: Dict[str, Any] = None):
        async with httpx.AsyncClient(timeout=30.0) as client:
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
        if not data: return []
        
        results = []
        for m in data.get('Page', {}).get('media', []):
            results.append({
                "id": str(m['id']),
                "title": m['title']['english'] or m['title']['romaji'] or m['title']['native'],
                "poster_url": m['coverImage']['extraLarge'] or m['coverImage']['large'],
                "banner_url": m['bannerImage'],
                "description": m['description'],
                "episodes": m['episodes'],
                "type": "anime",
                "source": "anilist"
            })
        return results

    @staticmethod
    async def get_top_100(page: int = 1, per_page: int = 100) -> List[dict]:
        query = """
        query ($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            media(type: ANIME, sort: SCORE_DESC) {
              id
              title { romaji english native }
              coverImage { extraLarge large }
              episodes
            }
          }
        }
        """
        data = await AnilistService._query(query, {"page": page, "perPage": per_page})
        if not data: return []
        
        results = []
        for m in data.get('Page', {}).get('media', []):
            results.append({
                "id": str(m['id']),
                "title": m['title']['english'] or m['title']['romaji'] or m['title']['native'],
                "poster_url": m['coverImage']['extraLarge'] or m['coverImage']['large'],
                "type": "anime",
                "source": "anilist"
            })
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
        if not data: return []
        
        results = []
        for m in data.get('Page', {}).get('media', []):
            results.append({
                "id": str(m['id']),
                "title": m['title']['english'] or m['title']['romaji'] or m['title']['native'],
                "poster_url": m['coverImage']['extraLarge'] or m['coverImage']['large'],
                "type": "anime",
                "source": "anilist"
            })
        return results

    @staticmethod
    async def get_info(anime_id: str) -> Optional[dict]:
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
          }
        }
        """
        try:
            data = await AnilistService._query(query, {"id": int(anime_id)})
            if not data: return None
            
            m = data.get('Media', {})
            return {
                "id": str(m['id']),
                "title": m['title']['english'] or m['title']['romaji'] or m['title']['native'],
                "plot": m['description'],
                "poster_url": m['coverImage']['extraLarge'] or m['coverImage']['large'],
                "banner_url": m['bannerImage'],
                "episodes_count": m['episodes'],
                "status": m['status'],
                "genres": m['genres'],
                "rating": (m['averageScore'] / 10) if m['averageScore'] else 0,
                "year": m['seasonYear'],
                "type": "anime",
                "source": "anilist",
                "hasFullDetails": True
            }
        except Exception as e:
            print(f"[AnilistService] get_info error: {e}")
            return None
