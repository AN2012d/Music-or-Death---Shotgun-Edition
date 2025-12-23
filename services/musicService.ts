
export interface ExtendedAlbum {
  id: string;
  name: string;
  artist: string;
  year: string;
  imageUrl: string;
  fallbackTracks: any[];
}

/**
 * Searches for albums globally with enhanced error handling for Netlify and browser environments.
 */
export const searchAlbums = async (query: string) => {
  try {
    // Force HTTPS and use clear terms
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=200`;
    console.log("Searching discography:", url);
    
    const res = await fetch(url).catch(err => {
      console.error("Network error during search:", err);
      throw new Error("FAILED_TO_FETCH");
    });

    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    const albums: ExtendedAlbum[] = data.results
      .filter((item: any) => item.collectionId && item.collectionName)
      .map((item: any) => ({
        id: String(item.collectionId),
        name: item.collectionName,
        artist: item.artistName || "Unknown Artist",
        year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
        imageUrl: item.artworkUrl100 ? item.artworkUrl100.replace("100x100", "600x600") : '',
        fallbackTracks: []
      }));

    // deduplicate and sort
    const uniqueAlbums = Array.from(new Map(albums.map(a => [a.id, a])).values());
    return uniqueAlbums.sort((a, b) => parseInt(b.year) - parseInt(a.year));
  } catch (error) {
    console.error("Critical Discography Failure:", error);
    return [];
  }
};

/**
 * Retrieves tracks with a fallback chain (Default -> US -> UK) to find audio previews.
 */
export const getAlbumTracks = async (albumId: string) => {
  const fetchWithCountry = async (country?: string) => {
    try {
      const countryParam = country ? `&country=${country}` : '';
      const url = `https://itunes.apple.com/lookup?id=${albumId}&entity=song&limit=200${countryParam}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results) return [];
      
      return data.results
        .filter((item: any) => (item.wrapperType === 'track' || item.kind === 'song'))
        .map((t: any) => ({
          id: String(t.trackId),
          name: t.trackName,
          previewUrl: t.previewUrl ? t.previewUrl.replace("http://", "https://") : undefined
        }))
        .filter((t: any) => t.previewUrl);
    } catch (e) {
      console.warn(`Fetch for country ${country || 'default'} failed:`, e);
      return [];
    }
  };

  try {
    console.log("Loading tracks for album ID:", albumId);
    
    // Chain attempts to find audio
    let tracks = await fetchWithCountry();
    if (tracks.length === 0) tracks = await fetchWithCountry('US');
    if (tracks.length === 0) tracks = await fetchWithCountry('GB');
      
    console.log(`Retrieved ${tracks.length} audio tracks for album ${albumId}`);
    return tracks;
  } catch (error) {
    console.error("Track Extraction Error:", error);
    return [];
  }
};
