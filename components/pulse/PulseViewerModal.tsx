
import React, { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, serverTimestamp, collection, onSnapshot } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';
import PulseViewsModal from './PulseViewsModal';
import SpotifyPlayer from '../common/SpotifyPlayer';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
    musica?: {
        id: string;
        name: string;
        artists: string[];
        albumImage: string;
        uri: string;
        preview_url: string | null;
    };
};

interface PulseViewerModalProps {
    pulses: Pulse[];
    initialPulseIndex: number;
    authorInfo: { id: string, username: string, avatar: string };
    onClose: () => void;
    onDelete: (pulse: Pulse) => void;
}

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const EyeIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const PrevIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
);

const NextIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({ pulses, initialPulseIndex, authorInfo, onClose, onDelete }) => {
    const { t } = useLanguage();
    const [localPulses, setLocalPulses] = useState([...pulses]);
    const [currentIndex, setCurrentIndex] = useState(initialPulseIndex);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewsCount, setViewsCount] = useState(0);
    const [isViewsModalOpen, setIsViewsModalOpen] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        setLocalPulses([...pulses]);
        if (currentIndex >= pulses.length && pulses.length > 0) {
            setCurrentIndex(pulses.length - 1);
        } else if (pulses.length === 0) {
            onClose();
        }
    }, [pulses, currentIndex, onClose]);

    const currentPulse = localPulses[currentIndex];

    useEffect(() => {
        if (!currentPulse || !currentUser || currentUser.uid === authorInfo.id) return;
        
        const registerView = async () => {
            const viewRef = doc(db, 'pulses', currentPulse.id, 'views', currentUser.uid);
            await setDoc(viewRef, {
                userId: currentUser.uid,
                viewedAt: serverTimestamp()
            });
        };
        
        registerView().catch(console.error);
    }, [currentPulse, currentUser, authorInfo.id]);

    useEffect(() => {
        if (!currentPulse) return;

        const viewsRef = collection(db, 'pulses', currentPulse.id, 'views');
        const unsubscribe = onSnapshot(viewsRef, (snapshot) => {
            setViewsCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [currentPulse]);

    const goToNext = () => {
        setCurrentIndex(prev => (prev + 1) % localPulses.length);
    };

    const goToPrev = () => {
        setCurrentIndex(prev => (prev - 1 + localPulses.length) % localPulses.length);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'ArrowLeft') goToPrev();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [localPulses.length]);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDelete(currentPulse);
        } catch (error) {
            console.error("Error during deletion callback:", error);
        } finally {
            setIsDeleting(false);
            setIsDeleteConfirmOpen(false);
        }
    };
    
    if (!currentPulse) {
        return null;
    }
    
    const isVideo = currentPulse.mediaUrl.includes('.mp4') || currentPulse.mediaUrl.includes('.webm');

    return (
      <>
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={onClose}>
            <div className="relative aspect-[9/16] h-full max-h-[90vh] max-w-[90vw] my-auto" onClick={e => e.stopPropagation()}>
                {isVideo ? (
                    <video src={currentPulse.mediaUrl} autoPlay controls className="w-full h-full object-contain rounded-lg" />
                ) : (
                    <img src={currentPulse.mediaUrl} alt={currentPulse.legenda} className="w-full h-full object-contain rounded-lg" />
                )}
                <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <img src={authorInfo.avatar} alt={authorInfo.username} className="w-10 h-10 rounded-full object-cover" />
                        <span className="font-semibold text-white">{authorInfo.username}</span>
                        <button onClick={onClose} className="ml-auto text-white text-3xl font-light">&times;</button>
                    </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg text-white">
                    {currentPulse.legenda && <p className="text-sm mb-2">{currentPulse.legenda}</p>}
                    {currentPulse.musica?.id && (
                        <div className="mt-2">
                            <SpotifyPlayer trackId={currentPulse.musica.id} />
                        </div>
                    )}
                    {currentUser?.uid === authorInfo.id && (
                        <div className="flex items-center gap-4 mt-2">
                             <button onClick={() => setIsViewsModalOpen(true)} className="flex items-center gap-1 text-xs font-semibold">
                                <EyeIcon className="w-4 h-4" />
                                {viewsCount} {viewsCount === 1 ? t('pulseViewer.viewSingular') : t('pulseViewer.viewPlural')}
                            </button>
                            <button onClick={() => setIsDeleteConfirmOpen(true)} className="ml-auto p-1" title={t('pulseViewer.delete')}>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
                {localPulses.length > 1 && (
                    <>
                        <button onClick={goToPrev} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2" aria-label={t('pulseViewer.previous')}>
                            <PrevIcon className="w-6 h-6 text-white" />
                        </button>
                        <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/50 rounded-full p-2" aria-label={t('pulseViewer.next')}>
                            <NextIcon className="w-6 h-6 text-white" />
                        </button>
                    </>
                )}
            </div>
        </div>

        {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
                <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                    <h3 className="text-lg font-semibold mb-2">{t('pulseViewer.deleteTitle')}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                        {t('pulseViewer.deleteBody')}
                    </p>
                    <div className="flex flex-col gap-2">
                         <button onClick={handleDelete} disabled={isDeleting} className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50">
                            {isDeleting ? t('common.deleting') : t('common.delete')}
                        </button>
                        <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold">
                            {t('common.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <PulseViewsModal
            isOpen={isViewsModalOpen}
            onClose={() => setIsViewsModalOpen(false)}
            pulseId={currentPulse.id}
        />
      </>
    );
};

export default PulseViewerModal;
