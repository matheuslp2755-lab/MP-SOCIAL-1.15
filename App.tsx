import React, { useState, useEffect, StrictMode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp, messaging, getToken, onMessage } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider } from './context/LanguageContext';
import WelcomeAnimation from './components/common/WelcomeAnimation';
import { exchangeCodeForToken } from './components/common/spotifyApi';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);

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
      // You can display a toast notification here.
      // For example: new Notification(payload.notification.title, { body: payload.notification.body });
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