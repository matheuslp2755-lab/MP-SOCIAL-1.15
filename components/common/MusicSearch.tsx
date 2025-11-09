import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { searchSpotifyTracks, SpotifyTrack, redirectToAuth } from './spotifyApi';

interface MusicSearchModalProps {
    isOpen: boolean;
    onSelectMusic: (track: SpotifyTrack) => void;
    onClose: () => void;
    onConnect?: () => void;
}

const MusicSearchModal: React.FC<MusicSearchModalProps> = ({ isOpen, onSelectMusic, onClose, onConnect }) => {
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SpotifyTrack[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [authRequired, setAuthRequired] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Reset state when opening
            setQuery('');
            setResults([]);
            setError(null);
            setAuthRequired(false);
        }

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || query.trim() === '') {
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
    }, [query, t, isOpen]);
    
    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[70vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                    <h2 className="text-lg font-semibold">{t('createPost.addMusic')}</h2>
                    <button onClick={onClose} className="text-2xl font-light">&times;</button>
                </div>
                <div className="p-4">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('musicSearch.placeholder')}
                        className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md py-1.5 px-4 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                        autoFocus
                    />
                </div>
                <div className="flex-grow overflow-y-auto px-4 pb-4">
                    {authRequired && (
                        <div className="text-center py-4">
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{t('musicSearch.connectSpotifyMessage')}</p>
                            <button onClick={onConnect || redirectToAuth} className="bg-green-500 text-white font-semibold rounded-lg py-1.5 px-4 text-sm hover:bg-green-600 transition-colors">{t('musicSearch.connectSpotifyButton')}</button>
                        </div>
                    )}
                    {!authRequired && loading && <p className="text-center text-xs text-zinc-500 py-2">{t('musicSearch.searching')}</p>}
                    {!authRequired && error && <p className="text-center text-xs text-red-500 py-2">{error}</p>}
                    {!authRequired && !loading && !error && query && results.length === 0 && <p className="text-center text-xs text-zinc-500 py-2">{t('musicSearch.noResults')}</p>}
                    {!authRequired && !loading && !error && results.map(track => {
                        const smallestImage = track.album.images[track.album.images.length - 1];
                        return (
                            <div
                                key={track.id}
                                onClick={() => onSelectMusic(track)}
                                className="p-2 flex items-center gap-3 rounded-md transition-colors cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            >
                                {smallestImage?.url ? (
                                    <img src={smallestImage.url} alt={track.name} className="w-12 h-12 rounded-sm object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-sm bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>
                                    </div>
                                )}
                                <div className="flex-grow overflow-hidden">
                                    <p className="font-semibold text-sm truncate">{track.name}</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{track.artists.map(a => a.name).join(', ')}</p>
                                </div>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">{formatDuration(track.duration_ms)}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MusicSearchModal;