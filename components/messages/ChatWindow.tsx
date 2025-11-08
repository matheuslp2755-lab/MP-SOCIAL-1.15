
import React, { useState, useEffect, useRef } from 'react';
import { 
    auth, 
    db, 
    doc, 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    writeBatch, 
    serverTimestamp,
    deleteDoc,
    updateDoc,
    getDocs,
    limit,
    getDoc,
    storage,
    storageRef,
    uploadBytes,
    getDownloadURL,
} from '../../firebase';
import ConnectionCrystal from './ConnectionCrystal';
import OnlineIndicator from '../common/OnlineIndicator';
import { useLanguage } from '../../context/LanguageContext';

interface ChatWindowProps {
    conversationId: string | null;
    onBack: () => void;
}

interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any;
    replyTo?: {
        messageId: string;
        senderId: string;
        senderUsername: string;
        text: string;
    };
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
}

interface OtherUser {
    id: string;
    username: string;
    avatar: string;
}

type CrystalLevel = 'BRILHANTE' | 'EQUILIBRADO' | 'APAGADO' | 'RACHADO';

interface CrystalData {
    createdAt: any;
    lastInteractionAt: any;
    level: CrystalLevel;
    streak: number;
}

interface ConversationData {
    participants: string[];
    participantInfo: {
        [key: string]: {
            username: string;
            avatar: string;
            lastSeenMessageTimestamp?: any;
        }
    };
    crystal?: CrystalData;
}


function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}


const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const ReplyIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-6-6m0 0l6-6M3 9h12a6 6 0 016 6v3" />
    </svg>
);

const BackArrowIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
);

const ImageIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, onBack }) => {
    const { t } = useLanguage();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
    const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
    const [conversationData, setConversationData] = useState<ConversationData | null>(null);
    const [crystalData, setCrystalData] = useState<CrystalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ open: boolean, messageId: string | null }>({ open: false, messageId: null });
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);
    
    type AnimationState = 'idle' | 'forming' | 'settling';
    const [animationState, setAnimationState] = useState<AnimationState>('idle');
    const [animationMessage, setAnimationMessage] = useState('');
    const [finalCrystalPos, setFinalCrystalPos] = useState({ top: 0, left: 0, width: 0, height: 0 });

    const currentUser = auth.currentUser;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const crystalHeaderRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const prevCrystalData = usePrevious(crystalData);
    const unsubUserStatusRef = useRef<(() => void) | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);

    useEffect(() => {
        if (replyingTo) {
            inputRef.current?.focus();
        }
    }, [replyingTo]);
    
    useEffect(() => {
        if (!crystalData || !crystalHeaderRef.current || !dialogRef.current) return;

        const now = new Date();
        const createdAt = crystalData.createdAt.toDate();
        const justCreated = (now.getTime() - createdAt.getTime()) < 5000; // 5 seconds threshold

        const upgradedToBrilhante = crystalData.level === 'BRILHANTE' && prevCrystalData?.level && prevCrystalData.level !== 'BRILHANTE';

        if (justCreated || upgradedToBrilhante) {
            const rect = crystalHeaderRef.current.getBoundingClientRect();
            const modalRect = dialogRef.current.getBoundingClientRect();
           
            setFinalCrystalPos({
                top: rect.top - modalRect.top,
                left: rect.left - modalRect.left,
                width: rect.width,
                height: rect.height
            });

            setAnimationMessage(justCreated ? t('crystal.formed') : t('crystal.glowing'));
            setAnimationState('forming');

            const settlingTimer = setTimeout(() => {
                setAnimationState('settling');
            }, 4000); // Wait 4s before moving

            return () => {
                clearTimeout(settlingTimer);
            };
        }
    }, [crystalData, prevCrystalData, t]);

    useEffect(() => {
        if (!conversationId || !currentUser) {
            setMessages([]);
            setOtherUser(null);
            setCrystalData(null);
            setConversationData(null);
            return;
        }

        setLoading(true);

        const unsubConversation = onSnapshot(doc(db, 'conversations', conversationId), (docSnap) => {
            const data = docSnap.data() as ConversationData;
            if (data) {
                setConversationData(data);
                const otherUserId = data.participants.find((p: string) => p !== currentUser.uid);
                
                if(otherUserId) {
                    const otherUserInfo = data.participantInfo[otherUserId];
                    setOtherUser({
                        id: otherUserId,
                        username: otherUserInfo?.username || t('common.user'),
                        avatar: otherUserInfo?.avatar || `https://i.pravatar.cc/150?u=${otherUserId}`,
                    });

                    if (!unsubUserStatusRef.current) {
                        const userDocRef = doc(db, 'users', otherUserId);
                        unsubUserStatusRef.current = onSnapshot(userDocRef, (userSnap) => {
                            if (userSnap.exists()) {
                                const lastSeen = userSnap.data().lastSeen;
                                const isOnline = lastSeen && (new Date().getTime() / 1000 - lastSeen.seconds) < 600;
                                setIsOtherUserOnline(isOnline);
                            } else {
                                setIsOtherUserOnline(false);
                            }
                        });
                    }
                }


                if (data.crystal) {
                    const lastInteractionDate = data.crystal.lastInteractionAt.toDate();
                    const now = new Date();
                    const diffHours = (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60);

                    let calculatedLevel: CrystalLevel = data.crystal.level;
                    if (diffHours <= 24) {
                        calculatedLevel = 'BRILHANTE';
                    } else if (diffHours > 24 && diffHours <= 72) {
                        calculatedLevel = 'EQUILIBRADO';
                    } else if (diffHours > 72 && diffHours <= 168) {
                        calculatedLevel = 'APAGADO';
                    } else if (diffHours > 168) {
                        calculatedLevel = 'RACHADO';
                    }
                    
                    setCrystalData({ ...data.crystal, level: calculatedLevel });
                } else {
                    setCrystalData(null);
                }
            }
        });

        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMessages = onSnapshot(messagesQuery, async (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);

            const lastOtherUserMessage = [...msgs].reverse().find(m => m.senderId !== currentUser.uid);
            
            if (lastOtherUserMessage) {
                const convRef = doc(db, 'conversations', conversationId);
                const convSnap = await getDoc(convRef);
                const convData = convSnap.data() as ConversationData;
                const currentUserInfo = convData?.participantInfo?.[currentUser.uid];

                if (!currentUserInfo?.lastSeenMessageTimestamp || 
                    lastOtherUserMessage.timestamp?.seconds > currentUserInfo.lastSeenMessageTimestamp.seconds) {
                    
                    await updateDoc(convRef, {
                        [`participantInfo.${currentUser.uid}.lastSeenMessageTimestamp`]: lastOtherUserMessage.timestamp
                    });
                }
            }
            
            setLoading(false);
        });

        return () => {
            unsubConversation();
            unsubMessages();
            if (unsubUserStatusRef.current) {
                unsubUserStatusRef.current();
                unsubUserStatusRef.current = null;
            }
        };
    }, [conversationId, currentUser, t]);

    const clearMediaSelection = () => {
        setMediaFile(null);
        setMediaPreview(null);
        setMediaType(null);
        setMediaError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        clearMediaSelection();

        if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 30) {
                    setMediaError(t('messages.videoTooLong'));
                } else {
                    setMediaType('video');
                    setMediaFile(file);
                    setMediaPreview(URL.createObjectURL(file));
                }
            };
            video.src = URL.createObjectURL(file);
        } else if (file.type.startsWith('image/')) {
            setMediaType('image');
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if ((!newMessage.trim() && !mediaFile) || isUploading || !currentUser || !conversationId || !otherUser) return;

        setIsUploading(true);

        const tempMessage = newMessage;
        const tempReplyingTo = replyingTo;
        const tempMediaFile = mediaFile;
        const tempMediaType = mediaType;
        
        setNewMessage('');
        setReplyingTo(null);
        clearMediaSelection();

        let downloadURL: string | undefined;

        try {
            if (tempMediaFile && tempMediaType) {
                const filePath = `conversations/${conversationId}/${Date.now()}-${tempMediaFile.name}`;
                const fileRef = storageRef(storage, filePath);
                await uploadBytes(fileRef, tempMediaFile);
                downloadURL = await getDownloadURL(fileRef);
            }

            if (!tempMessage.trim() && !downloadURL) {
                throw new Error("Nothing to send");
            }

            const conversationRef = doc(db, 'conversations', conversationId);
            const messagesRef = collection(conversationRef, 'messages');
            const recipientNotificationRef = doc(collection(db, 'users', otherUser.id, 'notifications'));

            const conversationSnap = await getDoc(conversationRef);
            const currentData = conversationSnap.data();
            
            let newStreak = 1;
            if (currentData?.crystal?.lastInteractionAt) {
                const lastInteractionDate = currentData.crystal.lastInteractionAt.toDate();
                
                const isYesterday = (d: Date) => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
                };

                const isToday = (d: Date) => {
                    const today = new Date();
                    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                };

                if (isYesterday(lastInteractionDate)) {
                    newStreak = (currentData.crystal.streak || 0) + 1;
                } else if (isToday(lastInteractionDate)) {
                    newStreak = currentData.crystal.streak || 1;
                }
            }

            const crystalUpdate = {
                crystal: {
                    createdAt: currentData?.crystal?.createdAt || serverTimestamp(),
                    lastInteractionAt: serverTimestamp(),
                    level: 'BRILHANTE',
                    streak: newStreak,
                }
            };
            
            const batch = writeBatch(db);
            const newMessageRef = doc(messagesRef);
            
            const newMessageData: any = {
                senderId: currentUser.uid,
                text: tempMessage,
                timestamp: serverTimestamp(),
            };

            if (tempReplyingTo) {
                newMessageData.replyTo = {
                    messageId: tempReplyingTo.id,
                    senderId: tempReplyingTo.senderId,
                    senderUsername: tempReplyingTo.senderId === currentUser.uid 
                        ? (currentUser.displayName || t('common.you'))
                        : (otherUser?.username || t('common.user')),
                    text: tempReplyingTo.text,
                };
            }

            if (downloadURL && tempMediaType) {
                newMessageData.mediaUrl = downloadURL;
                newMessageData.mediaType = tempMediaType;
            }

            batch.set(newMessageRef, newMessageData);

            let lastMessageText = tempMessage;
            if (downloadURL) {
                if (tempMediaType === 'image') {
                    lastMessageText = tempMessage ? `📷 ${tempMessage}` : t('messages.photo');
                } else {
                    lastMessageText = tempMessage ? `📹 ${tempMessage}` : t('messages.video');
                }
            }

            batch.update(conversationRef, {
                lastMessage: {
                    text: lastMessageText,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                },
                timestamp: serverTimestamp(),
                ...crystalUpdate,
            });

            batch.set(recipientNotificationRef, {
                type: 'message',
                fromUserId: currentUser.uid,
                fromUsername: currentUser.displayName,
                fromUserAvatar: currentUser.photoURL,
                conversationId: conversationId,
                timestamp: serverTimestamp(),
                read: false,
            });
            
            await batch.commit();

        } catch (error) {
            console.error("Error sending message:", error);
            setMediaError(t('messages.uploadError'));
            setNewMessage(tempMessage); // Restore state on failure
            setReplyingTo(tempReplyingTo);
            setMediaFile(tempMediaFile);
            setMediaType(tempMediaType);
            if(tempMediaFile) setMediaPreview(URL.createObjectURL(tempMediaFile));
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDeleteMessage = async () => {
        if (!showDeleteConfirm.messageId || !conversationId) return;
        
        const messageIdToDelete = showDeleteConfirm.messageId;
        setShowDeleteConfirm({ open: false, messageId: null });

        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageIdToDelete);
        const conversationRef = doc(db, 'conversations', conversationId);

        try {
            await deleteDoc(messageRef);

            const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'desc'), limit(1));
            const lastMessageSnap = await getDocs(messagesQuery);

            let lastMessageUpdate: any = {};
            if (lastMessageSnap.empty) {
                lastMessageUpdate = { lastMessage: null };
            } else {
                const lastMessage = lastMessageSnap.docs[0].data();
                lastMessageUpdate = {
                    lastMessage: {
                        text: lastMessage.text,
                        senderId: lastMessage.senderId,
                        timestamp: lastMessage.timestamp,
                    }
                };
            }
            await updateDoc(conversationRef, lastMessageUpdate);

        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const getCrystalStatusText = (level: CrystalLevel) => {
        const statuses: Record<CrystalLevel, string> = {
            BRILHANTE: t('crystal.level.brilhante'),
            EQUILIBRADO: t('crystal.level.equilibrado'),
            APAGADO: t('crystal.level.apagado'),
            RACHADO: t('crystal.level.rachado'),
        };
        return statuses[level] || '';
    }

    const lastSentMessageIndex = messages.map(m => m.senderId).lastIndexOf(currentUser?.uid);
    let shouldShowSeen = false;
    if (lastSentMessageIndex !== -1 && otherUser && conversationData) {
        const lastSentMessage = messages[lastSentMessageIndex];
        const otherUserInfo = conversationData.participantInfo[otherUser.id];
        if (otherUserInfo?.lastSeenMessageTimestamp && lastSentMessage.timestamp?.seconds <= otherUserInfo.lastSeenMessageTimestamp.seconds) {
            shouldShowSeen = true;
        }
    }


    if (loading) {
        return <div className="h-full flex items-center justify-center">{t('messages.loading')}</div>;
    }
    
    if (!conversationId) {
         return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <svg aria-label="Direct" className="w-24 h-24 text-zinc-800 dark:text-zinc-200" fill="currentColor" height="96" role="img" viewBox="0 0 96 96" width="96"><path d="M48 0C21.534 0 0 21.534 0 48s21.534 48 48 48 48-21.534 48-48S74.466 0 48 0Zm0 91.5C24.087 91.5 4.5 71.913 4.5 48S24.087 4.5 48 4.5 91.5 24.087 91.5 48 71.913 91.5 48 91.5Zm16.5-54.498L33.91 56.41l-10.46-10.46a4.5 4.5 0 0 0-6.364 6.364l13.642 13.64a4.5 4.5 0 0 0 6.364 0L70.864 43.37a4.5 4.5 0 0 0-6.364-6.368Z"></path></svg>
                <h2 className="text-2xl mt-4">{t('messages.yourMessages')}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">{t('messages.sendPrivate')}</p>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-full relative" ref={dialogRef}>
            {otherUser && (
                <header className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                    <button onClick={onBack} aria-label={t('messages.back')}>
                       <BackArrowIcon className="w-6 h-6" />
                    </button>
                    <div className="relative">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-10 h-10 rounded-full object-cover" />
                        {isOtherUserOnline && <OnlineIndicator className="bottom-0 right-0 h-3 w-3" />}
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold">{otherUser.username}</p>
                        {crystalData && (
                            <div 
                                ref={crystalHeaderRef} 
                                className={`flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 transition-opacity duration-300 ${animationState !== 'idle' ? 'opacity-0' : 'opacity-100'}`} 
                                title={t('crystal.title', { status: getCrystalStatusText(crystalData.level) })}
                            >
                                <ConnectionCrystal level={crystalData.level} className="w-4 h-4" />
                                <span>{getCrystalStatusText(crystalData.level)}</span>
                                {crystalData.streak > 1 && (
                                    <span title={t('crystal.streak', { streak: crystalData.streak })}>🔥 {crystalData.streak}</span>
                                )}
                            </div>
                        )}
                    </div>
                </header>
            )}
            <div className="flex-grow py-4 px-2 overflow-y-auto">
                <div className="flex flex-col gap-1">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end group gap-2 ${msg.senderId === currentUser?.uid ? 'self-end flex-row-reverse' : 'self-start'}`}>
                            <div className={`max-w-xs md:max-w-md lg:max-w-lg rounded-2xl overflow-hidden ${
                                msg.senderId === currentUser?.uid 
                                ? 'bg-sky-500 text-white' 
                                : 'bg-zinc-200 dark:bg-zinc-800'
                            }`}>
                                {msg.replyTo && (
                                    <div className={`p-2 mx-3 mt-2 rounded-lg truncate ${
                                        msg.senderId === currentUser?.uid
                                        ? 'bg-sky-400 border-l-2 border-sky-200'
                                        : 'bg-zinc-300 dark:bg-zinc-700 border-l-2 border-zinc-400 dark:border-zinc-500'
                                    }`}>
                                        <p className="font-semibold text-xs">{msg.replyTo.senderUsername}</p>
                                        <p className="text-sm opacity-90">{msg.replyTo.text}</p>
                                    </div>
                                )}
                                {msg.mediaUrl && (
                                    msg.mediaType === 'image' ? (
                                        <img src={msg.mediaUrl} alt="Media content" className="block w-full h-auto cursor-pointer" onClick={() => window.open(msg.mediaUrl, '_blank')} />
                                    ) : (
                                        <video src={msg.mediaUrl} controls className="block w-full h-auto bg-black" />
                                    )
                                )}
                                {msg.text && (
                                    <p className="text-sm break-words px-3 py-2">{msg.text}</p>
                                )}
                            </div>
                    
                            <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setReplyingTo(msg)}
                                    className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    aria-label="Reply to message"
                                >
                                    <ReplyIcon className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                                </button>
                                {msg.senderId === currentUser?.uid && (
                                    <button 
                                        onClick={() => setShowDeleteConfirm({ open: true, messageId: msg.id })}
                                        className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                        aria-label="Delete message"
                                    >
                                        <TrashIcon className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {shouldShowSeen && (
                         <div className="flex justify-end pr-12">
                             <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('messages.seen')}</p>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                {(mediaPreview || replyingTo || mediaError) && (
                    <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded-t-lg mb-[-8px] border-l-4 border-sky-500 relative mx-1">
                        {replyingTo && currentUser && (
                             <div className="flex justify-between items-center">
                                <p className="text-xs font-semibold text-sky-500">
                                    {replyingTo.senderId === currentUser.uid
                                        ? t('messages.replyingToSelf')
                                        : t('messages.replyingToOther', { username: otherUser?.username || '...' })}
                                </p>
                                 <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        )}
                        {replyingTo && <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">{replyingTo.text}</p>}

                        {mediaPreview && (
                             <div className="flex items-start gap-2 mt-2">
                                {mediaType === 'image' ? 
                                    <img src={mediaPreview} alt="Preview" className="w-12 h-12 rounded object-cover"/> :
                                    <video src={mediaPreview} className="w-12 h-12 rounded object-cover bg-black" />
                                }
                                <div className="flex-grow">
                                    <p className="text-xs text-zinc-500">{mediaFile?.name}</p>
                                </div>
                                <button onClick={clearMediaSelection} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 self-start">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        )}
                         {mediaError && <p className="text-red-500 text-xs mt-1">{mediaError}</p>}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/mp4,video/quicktime,video/webm" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" disabled={isUploading}>
                        <ImageIcon className="w-6 h-6 text-zinc-600 dark:text-zinc-300"/>
                    </button>
                     <input 
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t('messages.messagePlaceholder')}
                        className={`w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 py-2 pl-4 pr-4 text-sm focus:outline-none focus:border-sky-500 ${(replyingTo || mediaPreview || mediaError) ? 'rounded-b-full rounded-t-none' : 'rounded-full'}`}
                    />
                    <button type="submit" disabled={(!newMessage.trim() && !mediaFile) || isUploading} className="text-sky-500 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed px-2">
                        {isUploading ? '...' : t('messages.send')}
                    </button>
                </form>
            </div>
            {showDeleteConfirm.open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]"
                    onClick={() => setShowDeleteConfirm({ open: false, messageId: null })}
                >
                    <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-2">{t('messages.deleteTitle')}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                            {t('messages.deleteBody')}
                        </p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => setShowDeleteConfirm({ open: false, messageId: null })}
                                className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold"
                            >
                                {t('common.cancel')}
                            </button>
                            <button 
                                onClick={handleDeleteMessage}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                            >
                                {t('common.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {animationState !== 'idle' && (
                <div className="absolute inset-0 bg-black bg-opacity-30 z-10 flex flex-col justify-center items-center pointer-events-none">
                    <div
                        onTransitionEnd={() => {
                            if (animationState === 'settling') {
                                setAnimationState('idle');
                            }
                        }}
                        className="absolute transition-all duration-1000 ease-in-out"
                        style={
                            animationState === 'forming'
                            ? {
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '96px', // w-24
                                height: '96px', // h-24
                            }
                            : { // 'settling'
                                top: `${finalCrystalPos.top}px`,
                                left: `${finalCrystalPos.left}px`,
                                width: `${finalCrystalPos.width}px`,
                                height: `${finalCrystalPos.height}px`,
                                transform: 'translate(0, 0)',
                            }
                        }
                    >
                        <ConnectionCrystal level="BRILHANTE" className="w-full h-full" />
                    </div>
                    <p
                        className="text-white text-lg font-semibold mt-40 transition-opacity duration-500"
                        style={{
                            opacity: animationState === 'forming' ? 1 : 0,
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        }}
                    >
                        {animationMessage}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;
