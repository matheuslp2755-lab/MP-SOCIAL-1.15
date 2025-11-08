
import React, { useState, useRef, useEffect } from 'react';

const PlayIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path d="M4.018 14.382A1 1 0 013 13.5V6.5a1 1 0 011.528-.854l6.5 3.5a1 1 0 010 1.708l-6.5 3.5a1 1 0 01-.51.128z"></path></svg>;
const PauseIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path d="M5 14.5a1 1 0 01-1-1v-7a1 1 0 012 0v7a1 1 0 01-1 1zm10 0a1 1 0 01-1-1v-7a1 1 0 012 0v7a1 1 0 01-1 1z"></path></svg>;

interface MusicPlayerProps {
  trackName?: string;
  artistName?: string;
  previewUrl: string;
  isPulseVersion?: boolean;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ trackName, artistName, previewUrl, isPulseVersion = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (isPulseVersion && audio) {
        audio.play().catch(e => console.log("Autoplay was prevented.", e));
        setIsPlaying(true);

        const onEnded = () => setIsPlaying(false);
        audio.addEventListener('ended', onEnded);
        
        return () => {
            audio.pause();
            audio.removeEventListener('ended', onEnded);
        };
    }
  }, [isPulseVersion, previewUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => {
        audio.pause();
        audio.removeEventListener('ended', onEnded);
    }
  }, [previewUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const containerClasses = isPulseVersion
    ? "bg-black/50 text-white rounded-lg p-2 flex items-center gap-3 backdrop-blur-sm"
    : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 flex items-center gap-3 mb-2";

  return (
    <div className={containerClasses}>
      <audio ref={audioRef} src={previewUrl} preload="metadata"></audio>
      <button 
        onClick={togglePlay} 
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            isPulseVersion 
            ? 'bg-white/20 text-white hover:bg-white/40' 
            : 'bg-sky-500 text-white hover:bg-sky-600'
        }`}
        aria-label={isPlaying ? "Pause preview" : "Play preview"}
      >
        {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 pl-0.5" />}
      </button>
      <div className="flex-grow overflow-hidden text-sm">
        <p className="truncate">
          <span className="font-semibold">{`🎶 ${trackName}`}</span>
          <span className={`${isPulseVersion ? 'text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}>{` — ${artistName}`}</span>
        </p>
      </div>
    </div>
  );
};

export default MusicPlayer;
