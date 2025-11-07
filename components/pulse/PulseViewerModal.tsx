import React, { useState, useEffect } from 'react';
import { auth } from '../../firebase';

type Pulse = {
    id: string;
    mediaUrl: string;
    legenda: string;
    createdAt: { seconds: number; nanoseconds: number };
    authorId: string;
};

interface PulseViewerModalProps {
    pulses: Pulse[];
    initialPulseIndex: number;
    authorInfo: { username: string; avatar: string };
    onClose: () => void;
    onDelete: (pulse: Pulse) => void;
}

const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const PrevIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7 7" />
    </svg>
);

const NextIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
);

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({ pulses, initialPulseIndex, authorInfo, onClose, onDelete }) => {
    // FIX: Cria uma cópia local dos pulses para prevenir problemas com referências circulares no objeto da prop.
    const [localPulses, setLocalPulses] = useState([...pulses]);
    const [currentIndex, setCurrentIndex] = useState(initialPulseIndex);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    useEffect(() => {
        setLocalPulses([...pulses]);
        // Se o pulse atual for deletado externamente, talvez precisemos ajustar o índice.
        if (currentIndex >= pulses.length) {
            setCurrentIndex(Math.max(0, pulses.length - 1));
        }
    }, [pulses, currentIndex]);


    const currentUser = auth.currentUser;
    const currentPulse = localPulses[currentIndex];

    if (!currentPulse) {
        onClose();
        return null;
    }
    const isOwner = currentUser?.uid === currentPulse.authorId;
    
    const handleDelete = async () => {
        setIsDeleting(true);
        // Chama o handler onDelete original, que vai atualizar o estado do pai
        await onDelete(currentPulse);
        setIsDeleting(false);
        setIsDeleteConfirmOpen(false);
        // O componente pai vai renderizar este modal novamente com a lista de pulses atualizada.
        // O useEffect vai cuidar da atualização do estado.
    };

    const canGoNext = currentIndex < localPulses.length - 1;
    const canGoPrev = currentIndex > 0;
    
    return (
        <>
            <div 
                className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 select-none"
                onClick={onClose}
            >
                {canGoPrev && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i - 1); }} 
                        className="absolute left-2 md:left-4 text-white bg-black/40 rounded-full p-2 z-20 hover:bg-black/70 transition-colors"
                        aria-label="Previous pulse"
                    >
                        <PrevIcon className="w-6 h-6" />
                    </button>
                )}

                <div 
                    className="relative w-full max-w-sm h-full max-h-[95vh] flex flex-col items-center justify-center" 
                    onClick={e => e.stopPropagation()}
                >
                    <div className="absolute top-0 left-0 right-0 p-4 z-20 bg-gradient-to-b from-black/50 to-transparent">
                        <div className="flex items-center gap-2 mb-2">
                           {localPulses.map((_, index) => (
                                <div key={index} className="flex-1 h-1 bg-white/30 rounded-full">
                                    {index <= currentIndex && <div className="h-full bg-white rounded-full"/>}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={authorInfo.avatar} alt={authorInfo.username} className="w-8 h-8 rounded-full object-cover" />
                                <p className="text-white font-semibold text-sm">{authorInfo.username}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isOwner && (
                                    <button 
                                        onClick={() => setIsDeleteConfirmOpen(true)} 
                                        className="text-white p-2 rounded-full hover:bg-white/20"
                                        aria-label="Delete Pulse"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}
                                <button onClick={onClose} className="text-white text-3xl">&times;</button>
                            </div>
                        </div>
                    </div>
                   

                    <div className="relative w-full h-full rounded-lg overflow-hidden flex items-center justify-center bg-black">
                        {currentPulse.mediaUrl.includes('.mp4') || currentPulse.mediaUrl.includes('.webm') ? (
                            <video key={currentPulse.id} src={currentPulse.mediaUrl} controls autoPlay className="w-full h-full object-contain" />
                        ) : (
                            <img key={currentPulse.id} src={currentPulse.mediaUrl} alt={currentPulse.legenda || 'Pulse'} className="w-full h-full object-contain" />
                        )}

                        {currentPulse.legenda && (
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                                <p className="text-white text-center text-sm">{currentPulse.legenda}</p>
                            </div>
                        )}
                    </div>
                </div>

                {canGoNext && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => i + 1); }} 
                        className="absolute right-2 md:right-4 text-white bg-black/40 rounded-full p-2 z-20 hover:bg-black/70 transition-colors"
                        aria-label="Next pulse"
                    >
                        <NextIcon className="w-6 h-6" />
                    </button>
                )}
            </div>
            
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]">
                    <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center border dark:border-zinc-800">
                        <h3 className="text-lg font-semibold mb-2">Delete Pulse?</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                            Are you sure you want to delete this pulse? This cannot be undone.
                        </p>
                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="w-full px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-50"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button 
                                onClick={() => setIsDeleteConfirmOpen(false)}
                                className="w-full px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PulseViewerModal;
