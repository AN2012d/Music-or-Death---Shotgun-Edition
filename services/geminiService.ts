
import { GoogleGenAI, Type } from "@google/genai";
import { Album, Track, GameChallenge, Difficulty } from "../types";

export const getAlbumChallenge = async (album: Album, spotifyTracks: any[], difficulty: Difficulty): Promise<GameChallenge> => {
  // Create instance right before call to use the latest API key from the environment/dialog
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const trackNames = spotifyTracks.map(t => t.name);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Album: ${album.name} by ${album.artist}. 
      Tracks available: ${trackNames.join(', ')}.
      1. Select 1 correct track that has a clear intro.
      2. Select 3 other different real tracks from this list as wrong answers.
      3. Ensure the selection is difficult (similar names or styles).
      4. Provide a 1-sentence description in Hebrew for the vibe.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctTrackName: { type: Type.STRING },
            wrongTrackNames: { type: Type.ARRAY, items: { type: Type.STRING } },
            vibeDescription: { type: Type.STRING }
          },
          required: ["correctTrackName", "wrongTrackNames", "vibeDescription"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    const correctSpotifyTrack = spotifyTracks.find(t => t.name === data.correctTrackName) || spotifyTracks[0];
    const options = [
      { id: correctSpotifyTrack.id, name: correctSpotifyTrack.name, previewUrl: correctSpotifyTrack.previewUrl },
      ...data.wrongTrackNames.map((name: string) => {
        const t = spotifyTracks.find(st => st.name === name) || spotifyTracks[Math.floor(Math.random() * spotifyTracks.length)];
        return { id: t.id, name: t.name, previewUrl: t.previewUrl };
      })
    ].slice(0, 4).sort(() => Math.random() - 0.5);

    return {
      correctTrack: { id: correctSpotifyTrack.id, name: correctSpotifyTrack.name, previewUrl: correctSpotifyTrack.previewUrl },
      options: options,
      snippetDescription: data.vibeDescription
    };
  } catch (error: any) {
    console.warn("Gemini API failed, using local fallback generation:", error);
    
    // Check if it's a quota or auth error to signal UI
    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
       throw error; // Re-throw so the UI can prompt for a key if it wants
    }

    // Local Fallback Logic: just pick random tracks so the game doesn't stop
    const shuffled = [...spotifyTracks].sort(() => Math.random() - 0.5);
    const correct = shuffled[0];
    const wrong = shuffled.slice(1, 4);
    
    return {
      correctTrack: { id: correct.id, name: correct.name, previewUrl: correct.previewUrl },
      options: [correct, ...wrong].sort(() => Math.random() - 0.5),
      snippetDescription: `מצב הישרדות: זהה את השיר מהאלבום ${album.name}`
    };
  }
};
