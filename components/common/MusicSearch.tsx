import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { searchSpotifyTracks, SpotifyTrack, redirectToAuth } from './spotifyApi';

interface MusicSearchProps {
    onSelectMusic: (track: SpotifyTrack) => void;
    onClose: () => void;
}

const MusicSearch: React.FC<MusicSearchProps> = ({ onSelectMusic, onClose }) => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpotifyTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authRequired, setAuthRequired] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    useEffect(() => {
        if (query.trim() === '') {
            setResults([]);
            setError(null);
            setAuthRequired(false);
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            setAuthRequired(false);
            try {
                const tracks = await searchSpotifyTracks(query);
                setResults(tracks);
            } catch (err) {
                if ((err as Error).message === 'SPOTIFY_AUTH_REQUIRED') {
                    setAuthRequired(true);
                } else {
                    setError(t('musicSearch.apiError'));
                }
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [query, t]);

    return (
        <div ref={searchRef} className="mt-4 relative z-10">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('musicSearch.placeholder')}
                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md py-1.5 px-4 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                autoFocus
            />
            <div className="mt-2 max-h-48 overflow-y-auto">
                {authRequired && (
                    <div className="text-center py-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                            {t('musicSearch.connectSpotifyMessage')}
                        </p>
                        <button 
                            onClick={redirectToAuth}
                            className="bg-green-500 text-white font-semibold rounded-lg py-1.5 px-4 text-sm hover:bg-green-600 transition-colors"
                        >
                            {t('musicSearch.connectSpotifyButton')}
                        </button>
                    </div>
                )}
                {!authRequired && loading && <p className="text-center text-xs text-zinc-500 py-2">{t('musicSearch.searching')}</p>}
                {!authRequired && error && <p className="text-center text-xs text-red-500 py-2">{error}</p>}
                {!authRequired && !loading && !error && query && results.length === 0 && <p className="text-center text-xs text-zinc-500 py-2">{t('musicSearch.noResults')}</p>}
                {!authRequired && !loading && !error && results.map(track => (
                    <div
                        key={track.id}
                        onClick={() => onSelectMusic(track)}
                        className="p-2 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
                    >
                        <div className="flex-grow overflow-hidden">
                            <p className="font-semibold text-sm truncate">{track.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MusicSearch;