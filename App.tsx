
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Album, Track, GameChallenge, Difficulty } from './types';
import { getAlbumChallenge } from './services/geminiService';
import { searchAlbums, getAlbumTracks } from './services/musicService';
import { Shotgun } from './components/Shotgun';
import { translations, Language } from './translations';

// Extending the Album type locally for fallback support
interface ExtendedAlbum extends Album {
  fallbackTracks?: Track[];
}

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('he');
  const [gameState, setGameState] = useState<GameState>(GameState.SEARCHING);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [albums, setAlbums] = useState<ExtendedAlbum[]>([]);
  const [selectedSource, setSelectedSource] = useState<ExtendedAlbum | null>(null);
  const [challenge, setChallenge] = useState<GameChallenge | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [completedAlbums, setCompletedAlbums] = useState<string[]>([]);
  const [isFiring, setIsFiring] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [messageKey, setMessageKey] = useState<keyof typeof translations['en']>('statusDefault');
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [lastCorrectTrack, setLastCorrectTrack] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [hasNoSamplesError, setHasNoSamplesError] = useState(false);

  const [currentAlbumTracks, setCurrentAlbumTracks] = useState<Track[]>([]);
  const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set());
  const [replaysRemaining, setReplaysRemaining] = useState(2);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shotgunSound = useRef<HTMLAudioElement | null>(null);
  const isVictoryRef = useRef(false);

  const t = (key: keyof typeof translations['en']) => translations[lang][key];

  // Persistence: Load stats on mount
  useEffect(() => {
    const savedHighScore = localStorage.getItem('sonic_roulette_highscore');
    const savedCompleted = localStorage.getItem('sonic_roulette_completed');
    const savedLang = localStorage.getItem('sonic_roulette_lang');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));
    if (savedCompleted) setCompletedAlbums(JSON.parse(savedCompleted));
    if (savedLang) setLang(savedLang as Language);

    // FIX: Using a high-quality, reliable Pixabay shotgun blast that works across browsers
    shotgunSound.current = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c330c69c6f.mp3');
    shotgunSound.current.load();
    shotgunSound.current.volume = 0.9;
  }, []);

  // Update High Score when score changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('sonic_roulette_highscore', score.toString());
    }
  }, [score, highScore]);

  useEffect(() => {
    isVictoryRef.current = isVictory;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [isVictory, lang]);

  const toggleLanguage = () => {
    const newLang = lang === 'he' ? 'en' : 'he';
    setLang(newLang);
    localStorage.setItem('sonic_roulette_lang', newLang);
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setIsQuotaError(false);
      setMessageKey('statusDefault');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchTerm.trim();
    if (!query || isLoading) return;
    
    setIsLoading(true);
    setHasNoSamplesError(false);
    setAlbums([]);
    setMessageKey('scanning');
    setCustomMessage(null);
    
    try {
      const results = await searchAlbums(query);
      if (results && results.length > 0) {
        setAlbums(results);
        setGameState(GameState.ALBUM_SELECTION);
        setMessageKey('albumSelectMsg');
      } else {
        setCustomMessage(lang === 'he' ? 'לא נמצאו אלבומים זמינים. נסה שם אחר.' : 'No albums found. Try another name.');
      }
    } catch (err) {
      console.error("Search failed in UI:", err);
      setMessageKey('communicationError');
    } finally {
      setIsLoading(false);
    }
  };

  const markAlbumComplete = (id: string) => {
    if (!completedAlbums.includes(id)) {
      const newCompleted = [...completedAlbums, id];
      setCompletedAlbums(newCompleted);
      localStorage.setItem('sonic_roulette_completed', JSON.stringify(newCompleted));
    }
  };

  const startChallenge = async (album: ExtendedAlbum, isNewAlbum: boolean = true) => {
    setIsLoading(true);
    setIsQuotaError(false);
    setHasNoSamplesError(false);
    setCustomMessage(null);
    let tracks = currentAlbumTracks;
    let localPlayedIds = playedTrackIds;

    if (isNewAlbum) {
      setSelectedSource(album);
      setMessageKey('loadingTracks');
      try {
        const fetchedTracks = await getAlbumTracks(album.id);
        
        // Final sanity check on preview URLs
        tracks = fetchedTracks.filter((t: any) => t.previewUrl);
        
        if (tracks.length === 0) {
          setMessageKey('noSamples');
          setHasNoSamplesError(true);
          setIsLoading(false);
          return;
        }

        setCurrentAlbumTracks(tracks);
        localPlayedIds = new Set<string>();
        setPlayedTrackIds(localPlayedIds);
        setReplaysRemaining(2);
      } catch (err) {
        console.error("Track loading failed:", err);
        setMessageKey('communicationError');
        setIsLoading(false);
        return;
      }
    }

    const remainingTracks = tracks.filter(t => !localPlayedIds.has(t.id.toString()));

    if (remainingTracks.length === 0) {
      setGameState(GameState.SURVIVED);
      if (selectedSource) markAlbumComplete(selectedSource.id);
      setIsLoading(false);
      return;
    }

    setCustomMessage(`${t('trackLabel')} ${localPlayedIds.size + 1} / ${tracks.length}`);

    try {
      const chal = await getAlbumChallenge(album, tracks, difficulty);
      let finalCorrect = chal.correctTrack;
      
      if (localPlayedIds.has(finalCorrect.id.toString()) || !finalCorrect.previewUrl) {
        const randomRemaining = remainingTracks[Math.floor(Math.random() * remainingTracks.length)];
        finalCorrect = randomRemaining;
        
        if (!chal.options.find(o => o.id === finalCorrect.id)) {
          chal.options = [finalCorrect, ...chal.options.slice(0, 3)].sort(() => Math.random() - 0.5);
        }
      }

      setChallenge({ ...chal, correctTrack: finalCorrect });
      setLastCorrectTrack(finalCorrect.name);
      setGameState(GameState.PLAYING);
      playSnippet(finalCorrect.previewUrl!);
    } catch (err: any) {
      console.error("Challenge generation failure:", err);
      if (err?.message?.includes('quota') || err?.status === 429) {
        setIsQuotaError(true);
        setMessageKey('quotaTitle');
      } else {
        setMessageKey('communicationError');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const playSnippet = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setIsAudioPlaying(true);

    audio.onerror = () => {
      console.warn("Audio failed to load. Attempting skip...");
      setIsAudioPlaying(false);
      if (gameState === GameState.PLAYING && selectedSource) {
        setCustomMessage(lang === 'he' ? "דגימת שמע פגומה, מדלג..." : "Audio sample failed, skipping...");
        if (challenge) {
            const newPlayed = new Set(playedTrackIds);
            newPlayed.add(challenge.correctTrack.id);
            setPlayedTrackIds(newPlayed);
        }
        startChallenge(selectedSource, false);
      }
    };

    audio.play().catch(err => {
      console.error("Playback blocked:", err);
      setIsAudioPlaying(false);
    });

    const duration = difficulty === Difficulty.EASY ? 5000 : difficulty === Difficulty.MEDIUM ? 2000 : 800;
    
    setTimeout(() => {
      if (audioRef.current === audio && !isVictoryRef.current) {
        audio.pause();
        setIsAudioPlaying(false);
        setMessageKey('snippetPrompt');
      }
    }, duration);
  };

  const handleReplay = () => {
    if (replaysRemaining > 0 && !isAudioPlaying && !isVictory && challenge) {
      setReplaysRemaining(prev => prev - 1);
      setMessageKey('listeningAgain');
      playSnippet(challenge.correctTrack.previewUrl!);
    }
  };

  const handleAnswer = (track: Track) => {
    if (isFiring || isVictory || !challenge) return;

    if (track.id === challenge.correctTrack.id) {
      setIsVictory(true);
      isVictoryRef.current = true;
      const points = difficulty === Difficulty.HARD ? 200 : difficulty === Difficulty.MEDIUM ? 100 : 50;
      setScore(prev => prev + points);
      setMessageKey('correctAnswer');
      setIsAudioPlaying(true);
      
      const newPlayed = new Set(playedTrackIds);
      newPlayed.add(track.id.toString());
      setPlayedTrackIds(newPlayed);

      if (audioRef.current) {
         audioRef.current.currentTime = 0;
         audioRef.current.play();
      }
    } else {
      setIsFiring(true);
      // Ensure shotgun sound is reset and played immediately on loss
      if (shotgunSound.current) {
          shotgunSound.current.currentTime = 0;
          shotgunSound.current.play().catch(e => {
            console.error("Shotgun sound failed:", e);
            // Fallback: Re-init if failed
            const snd = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c330c69c6f.mp3');
            snd.play();
          });
      }
      if (audioRef.current) audioRef.current.pause();
      setIsAudioPlaying(false);
      setMessageKey('wrongAnswer');
      setTimeout(() => setGameState(GameState.GAME_OVER), 1500);
    }
  };

  const nextRound = async () => {
    setIsVictory(false);
    isVictoryRef.current = false;
    setIsFiring(false);
    setIsAudioPlaying(false);
    if (selectedSource) startChallenge(selectedSource, false);
  };

  const resetGame = () => {
    setGameState(GameState.SEARCHING);
    setScore(0);
    setIsFiring(false);
    setIsVictory(false);
    isVictoryRef.current = false;
    setIsAudioPlaying(false);
    setIsQuotaError(false);
    setHasNoSamplesError(false);
    setPlayedTrackIds(new Set());
    setCurrentAlbumTracks([]);
    setReplaysRemaining(2);
    setSearchTerm('');
    setCustomMessage(null);
    setMessageKey('statusDefault');
  };

  const backToSelection = () => {
    setGameState(GameState.ALBUM_SELECTION);
    setHasNoSamplesError(false);
    setMessageKey('albumSelectMsg');
    setCustomMessage(null);
  };

  const backToSearchArtist = () => {
    setGameState(GameState.SEARCHING);
    setHasNoSamplesError(false);
    setMessageKey('statusDefault');
    setCustomMessage(null);
    setSearchTerm('');
  };

  return (
    <div className={`min-h-screen flex flex-col items-center p-4 md:p-8 space-y-8 max-w-6xl mx-auto bg-black relative overflow-hidden ${isFiring ? 'animate-shake' : ''}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black pointer-events-none"></div>

      <header className="text-center space-y-4 w-full z-10 relative">
        <div className="absolute top-0 flex gap-2">
            <button 
                onClick={handleOpenKeyDialog}
                className="bg-zinc-900/50 hover:bg-zinc-800 text-[10px] uppercase font-orbitron px-3 py-1 rounded border border-zinc-800 text-zinc-500 transition-all"
            >
                {t('apiKey')}
            </button>
            <button 
                onClick={toggleLanguage}
                className="bg-zinc-900/50 hover:bg-zinc-800 text-[10px] uppercase font-orbitron px-3 py-1 rounded border border-zinc-800 text-zinc-300 transition-all font-bold"
            >
                {lang === 'he' ? 'ENGLISH' : 'עברית'}
            </button>
        </div>
        
        <h1 className="text-4xl md:text-8xl font-orbitron font-bold text-red-600 tracking-tighter uppercase italic drop-shadow-[0_0_30px_rgba(220,38,38,0.5)] pt-8">
          {t('title')}
        </h1>
        <div className="flex flex-col md:flex-row justify-between items-center bg-zinc-900/80 p-5 rounded-2xl border border-red-900/30 backdrop-blur-xl shadow-2xl gap-4">
          <div className="flex gap-8 items-center text-center">
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block font-orbitron">{t('score')}</span>
              <span className="text-3xl md:text-4xl font-orbitron font-bold text-red-500">{score}</span>
            </div>
            <div className="border-r border-zinc-800 h-10" />
            <div>
              <span className="text-[10px] uppercase text-zinc-500 block font-orbitron">{t('best')}</span>
              <span className="text-3xl md:text-4xl font-orbitron font-bold text-zinc-200">{highScore}</span>
            </div>
          </div>
          <div className={`text-center ${lang === 'he' ? 'md:text-left' : 'md:text-right'}`}>
            <span className="text-[10px] uppercase text-zinc-500 block font-orbitron">{t('status')}</span>
            <span className={`text-sm md:text-base font-semibold transition-colors ${isQuotaError || hasNoSamplesError ? 'text-red-500' : 'text-zinc-200'}`}>
                {customMessage || t(messageKey)}
            </span>
            {isQuotaError && (
               <button 
                 onClick={handleOpenKeyDialog}
                 className="mt-2 mx-auto md:ml-0 block text-[10px] bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded font-bold uppercase"
               >
                 {lang === 'he' ? 'החלף מפתח API' : 'SWITCH API KEY'}
               </button>
            )}
            {hasNoSamplesError && (
               <div className="flex gap-2 mt-2 justify-center md:justify-start">
                  <button 
                    onClick={backToSelection}
                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded font-bold uppercase"
                  >
                    {t('pickAnotherAlbum')}
                  </button>
                  <button 
                    onClick={backToSearchArtist}
                    className="text-[10px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 px-3 py-1 rounded font-bold uppercase border border-zinc-700"
                  >
                    {t('newSearch')}
                  </button>
               </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center justify-center z-10">
        {gameState === GameState.SEARCHING && (
          <div className="w-full max-w-lg flex flex-col items-center space-y-12 mt-4 animate-in fade-in zoom-in">
            <div className="text-center space-y-4">
              <p className="text-xl md:text-2xl text-zinc-300 font-bold uppercase tracking-widest">{t('subtitle')}</p>
              <p className="text-zinc-500 italic">{t('description')}</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 block uppercase font-orbitron mb-1">{t('conquered')}</span>
                <span className="text-2xl font-black text-white">{completedAlbums.length}</span>
                <span className="text-xs text-zinc-600 block">{t('albums')}</span>
              </div>
              <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-500 block uppercase font-orbitron mb-1">{t('allTimeBest')}</span>
                <span className="text-2xl font-black text-red-600">{highScore}</span>
                <span className="text-xs text-zinc-600 block">{t('points')}</span>
              </div>
            </div>

            <div className="flex bg-zinc-900 p-1 rounded-full border border-zinc-800 w-full">
              {(Object.keys(Difficulty) as Array<keyof typeof Difficulty>).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(Difficulty[d])}
                  className={`flex-1 py-4 rounded-full font-bold text-xs md:text-sm transition-all ${difficulty === Difficulty[d] ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                >
                  {t('difficulties')[d as keyof typeof Difficulty]}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="w-full space-y-6">
              <input 
                type="text"
                placeholder={t('searchPlaceholder')}
                className="w-full bg-zinc-900 border-b-4 border-red-900/50 py-4 md:py-6 px-8 text-xl md:text-2xl focus:outline-none focus:border-red-600 transition-all text-center font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
              />
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 text-white font-black py-4 md:py-6 rounded-xl text-xl md:text-2xl hover:bg-red-500 transition-all shadow-xl active:scale-95 disabled:opacity-50 uppercase tracking-tighter"
              >
                {isLoading ? (lang === 'he' ? 'סורק...' : 'SCANNING...') : t('searchButton')}
              </button>
            </form>
          </div>
        )}

        {gameState === GameState.ALBUM_SELECTION && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 w-full animate-in fade-in slide-in-from-bottom-12 mt-4">
            {albums.map((album) => {
              const isCompleted = completedAlbums.includes(album.id);
              return (
                <button
                  key={album.id}
                  onClick={() => startChallenge(album, true)}
                  className={`group relative bg-[#0a0a0a] p-3 md:p-4 rounded-xl transition-all shadow-2xl hover:scale-[1.05] border ${isCompleted ? 'border-green-600/50' : 'border-zinc-900 hover:border-red-600/50'} hover:bg-zinc-900 text-right`}
                >
                  {isCompleted && (
                    <div className="absolute top-4 left-4 z-20 bg-green-600 text-white text-[8px] md:text-[10px] font-black px-2 py-1 rounded uppercase flex items-center gap-1 shadow-lg">
                      <svg className="w-2 h-2 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      {t('survived').toUpperCase()}
                    </div>
                  )}
                  <img src={album.imageUrl || 'https://via.placeholder.com/600'} className={`w-full aspect-square object-cover rounded shadow-2xl mb-4 transition-all duration-500 ${isCompleted ? 'grayscale-0 brightness-110' : 'grayscale group-hover:grayscale-0'}`} alt={album.name} />
                  <h3 className="font-bold text-base md:text-lg line-clamp-1 text-white">{album.name}</h3>
                  <p className="text-xs md:text-sm text-zinc-500">{album.artist} • {album.year}</p>
                </button>
              );
            })}
            <button 
              onClick={resetGame}
              className="bg-zinc-900/30 p-4 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:text-white border-4 border-dashed border-zinc-800 hover:border-red-600 transition-all"
            >
              <span className="text-2xl md:text-4xl mb-2">⬅️</span>
              <span className="font-bold uppercase tracking-widest text-xs md:text-sm">{t('backToSearch')}</span>
            </button>
          </div>
        )}

        {(gameState === GameState.PLAYING || isQuotaError || hasNoSamplesError) && challenge && (
          <div className="w-full flex flex-col items-center space-y-8 md:space-y-12 animate-in fade-in">
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-4 text-zinc-500 font-bold uppercase tracking-widest text-xs md:text-sm">
                  <span>{t('trackLabel')} {playedTrackIds.size + 1} / {currentAlbumTracks.length}</span>
                  <div className="w-32 md:w-48 h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div 
                          className="h-full bg-red-600 transition-all duration-500" 
                          style={{ width: `${(playedTrackIds.size / currentAlbumTracks.length) * 100}%` }}
                      />
                  </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`text-[10px] md:text-xs font-black px-4 py-2 rounded-full border-2 transition-all ${replaysRemaining > 0 ? 'border-red-600 text-red-500' : 'border-zinc-800 text-zinc-700'}`}>
                  {t('replaysLeft')}: {replaysRemaining}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
               <div className={`relative ${isVictory ? 'animate-victory-pulse' : ''}`}>
                  <img 
                   src={selectedSource?.imageUrl} 
                   className={`w-48 h-48 md:w-80 md:h-80 rounded-2xl shadow-[0_0_100px_rgba(220,38,38,0.3)] border-4 transition-all duration-300 ${isVictory ? 'border-green-500' : 'border-red-600/30'}`}
                   alt="Album Cover"
                  />
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-2xl backdrop-blur-md">
                      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  {isAudioPlaying && !isVictory && (
                    <div className="absolute -top-4 -right-4 bg-red-600 text-white p-3 md:p-4 rounded-full animate-ping">
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                  )}
                  {isVictory && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                        <div className="bg-green-600 text-white px-6 py-2 rounded-full font-black text-2xl uppercase tracking-tighter shadow-2xl animate-success-pop flex items-center gap-2">
                           <span>NICE!</span>
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                        </div>
                    </div>
                  )}
               </div>

               <div className="flex flex-col items-center gap-6 md:gap-8">
                  <Shotgun isFiring={isFiring} isCorrect={isVictory} />
                  
                  {!isVictory && !isFiring && !isQuotaError && !hasNoSamplesError && (
                    <button
                      onClick={handleReplay}
                      disabled={replaysRemaining === 0 || isAudioPlaying}
                      className={`flex items-center gap-3 px-6 py-3 md:px-8 md:py-4 rounded-full font-black text-lg md:text-xl transition-all shadow-xl
                        ${replaysRemaining > 0 && !isAudioPlaying
                          ? 'bg-zinc-900 text-white border-2 border-red-600 hover:bg-red-600 hover:scale-105 active:scale-95' 
                          : 'bg-zinc-950 text-zinc-700 border-2 border-zinc-900 cursor-not-allowed opacity-50'}`}
                    >
                      <span className="text-xl md:text-2xl">👂</span>
                      {t('listenAgain')} ({replaysRemaining})
                    </button>
                  )}
               </div>
            </div>

            {(isQuotaError || hasNoSamplesError) ? (
               <div className="flex flex-col items-center space-y-6 animate-in zoom-in bg-zinc-900/80 p-8 md:p-12 rounded-3xl border border-red-600/50 shadow-2xl max-w-xl text-center">
                  <h2 className="text-2xl md:text-3xl font-black text-red-500 uppercase font-orbitron">{t(isQuotaError ? 'quotaTitle' : 'noSamples')}</h2>
                  <p className="text-sm md:text-base text-zinc-400">{isQuotaError ? t('quotaDesc') : t('noSamplesAdvice')}</p>
                  <div className="flex flex-col md:flex-row gap-4 w-full">
                      {isQuotaError ? (
                        <button
                          onClick={handleOpenKeyDialog}
                          className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black px-10 py-4 rounded-full text-lg md:text-xl transition-all shadow-xl active:scale-95"
                        >
                          {t('enterApiKey')}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={backToSelection}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black px-8 py-4 rounded-full text-base md:text-lg transition-all shadow-xl active:scale-95 uppercase"
                          >
                            {t('pickAnotherAlbum')}
                          </button>
                          <button
                            onClick={backToSearchArtist}
                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-black px-8 py-4 rounded-full text-base md:text-lg transition-all shadow-xl active:scale-95 uppercase border border-zinc-600"
                          >
                            {t('newSearch')}
                          </button>
                        </>
                      )}
                  </div>
               </div>
            ) : isVictory ? (
              <div className="flex flex-col items-center space-y-8 md:space-y-10 animate-in zoom-in px-4">
                <div className="bg-green-600 text-white px-8 py-4 md:px-16 md:py-6 rounded-full font-black text-xl md:text-3xl shadow-[0_0_50px_rgba(34,197,94,0.6)] text-center">
                   {challenge.correctTrack.name}
                </div>
                <button
                  onClick={nextRound}
                  className="bg-white text-black font-black px-16 py-6 md:px-24 md:py-8 rounded-full text-2xl md:text-4xl hover:bg-green-600 hover:text-white transition-all transform hover:scale-110 shadow-2xl active:scale-95 border-b-8 border-zinc-400 active:border-b-0 uppercase"
                >
                  {t('nextRound')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-5xl px-4">
                {challenge.options.map((track) => (
                  <button
                    key={track.id}
                    disabled={isFiring || isLoading}
                    onClick={() => handleAnswer(track)}
                    className={`p-6 md:p-10 rounded-2xl md:rounded-[2rem] text-lg md:text-2xl font-black border-4 transition-all duration-300 shadow-2xl uppercase tracking-tighter
                      ${isFiring 
                        ? (track.id === challenge.correctTrack.id ? 'border-red-600 bg-red-600/30 text-red-500' : 'border-zinc-800 opacity-20')
                        : 'bg-zinc-950 border-zinc-800 hover:border-red-600 hover:scale-[1.02] md:hover:scale-[1.05] active:scale-95 hover:bg-zinc-900'
                      }`}
                  >
                    {track.name}
                  </button>
                ))}
              </div>
            )}
            
            {!isQuotaError && !hasNoSamplesError && !isVictory && !isFiring && (
              <p className="text-zinc-500 italic text-center max-w-lg px-4 text-lg md:text-xl font-medium tracking-wide">"{challenge.snippetDescription}"</p>
            )}
          </div>
        )}

        {gameState === GameState.SURVIVED && (
          <div className="flex flex-col items-center text-center space-y-12 md:space-y-16 mt-4 animate-in zoom-in max-w-2xl w-full">
            <div className="relative">
               <div className="absolute inset-0 bg-green-500/20 blur-[120px] rounded-full"></div>
               <img 
                 src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3JiaWc4Yjh5YnR1cmRtd3RhZ2JtYmU5amZ1ZGNqYjF5eHV3c2o4ZCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif" 
                 alt="Celebration" 
                 className="w-full max-w-xs md:max-w-md rounded-[2rem] md:rounded-[3rem] shadow-[0_0_120px_rgba(34,197,94,0.4)] border-8 border-green-600 animate-bounce"
               />
               <div className="absolute -top-8 -left-8 md:-top-12 md:-left-12 bg-green-600 text-white px-6 py-4 md:px-10 md:py-8 rounded-full font-black text-2xl md:text-4xl rotate-[-12deg] shadow-2xl border-4 border-white uppercase">{t('survived')}</div>
            </div>
            
            <div className="bg-zinc-900/90 p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border-4 border-green-600/50 backdrop-blur-3xl w-full shadow-2xl">
                <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter">{t('congratsAlive')}</h2>
                <p className="text-lg md:text-2xl text-zinc-400 mb-10 leading-relaxed">{t('survivedAlbum')} <span className="text-white font-bold">{selectedSource?.name}</span>. {t('deathWait')}</p>
                <div className="p-6 md:p-8 bg-green-600/10 rounded-[1.5rem] md:rounded-[2rem] border-2 border-green-600/30">
                  <p className="text-green-500 font-bold text-base md:text-xl uppercase tracking-widest">{t('finalScore')}</p>
                  <p className="text-white text-4xl md:text-6xl font-black font-orbitron">{score}</p>
                </div>
            </div>
            
            <button 
              onClick={resetGame}
              className="bg-white text-black font-black px-16 py-6 md:px-28 md:py-10 rounded-full hover:bg-green-600 hover:text-white transition-all text-2xl md:text-4xl shadow-[0_15px_0_#ccc] md:shadow-[0_25px_0_#ccc] transform active:translate-y-[10px] active:shadow-none uppercase italic"
            >
              {t('playAgain')}
            </button>
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="flex flex-col items-center text-center space-y-12 md:space-y-16 mt-4 animate-in zoom-in max-w-2xl w-full">
            <div className="relative group">
               <img 
                 src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZueXU5ZndwNmxtamdyYndpYm04em50azI0NXh6bW1kZ213YzhpayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/h5NLPVn3rg0iI/giphy.gif" 
                 alt="Comical Game Over" 
                 className="w-full max-w-xs md:max-w-md rounded-[2rem] md:rounded-[3rem] shadow-[0_0_120px_rgba(220,38,38,0.7)] border-8 border-red-600"
               />
               <div className="absolute -top-8 -right-8 md:-top-12 md:-right-12 bg-red-600 text-white px-6 py-4 md:px-10 md:py-8 rounded-full font-black text-3xl md:text-5xl rotate-12 shadow-2xl border-4 border-white uppercase">{t('wasted')}</div>
            </div>
            
            <div className="bg-zinc-900/90 p-8 md:p-12 rounded-[2rem] md:rounded-[4rem] border-4 border-red-600/50 backdrop-blur-3xl w-full shadow-2xl">
                <p className="text-4xl md:text-6xl text-zinc-300 mb-8 md:text-10 font-orbitron">{t('score')}: <span className="text-red-600 font-black">{score}</span></p>
                <div className="p-8 md:p-12 bg-red-600/10 rounded-[1.5rem] md:rounded-[2.5rem] border-2 border-red-600/30">
                  <p className="text-red-500 font-bold text-lg md:text-2xl mb-6 uppercase tracking-[0.2em] md:tracking-[0.5em]">{t('lastChanceWas')}</p>
                  <p className="text-white text-3xl md:text-5xl font-black font-orbitron text-center">{lastCorrectTrack}</p>
                </div>
            </div>
            
            <button 
              onClick={resetGame}
              className="bg-white text-black font-black px-16 py-6 md:px-28 md:py-10 rounded-full hover:bg-red-600 hover:text-white transition-all text-2xl md:text-5xl shadow-[0_15px_0_#ccc] md:shadow-[0_25px_0_#ccc] transform active:translate-y-[10px] active:shadow-none uppercase italic"
            >
              {t('tryAgain')}
            </button>
          </div>
        )}
      </main>

      <footer className="w-full text-center text-zinc-800 text-[10px] md:text-sm py-8 md:py-16 border-t border-zinc-900/50 mt-10 md:mt-20 z-10">
        <p dir="ltr" className="font-orbitron tracking-[0.2em] md:tracking-[0.4em] uppercase opacity-40">© Adar Nathan 2026 | Global Music Engine | Gemini GameMaster</p>
      </footer>
    </div>
  );
};

export default App;
