import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Button from '../common/Button';

export interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    url: string;
    albumArtUrl: string;
}

interface MusicSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: MusicTrack) => void;
}

const SPOTIFY_CLIENT_ID = 'ca3aed6612574a49b0516e7e5ecce076';
const SPOTIFY_REDIRECT_URI = 'https://mp-social-1-15-lljpgvjru-matheuslp2755-labs-projects.vercel.app/';

interface SpotifyAuthData {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

interface SpotifyUserProfile {
    display_name: string;
    images: { url: string }[];
}


const PlayIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PauseIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SpotifyIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 496 512" fill="currentColor">
        <path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.3 363.3c-1.3 2.5-4.1 3.5-6.6 2.2-70.1-42.3-158.4-52.2-263.2-28.7-2.8.6-5.4-1.1-6-3.9-1-3.1.9-5.9 4.1-6.8 111.4-24.8 206.6-14.2 282.6 31.2 2.8 1.1 3.9 4.3 2.5 6.9zM122 316.5c-.9 2.3-3.4 3.4-5.7 2.5-59.2-23.7-129.5-27-213.9-14.3-2.3.3-4.5-1.1-4.9-3.4-.3-2.3 1.1-4.5 3.4-4.9 88.8-13.4 163.4-9.5 227.4 15.3 2.3.9 3.4 3.4 2.7 5.8zm.3-64.2c-1.1 2.8-4.3 4.1-7.1 3-64-25.5-163.4-30.3-239.6-16.5-3.1.6-6.1-1.3-6.8-4.4-.8-3.1 1.3-6.1 4.4-6.8 81.3-14.7 185.3-9.5 255.4 17.5 3.1 1.1 4.1 4.8 3 7.2z"/>
    </svg>
);


