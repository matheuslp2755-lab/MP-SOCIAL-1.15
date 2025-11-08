import React, { useState, useEffect } from 'react';
import { auth, db, collection, getDocs } from '../../firebase';
import { useLanguage } from '../../context/LanguageContext';

interface Follower {
  id: string;
  username: string;
  avatar: string;
}

interface FollowerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFollowers: (followerIds: string[]) => void;
  initiallySelected: string[];
}

const Spinner: React.FC = () => (
    <div className="flex justify-center items-center p-4">
        <svg className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

const FollowerSelectionModal: React.FC<FollowerSelectionModalProps> = ({ isOpen, onClose, onSelectFollowers, initiallySelected }) => {
    const { t } = useLanguage();
    const [followers, setFollowers] = useState<Follower[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFollowers, setSelectedFollowers] = useState<Set<string>>(new Set(initiallySelected));

    useEffect(() => {
        if (!isOpen) return;

        const fetchFollowers = async () => {
            if (!auth.currentUser) return;
            setLoading(true);
            try {
                const followersRef = collection(db, 'users', auth.currentUser.uid, 'followers');
                const snapshot = await getDocs(followersRef);
                const followersData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    username: doc.data().username,
                    avatar: doc.data().avatar,
                }));
                setFollowers(followersData);
            } catch (error) {
                console.error("Error fetching followers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchFollowers();
        setSelectedFollowers(new Set(initiallySelected));
    }, [isOpen, initiallySelected]);

    if (!isOpen) return null;

    const handleToggleSelection = (followerId: string) => {
        setSelectedFollowers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(followerId)) {
                newSet.delete(followerId);
            } else {
                newSet.add(followerId);
            }
            return newSet;
        });
    };

    const handleDone = () => {
        onSelectFollowers(Array.from(selectedFollowers));
        onClose();
    };

    const filteredFollowers = followers.filter(f => f.username.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]" onClick={onClose}>
            <div className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-sm border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                    <button onClick={onClose} className="font-semibold text-sky-500">{t('common.cancel')}</button>
                    <h2 className="text-lg font-semibold">{t('ventingMode.selectAudience')}</h2>
                    <button onClick={handleDone} className="font-semibold text-sky-500">{t('ventingMode.done')}</button>
                </header>
                <div className="p-4 flex-shrink-0">
                    <input
                        type="text"
                        placeholder={t('ventingMode.searchFollowers')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md py-1.5 px-4 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500"
                    />
                </div>
                <main className="flex-grow overflow-y-auto">
                    {loading ? (
                        <Spinner />
                    ) : filteredFollowers.length > 0 ? (
                        filteredFollowers.map(follower => (
                            <div key={follower.id} className="flex items-center p-3 gap-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" onClick={() => handleToggleSelection(follower.id)}>
                                <img src={follower.avatar} alt={follower.username} className="w-11 h-11 rounded-full object-cover" />
                                <span className="font-semibold flex-grow">{follower.username}</span>
                                <input
                                    type="checkbox"
                                    checked={selectedFollowers.has(follower.id)}
                                    readOnly
                                    className="form-checkbox h-5 w-5 text-sky-600 bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-600 rounded focus:ring-sky-500 pointer-events-none"
                                />
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-sm text-zinc-500 p-4">{t('ventingMode.noFollowersFound')}</p>
                    )}
                </main>
            </div>
        </div>
    );
};

export default FollowerSelectionModal;
