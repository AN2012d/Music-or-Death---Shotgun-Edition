
export interface Album {
  id: string;
  name: string;
  artist: string;
  year: string;
  imageUrl: string;
}

export interface Track {
  id: string;
  name: string;
  previewUrl?: string;
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export interface GameChallenge {
  correctTrack: Track;
  options: Track[];
  snippetDescription: string;
}

export enum GameState {
  SEARCHING = 'SEARCHING',
  ALBUM_SELECTION = 'ALBUM_SELECTION',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  SURVIVED = 'SURVIVED'
}