const MusicSelectorModal: React.FC<MusicSelectorModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { t } = useLanguage();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const [spotifyAuth, setSpotifyAuth] = useState<SpotifyAuthData | null>(null);
    const [spotifyUser, setSpotifyUser] = useState<SpotifyUserProfile | null>(null);
    const [authStatus, setAuthStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');

    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');

    const handleDisconnect = () => {
        localStorage.removeItem('spotify_auth_data');
        setSpotifyAuth(null);
        setSpotifyUser(null);
        setAuthStatus('disconnected');
        setSearchResults([]);
        setSearchQuery('');
    };
    
    useEffect(() => {
        if (!isOpen) {
            audioRef.current?.pause();
            setIsPlaying(false);
            return;
        }
        
        setAuthStatus('loading');
        const authDataString = localStorage.getItem('spotify_auth_data');

        if (!authDataString) {
            setAuthStatus('disconnected');
            return;
        }

        try {
            const authData: SpotifyAuthData = JSON.parse(authDataString);
            if (Date.now() > authData.expiresAt) {
                // Token expired, needs re-authentication. For simplicity, we disconnect.
                // A full implementation would use the refresh token to get a new access token.
                handleDisconnect();
            } else {
                setSpotifyAuth(authData);
                setAuthStatus('connected');
            }
        } catch (e) {
            console.error("Failed to parse spotify auth data", e);
            handleDisconnect();
        }

    }, [isOpen]);
    
    useEffect(() => {
        if (authStatus === 'connected' && spotifyAuth && !spotifyUser) {
            const fetchUserProfile = async () => {
                try {
                    const response = await fetch('https://api.spotify.com/v1/me', {
                        headers: { 'Authorization': `Bearer ${spotifyAuth.accessToken}` }
                    });
                    if (response.status === 401) { // Token might have been revoked
                        throw new Error('Unauthorized');
                    }
                    if (!response.ok) {
                        throw new Error('Failed to fetch user profile');
                    }
                    const data = await response.json();
                    setSpotifyUser(data);
                } catch (error) {
                    console.error("Spotify Profile Error:", error);
                    handleDisconnect();
                }
            };
            fetchUserProfile();
        }
    }, [authStatus, spotifyAuth, spotifyUser]);


    useEffect(() => {
        if (searchQuery.trim() === '' || authStatus !== 'connected' || !spotifyAuth) {
            setSearchResults([]);
            return;
        }

        const searchSpotify = async () => {
            setIsSearching(true);
            setSearchError('');
            try {
                const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=20`, {
                    headers: { 'Authorization': `Bearer ${spotifyAuth.accessToken}` }
                });

                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                if (!response.ok) throw new Error('Failed to search tracks');

                const data = await response.json();
                const tracks = data.tracks.items
                    .filter((item: any) => item.preview_url && item.album.images.length > 0)
                    .map((item: any): MusicTrack => ({
                        id: item.id,
                        title: item.name,
                        artist: item.artists.map((artist: any) => artist.name).join(', '),
                        url: item.preview_url,
                        albumArtUrl: item.album.images[0].url,
                    }));
                setSearchResults(tracks);
            } catch (error: any) {
                console.error("Spotify Search Error:", error);
                if (error.message === 'Unauthorized') {
                    handleDisconnect(); // Token is invalid, log out
                } else {
                    setSearchError(t('musicSelector.searchError'));
                }
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(searchSpotify, 300);
        return () => clearTimeout(debounceTimer);

    }, [searchQuery, spotifyAuth, authStatus, t]);

    useEffect(() => {
        const audio = audioRef.current;
        const handleEnded = () => setIsPlaying(false);
        audio?.addEventListener('ended', handleEnded);
        return () => audio?.removeEventListener('ended', handleEnded);
    }, []);

    const handleConnect = () => {
        const generateRandomString = (length: number) => {
            let text = '';
            const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            for (let i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };
    
        const state = generateRandomString(16);
        localStorage.setItem('spotify_auth_state', state);
        const scope = 'user-read-private user-read-email';
    
        const authUrl = 'https://accounts.spotify.com/authorize?' +
            new URLSearchParams({
                response_type: 'code',
                client_id: SPOTIFY_CLIENT_ID,
                scope: scope,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                state: state
            }).toString();
        
        window.location.href = authUrl;
    };
    

    const handlePreview = (track: MusicTrack) => {
        if (audioRef.current) {
            if (isPlaying && selectedTrack?.id === track.id) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.src = track.url;
                audioRef.current.play();
                setSelectedTrack(track);
                setIsPlaying(true);
            }
        }
    };
    
    if (!isOpen) return null;
    
    const renderContent = () => {
        switch(authStatus) {
            case 'loading':
                return <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div></div>;
            
            case 'disconnected':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <SpotifyIcon className="w-16 h-16 text-[#1DB954] mb-4" />
                        <h3 className="text-xl font-semibold mb-2">{t('musicSelector.connectTitle')}</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-6">{t('musicSelector.connectInfo')}</p>
                        <Button onClick={handleConnect} className="!bg-[#1DB954] hover:!bg-[#1ED760] !w-auto !px-6 flex items-center gap-2">
                            <SpotifyIcon className="w-5 h-5" />
                            {t('musicSelector.connectButton')}
                        </Button>
                    </div>
                );

            case 'connected':
                return (
                    <>
                        <div className="p-4 flex-shrink-0">
                            <input
                                type="text"
                                placeholder={t('musicSelector.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md py-1.5 px-4 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                            />
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            {isSearching ? (
                                <p className="text-center text-zinc-500 p-8">{t('musicSelector.searching')}</p>
                            ) : searchError ? (
                                <p className="text-center text-red-500 p-8">{searchError}</p>
                            ) : searchResults.length > 0 ? (
                                searchResults.map(track => (
                                    <div key={track.id} className="flex items-center p-3 gap-3 hover:bg-zinc-100 dark:hover:bg-zinc-900">
                                        <div className="relative">
                                            <img src={track.albumArtUrl} alt={track.title} className="w-12 h-12 rounded-md object-cover" />
                                            <button 
                                                onClick={() => handlePreview(track)} 
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-md"
                                            >
                                                {isPlaying && selectedTrack?.id === track.id ? (
                                                    <PauseIcon className="w-8 h-8 text-white" />
                                                ) : (
                                                    <PlayIcon className="w-8 h-8 text-white" />
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <p className="font-semibold text-sm truncate">{track.title}</p>
                                            <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                                        </div>
                                        <Button onClick={() => onSelect(track)} className="!w-auto !py-1 !px-4 !text-sm flex-shrink-0">
                                            {t('musicSelector.add')}
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                searchQuery.trim() !== '' && <p className="text-center text-zinc-500 p-8">{t('musicSelector.noResults')}</p>
                            )}
                        </div>
                        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                            {spotifyUser ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm overflow-hidden">
                                        <img src={spotifyUser.images?.[0]?.url || 'https://i.pravatar.cc/150'} alt="Spotify user" className="w-6 h-6 rounded-full object-cover" />
                                        <span className="truncate text-zinc-600 dark:text-zinc-400">{t('musicSelector.connectedAs', { username: spotifyUser.display_name })}</span>
                                    </div>
                                    <button onClick={handleDisconnect} className="text-xs font-semibold text-sky-500 hover:text-sky-600">{t('musicSelector.disconnectButton')}</button>
                                </div>
                            ) : (
                                <div className="text-sm text-zinc-500 text-center">{t('musicSelector.loadingProfile')}</div>
                            )}
                        </div>
                    </>
                );
        }
    }

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]"
            onClick={onClose}
        >
            <audio ref={audioRef} />
            <div 
                className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 flex flex-col h-[70vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-semibold">{t('musicSelector.title')}</h2>
                    <button onClick={onClose} className="text-2xl font-light">&times;</button>
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default MusicSelectorModal;
