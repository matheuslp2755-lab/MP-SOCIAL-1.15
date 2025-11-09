import React, { useState, useRef, useEffect } from 'react';
import {
    auth,
    db,
    storage,
    addDoc,
    collection,
    serverTimestamp,
    storageRef,
    uploadBytes,
    getDownloadURL
} from '../../firebase';
import Button from '../common/Button';
import TextAreaInput from '../common/TextAreaInput';
import { useLanguage } from '../../context/LanguageContext';
import MusicSearch from '../common/MusicSearch';
import { SpotifyTrack, getAccessToken, redirectToAuth } from '../common/spotifyApi';
import FollowerSelectionModal from '../common/FollowerSelectionModal';

interface CreatePulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPulseCreated: () => void;
}

const MusicIcon = () => <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"></path></svg>;

const MediaIcon: React.FC = () => (
    <svg aria-label="Icon to represent media" className="w-24 h-24 text-zinc-800 dark:text-zinc-200" fill="currentColor" role="img" viewBox="0 0 97.6 77.3"><path d="M16.3 24h.3c2.8-.2 4.9-2.6 4.8-5.4A4.9 4.9 0 0 0 16 13.6c-2.8.2-4.9 2.6-4.8 5.4.1 2.7 2.4 4.8 5.1 5zM42.4 28.9c-2.8.2-5.4-2-5.6-4.8-.2-2.8 2-5.4 4.8-5.6 2.8-.2 5.4 2 5.6 4.8.2 2.8-2 5.4-4.8 5.6z" fill="currentColor"></path><path d="M84.7 18.4 58 16.9l-.2-3.2c-.3-5.7-5.2-10.1-11-9.8L12.9 6c-5.7.3-10.1 5.2-9.8 11L5 51.1v.8c.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4l-14.4 1.1c-1.2.1-2.2-1-2.1-2.2l-.2-3.2 14.5-1.2c5.7-.3 10.1-5.2 9.8-11L51 15.1l18.7 1.4c1.2.1 2.2 1 2.1 2.2l.2 3.2-18.7-1.4c-5.7.3-10.1 5.2-9.8 11l-1.9 24.7c.1 1.2 1 2.2 2.2 2.1l14.4-1.1v9.4l-24.7 1.9c-5.7-.3-10.1-5.2-9.8-11L18.4 25.6v-.8c-.3-5.7 5.2-10.1 11-9.8l24.7 1.9v9.4l14.4-1.1c1.2-.1 2.2 1 2.1 2.2l.2 3.2-14.5 1.2c-5.7.3-10.1 5.2-9.8 11L49 60.3l-18.7-1.4c-1.2-.1-2.2-1-2.1-2.2l-.2-3.2 18.7 1.4c5.7-.3 10.1-5.2 9.8-11l1.9-24.7c-.1-1.2-1-2.2-2.2-2.1L31.2 20.1v-9.4l24.7-1.9c5.7.3 10.1 5.2 9.8 11l-2.1 28.9.2.6c.3 5.7-5.2 10.1-11 9.8L31.2 68.1v.8c.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4l-14.4 1.1c-1.2.1-2.2-1-2.1-2.2l-.2-3.2 14.5-1.2c5.7-.3 10.1-5.2 9.8-11L72.2 19l14.5-1.2c1.2-.1 2.2 1 2.1 2.2l-.2 3.2-14.5 1.2c-5.7.3-10.1 5.2-9.8 11l-1.9 24.7c.1 1.2 1 2.2 2.2 2.1l14.4-1.1v9.4l-24.7 1.9c-5.7-.3-10.1-5.2-9.8-11l2.1-28.9-.2-.6c-.3-5.7 5.2-10.1 11-9.8l21.5 1.7 2.1-28.9c-.3-5.7-5.2-10.1-11-9.8L21.5 4.9v.8c-.3 5.7 5.2 10.1 11 9.8l24.7-1.9v-9.4L31.2 6C25.5 5.7 21.1.8 21.4-5l2.1-28.9c.3-5.7 5.2-10.1 11-9.8l42.2-3.2c5.7-.3 10.1 5.2 9.8 11z" fill="currentColor"></path></svg>
);


