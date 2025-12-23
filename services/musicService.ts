
export interface ExtendedAlbum {
  id: string;
  name: string;
  artist: string;
  year: string;
  imageUrl: string;
  fallbackTracks: any[];
}

/**
 * Searches for albums globally without forcing a specific country initially.
 * This ensures we find artists that might only be in specific local storefronts.
 */
export const searchAlbums = async (query: string) => {
  try {
    // Search without country code first to get the most inclusive list of albums
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=200`;
    console.log("Searching discography:", url);
    
    const res = await fetch(url).catch(err => {
      console.error("Fetch network error:", err);
      throw new Error("Network error while searching discography");
    });

    if (!res.ok) throw new Error(`Search request failed with status: ${res.status}`);
    
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

    // Return unique albums sorted by year
    const uniqueAlbums = Array.from(new Map(albums.map(a => [a.id, a])).values());
    return uniqueAlbums.sort((a, b) => parseInt(b.year) - parseInt(a.year));
  } catch (error) {
    console.error("Critical Discography Failure:", error);
    return [];
  }
};

/**
 * Retrieves tracks for an album using a fallback mechanism to maximize the chance of finding audio previews.
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
    
    // Step 1: Try default (based on IP location)
    let tracks = await fetchWithCountry();
    
    // Step 2: Fallback to US storefront (most robust preview library)
    if (tracks.length === 0) {
      console.warn("No default tracks found, attempting US storefront...");
      tracks = await fetchWithCountry('US');
    }

    // Step 3: Fallback to UK storefront (another major hub)
    if (tracks.length === 0) {
      console.warn("No US tracks found, attempting UK storefront...");
      tracks = await fetchWithCountry('GB');
    }
      
    console.log(`Retrieved ${tracks.length} valid audio tracks for album ${albumId}`);
    return tracks;
  } catch (error) {
    console.error("Track Extraction Error:", error);
    return [];
  }
};
