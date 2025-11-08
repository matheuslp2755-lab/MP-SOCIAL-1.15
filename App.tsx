import React, { useState, useEffect, StrictMode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp, messaging, getToken, onMessage } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider } from './context/LanguageContext';
import WelcomeAnimation from './components/common/WelcomeAnimation';
import { exchangeCodeForToken } from './components/common/spotifyApi';

const Toast: React.FC<{ title: string; body: string; onClose: () => void }> = ({ title, body, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Auto-close after 5 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-5 right-5 bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-4 max-w-sm z-[100] border dark:border-zinc-700 animate-slide-in-right">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <div className="ml-3 w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button onClick={onClose} className="bg-white dark:bg-zinc-800 rounded-md inline-flex text-zinc-400 dark:text-zinc-500 hover:text-zinc-500 dark:hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
            <span className="sr-only">Close</span>
            &times;
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const welcomeKey = 'hasSeenWelcome_1_15';
    const hasSeen = localStorage.getItem(welcomeKey);
    if (!hasSeen) {
      setShowWelcomeAnimation(true);
      localStorage.setItem(welcomeKey, 'true');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        console.error("Erro de autenticação do Spotify:", error);
        window.history.pushState({}, '', '/'); // Limpa a URL
    } else if (code) {
        exchangeCodeForToken(code).then(() => {
            const redirectPath = localStorage.getItem("spotify_auth_redirect_path") || '/';
            localStorage.removeItem("spotify_auth_redirect_path");
            window.history.pushState({}, '', redirectPath); // Limpa a URL e restaura o caminho
        });
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    const updateUserLastSeen = () => {
        updateDoc(userDocRef, {
            lastSeen: serverTimestamp()
        }).catch(err => console.error("Failed to update last seen:", err));
    };

    updateUserLastSeen();

    const intervalId = setInterval(updateUserLastSeen, 5 * 60 * 1000); // every 5 minutes

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            updateUserLastSeen();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateUserLastSeen);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateUserLastSeen);
    };
}, [user]);

  useEffect(() => {
    if (!user) return;

    const requestPermissionAndGetToken = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          const currentToken = await getToken(messaging, {
            vapidKey: 'BM6X7BMtwcgtZ8qpVGzFa7TAwm9dJlMyggtTdeTUNmdgSR4nypTcikswMgWlcP0ZWFRQg9ujZ1fy6SfjO1lLar4',
          });

          if (currentToken) {
            console.log('FCM Token:', currentToken);
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
              fcmToken: currentToken,
            });
          } else {
            console.log('No registration token available. Request permission to generate one.');
          }
        } else {
          console.log('Unable to get permission to notify.');
        }
      } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
      }
    };
    
    requestPermissionAndGetToken();

    const unsubscribeOnMessage = onMessage(messaging, (payload) => {
      console.log('Foreground message received. ', payload);
      if (payload.notification) {
          setToast({
              title: payload.notification.title || 'Nova Notificação',
              body: payload.notification.body || ''
          });
      }
    });
    
    return () => {
        unsubscribeOnMessage();
    };
  }, [user]);

  const switchAuthPage = (page: 'login' | 'signup') => {
    setAuthPage(page);
  };

  const renderApp = () => {
    if (loading) {
      return (
        <div className="bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      );
    }

    if (!user) {
      return (
        <div className="bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col">
          <main className="flex-grow flex items-center justify-center py-10 px-4">
            {authPage === 'login' ? (
              <Login onSwitchMode={() => switchAuthPage('signup')} />
            ) : (
              <SignUp onSwitchMode={() => switchAuthPage('login')} />
            )}
          </main>
        </div>
      );
    }

    return (
      <div className="bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 min-h-screen">
        <Feed />
      </div>
    );
  };

  return (
    <>
      {showWelcomeAnimation && (
        <WelcomeAnimation onAnimationEnd={() => setShowWelcomeAnimation(false)} />
      )}
      {toast && <Toast title={toast.title} body={toast.body} onClose={() => setToast(null)} />}
      {renderApp()}
    </>
  );
};

const App: React.FC = () => (
  <StrictMode>
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  </StrictMode>
);


export default App;