const CreatePulseModal: React.FC<CreatePulseModalProps> = ({ isOpen, onClose, onPulseCreated }) => {
    const { t } = useLanguage();
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [caption, setCaption] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [selectedMusic, setSelectedMusic] = useState<SpotifyTrack | null>(null);
    const [showMusicSearch, setShowMusicSearch] = useState(false);
    const [isSpotifyConnected, setIsSpotifyConnected] = useState<boolean | null>(null);
    const [isVenting, setIsVenting] = useState(false);
    const [allowedViewers, setAllowedViewers] = useState<string[]>([]);
    const [isFollowerModalOpen, setIsFollowerModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
             // Restore draft if it exists
            const draftString = localStorage.getItem('spotify_auth_draft');
            if (draftString) {
                const draft = JSON.parse(draftString);
                if (draft.type === 'pulse') {
                    setCaption(draft.caption || '');
                    setIsVenting(draft.isVenting || false);
                    setAllowedViewers(draft.allowedViewers || []);
                    setSelectedMusic(draft.selectedMusic || null);
                    if (draft.mediaDataUrl) {
                        fetch(draft.mediaDataUrl)
                            .then(res => res.blob())
                            .then(blob => {
                                const file = new File([blob], draft.mediaName, { type: draft.mediaType });
                                if (file.type.startsWith('image/')) {
                                    setMediaType('image');
                                } else if (file.type.startsWith('video/')) {
                                    setMediaType('video');
                                }
                                setMediaFile(file);
                                setMediaPreview(URL.createObjectURL(file));
                            });
                    }
                    localStorage.removeItem('spotify_auth_draft');
                }
            }

            const checkSpotifyAuth = async () => {
                const token = await getAccessToken();
                setIsSpotifyConnected(!!token);
            };
            checkSpotifyAuth();
        } else {
            setMediaFile(null);
            setMediaPreview(null);
            setMediaType(null);
            setCaption('');
            setError('');
            setSelectedMusic(null);
            setShowMusicSearch(false);
            setIsSpotifyConnected(null);
            setIsVenting(false);
            setAllowedViewers([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.type.startsWith('image/')) {
                setMediaType('image');
            } else if (file.type.startsWith('video/')) {
                setMediaType('video');
            } else {
                setError(t('createPulse.invalidFileError'));
                return;
            }
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
            setError('');
        }
    };
    
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleSelectMusic = (track: SpotifyTrack) => {
        setSelectedMusic(track);
        setShowMusicSearch(false);
    };

    const handleConnectSpotify = () => {
        const saveDraft = (mediaDataUrl?: string) => {
            const draft = {
                type: 'pulse',
                mediaDataUrl: mediaDataUrl,
                mediaType: mediaFile?.type,
                mediaName: mediaFile?.name,
                caption: caption,
                isVenting: isVenting,
                allowedViewers: allowedViewers,
                selectedMusic: selectedMusic,
            };
            localStorage.setItem('spotify_auth_draft', JSON.stringify(draft));
            redirectToAuth();
        };
    
        if (mediaFile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                saveDraft(reader.result as string);
            };
            reader.readAsDataURL(mediaFile);
        } else {
            saveDraft();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const currentUser = auth.currentUser;
        if (!mediaFile || !currentUser) return;

        setSubmitting(true);
        setError('');
        try {
            const mediaUploadRef = storageRef(storage, `pulses/${currentUser.uid}/${Date.now()}-${mediaFile.name}`);
            await uploadBytes(mediaUploadRef, mediaFile);
            const downloadURL = await getDownloadURL(mediaUploadRef);

            const pulseData: any = {
                authorId: currentUser.uid,
                mediaUrl: downloadURL,
                legenda: caption,
                createdAt: serverTimestamp(),
                isVenting: isVenting,
            };

            if (selectedMusic) {
                pulseData.musica = {
                    nome: selectedMusic.name,
                    artista: selectedMusic.artists[0]?.name || 'Artista Desconhecido',
                    preview: selectedMusic.preview_url || '',
                    spotifyTrackId: selectedMusic.id,
                };
            }

             if (isVenting) {
                const viewers = [...new Set([...allowedViewers, currentUser.uid])];
                pulseData.allowedViewers = viewers;
            }

            await addDoc(collection(db, 'pulses'), pulseData);

            onPulseCreated();

        } catch (err) {
            console.error("Error creating pulse:", err);
            setError(t('createPulse.publishError'));
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <>
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
                onClick={onClose}
            >
                <div 
                    className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                        <h2 className="text-lg font-semibold">{t('createPulse.title')}</h2>
                        {mediaPreview && (
                            <Button onClick={handleSubmit} disabled={submitting} className="!w-auto !py-0 !px-3 !text-sm">
                                {submitting ? t('createPulse.publishing') : t('createPulse.publish')}
                            </Button>
                        )}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                        {mediaPreview ? (
                            <div className="flex flex-col md:flex-row">
                                <div className="w-full md:w-1/2 aspect-[9/16] bg-black flex items-center justify-center">
                                    {mediaType === 'image' && <img src={mediaPreview} alt="Pulse preview" className="max-h-full max-w-full object-contain" />}
                                    {mediaType === 'video' && <video src={mediaPreview} controls className="max-h-full max-w-full object-contain" />}
                                </div>
                                <div className="w-full md:w-1/2 p-4">
                                    <div className="flex items-center mb-4">
                                        <img src={auth.currentUser?.photoURL || ''} alt={auth.currentUser?.displayName || 'User'} className="w-8 h-8 rounded-full object-cover"/>
                                        <p className="font-semibold text-sm ml-3">{auth.currentUser?.displayName}</p>
                                    </div>
                                    <TextAreaInput 
                                        id="caption"
                                        label={t('createPulse.captionLabel')}
                                        value={caption}
                                        onChange={(e) => setCaption(e.target.value)}
                                        className="!min-h-[150px]"
                                    />
                                    <div className="flex items-center justify-between w-full mt-4">
                                        <div>
                                            <label htmlFor="venting-mode-pulse" className="font-semibold text-sm">{t('ventingMode.title')}</label>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('ventingMode.description')}</p>
                                        </div>
                                        <label htmlFor="venting-mode-pulse" className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                id="venting-mode-pulse" 
                                                className="sr-only peer"
                                                checked={isVenting}
                                                onChange={() => setIsVenting(!isVenting)}
                                            />
                                            <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                                        </label>
                                    </div>
                                    {isVenting && (
                                        <button type="button" onClick={() => setIsFollowerModalOpen(true)} className="text-sky-500 font-semibold text-sm mt-2 p-1 text-left">
                                            {allowedViewers.length > 0 ? t('ventingMode.audienceSelected', { count: allowedViewers.length }) : t('ventingMode.audienceButton')}
                                        </button>
                                    )}
                                {isSpotifyConnected === null ? (
                                        <div className="h-8 mt-2" /> // Placeholder
                                    ) : isSpotifyConnected ? (
                                        <>
                                            {selectedMusic ? (
                                                <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-2 rounded-md mt-2">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <MusicIcon />
                                                        <div className="text-sm">
                                                            <p className="font-semibold truncate">{selectedMusic.name}</p>
                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{selectedMusic.artists[0]?.name}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={() => setSelectedMusic(null)} className="font-bold text-lg px-2">&times;</button>
                                                </div>
                                            ) : (
                                                <button type="button" onClick={() => setShowMusicSearch(true)} className="text-sky-500 font-semibold text-sm mt-2 p-1">
                                                    {t('createPulse.addMusic')}
                                                </button>
                                            )}
                                            {showMusicSearch && (
                                                <MusicSearch 
                                                    selectedTrack={selectedMusic} 
                                                    onSelectMusic={handleSelectMusic} 
                                                    onClose={() => setShowMusicSearch(false)}
                                                    onConnect={handleConnectSpotify}
                                                />
                                            )}
                                        </>
                                    ) : (
                                        <div className="mt-2 text-center md:text-left">
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                                                {t('musicSearch.connectSpotifyMessage')}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleConnectSpotify}
                                                className="bg-green-500 text-white font-semibold rounded-lg py-1.5 px-4 text-sm hover:bg-green-600 transition-colors"
                                            >
                                                {t('musicSearch.connectSpotifyButton')}
                                            </button>
                                        </div>
                                    )}
                                    {error && <p className="text-red-500 text-xs text-center mt-2">{error}</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-16">
                                <MediaIcon />
                                <h3 className="text-xl mt-4 mb-2">{t('createPulse.selectMedia')}</h3>
                                <input type="file" ref={fileInputRef} onChange={handleMediaChange} className="hidden" accept="image/*,video/*" />
                                <Button onClick={triggerFileInput}>
                                    {t('createPulse.selectFromComputer')}
                                </Button>
                                {error && <p className="text-red-500 text-xs text-center mt-4">{error}</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <FollowerSelectionModal
                isOpen={isFollowerModalOpen}
                onClose={() => setIsFollowerModalOpen(false)}
                onSelectFollowers={setAllowedViewers}
                initiallySelected={allowedViewers}
            />
        </>
    )
};

export default CreatePulseModal;