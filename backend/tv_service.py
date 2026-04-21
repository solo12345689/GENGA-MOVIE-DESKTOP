import httpx
import re

class TVService:
    def __init__(self):
        self.base_url = "https://raw.githubusercontent.com/famelack/famelack-data/main/tv/raw"
        self.client = httpx.AsyncClient(timeout=20.0)
        self.cache = {}

    async def get_countries(self):
        """Fetches the list of countries with channels."""
        if 'countries' in self.cache:
            return self.cache['countries']

        url = f"{self.base_url}/countries_metadata.json"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            data = response.json()

            # Data format: {"AD": {"country": "Andorra", "hasChannels": true, ...}, ...}
            import asyncio
            import json
            import os

            cache_file = os.path.join(os.getcwd(), 'tv_counts_cache.json')
            cached_counts = {}
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r') as f:
                        cached_counts = json.load(f)
                except: pass

            semaphore = asyncio.Semaphore(10)
            async def get_count(code):
                if code in cached_counts:
                    return cached_counts[code]
                async with semaphore:
                    try:
                        r = await self.client.get(f"{self.base_url}/countries/{code.lower()}.json")
                        if r.status_code == 200:
                            count = len(r.json())
                            cached_counts[code] = count
                            return count
                    except: pass
                return 0

            # Collect active countries
            tasks = []
            selected_countries = []
            for code, info in data.items():
                if isinstance(info, dict) and info.get('hasChannels'):
                    tasks.append(get_count(code))
                    selected_countries.append((code, info))

            print(f"[TVService] Scanning {len(tasks)} countries for channel counts...")
            counts = await asyncio.gather(*tasks)
            
            # Save cache
            try:
                with open(cache_file, 'w') as f:
                    json.dump(cached_counts, f)
            except: pass

            countries = []
            for (code, info), count in zip(selected_countries, counts):
                flag = ''
                if len(code) == 2 and code.isalpha():
                    flag = ''.join(chr(0x1F1E6 + ord(c) - ord('A')) for c in code.upper())
                name = info.get('country', code)
                countries.append({
                    "id": code.lower(),
                    "title": f"{flag} {name}" if flag else name,
                    "name": name,
                    "poster_url": "",
                    "type": "country",
                    "source": "tv",
                    "timezone": info.get('timeZone') or info.get('LimeZone'),
                    "total_channels": count
                })

            countries.sort(key=lambda x: x["name"])
            self.cache['countries'] = countries
            return countries
        except Exception as e:
            print(f"[TVService] Error fetching countries: {e}")
            return []

    async def get_channels_by_country(self, country_code: str):
        """Fetches channels for a specific country code."""
        code = country_code.lower()
        cache_key = f"country_{code}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        url = f"{self.base_url}/countries/{code}.json"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            channels = response.json()
            result = []
            for c in channels:
                formatted = self._format_channel(c)
                if formatted:
                    result.append(formatted)
            self.cache[cache_key] = result
            return result
        except Exception as e:
            print(f"[TVService] Error fetching channels for country {code}: {e}")
            import traceback; traceback.print_exc()
            return []

    async def get_channels_by_category(self, category: str):
        """Fetches channels for a specific category."""
        cat = category.lower()
        cache_key = f"cat_{cat}"
        if cache_key in self.cache:
            return self.cache[cache_key]

        url = f"{self.base_url}/categories/{cat}.json"
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            channels = response.json()
            result = []
            for c in channels:
                formatted = self._format_channel(c)
                if formatted:
                    result.append(formatted)
            self.cache[cache_key] = result
            return result
        except Exception as e:
            print(f"[TVService] Error fetching channels for category {cat}: {e}")
            return []

    def _extract_youtube_id(self, url: str):
        """
        Extracts the video ID or channel ID from a YouTube embed URL.
        Examples:
          https://www.youtube-nocookie.com/embed/byG7EGw9NPs  -> byG7EGw9NPs
          https://www.youtube.com/embed/live_stream?channel=UCxxxxxx -> UCxxxxxx (channel)
        Returns (id, id_type) where id_type is 'video' or 'channel'
        """
        # Check for live_stream?channel=UC... format
        channel_match = re.search(r'[?&]channel=([A-Za-z0-9_-]+)', url)
        if channel_match:
            return channel_match.group(1), 'channel'

        # Standard embed format: /embed/VIDEO_ID
        video_match = re.search(r'/embed/([A-Za-z0-9_-]{11})', url)
        if video_match:
            return video_match.group(1), 'video'

        # watch?v=VIDEO_ID format
        watch_match = re.search(r'watch\?v=([A-Za-z0-9_-]{11})', url)
        if watch_match:
            return watch_match.group(1), 'video'

        # youtu.be/VIDEO_ID format
        short_match = re.search(r'youtu\.be/([A-Za-z0-9_-]{11})', url)
        if short_match:
            return short_match.group(1), 'video'

        # channel/UCxxxx format
        chan_path_match = re.search(r'channel/([A-Za-z0-9_-]+)', url)
        if chan_path_match:
            return chan_path_match.group(1), 'channel'

        return None, None

    def _format_channel(self, c: dict):
        name = c.get('name', 'Unknown Channel')

        iptv_urls = [u for u in (c.get('stream_urls') or []) if u and u.strip()]
        youtube_urls = [u for u in (c.get('youtube_urls') or []) if u and u.strip()]

        # Priority 1: Direct IPTV (HLS)
        if iptv_urls:
            return {
                "id": c.get('nanoid', name.replace(' ', '_').lower()),
                "title": name,
                "poster_url": c.get('logo', ''),
                "url": iptv_urls[0],
                "stream_type": "hls",
                "source": "tv",
                "type": "channel"
            }
        
        # Priority 2: YouTube Live (Local HLS resolution via yt-dlp)
        if youtube_urls:
            yt_url = youtube_urls[0]
            yt_id, id_type = self._extract_youtube_id(yt_url)
            
            # If we extracted an ID, use it. If not, use the full URL as the yt_id 
            # (the backend resolve endpoint will handle both).
            final_yt_id = yt_id if yt_id else yt_url
            
            return {
                "id": c.get('nanoid', name.replace(' ', '_').lower()),
                "title": name,
                "poster_url": c.get('logo', ''),
                "yt_id": final_yt_id,
                "stream_type": "youtube_hls",
                "source": "tv",
                "type": "channel"
            }
        
        return None

    async def close(self):
        await self.client.aclose()
