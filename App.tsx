import React, { useState, useEffect, StrictMode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp, messaging, getToken, onMessage } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import { LanguageProvider } from './context/LanguageContext';
import WelcomeAnimation from './components/common/WelcomeAnimation';

// Spotify Credentials for OAuth callback
const SPOTIFY_CLIENT_ID = 'ca3aed6612574a49b0516e7e5ecce076';
const SPOTIFY_CLIENT_SECRET = '185edb9e62ee423e8bca1475e06bd365';
const SPOTIFY_REDIRECT_URI = 'https://mp-social-1-15-lljpgvjru-matheuslp2755-labs-projects.vercel.app/';


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
    // Handle Spotify OAuth Callback
    const handleSpotifyCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const storedState = localStorage.getItem('spotify_auth_state');

      if (code && state && state === storedState) {
        localStorage.removeItem('spotify_auth_state');
        
        try {
            // NOTE: In a production app, the client secret should be kept on a server and not exposed
            // on the client-side. This token exchange would happen on a backend server.
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: SPOTIFY_REDIRECT_URI
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to exchange Spotify code for token: ${errorData.error_description}`);
            }
            const data = await response.json();
            
            const spotifyAuth = {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: Date.now() + (data.expires_in * 1000),
            };
            localStorage.setItem('spotify_auth_data', JSON.stringify(spotifyAuth));

        } catch (error) {
            console.error("Error handling Spotify callback:", error);
            localStorage.removeItem('spotify_auth_data');
        } finally {
             // Clean the URL to remove the code and state parameters
             window.history.replaceState({}, document.title, "/");
        }
      } else if (state && state !== storedState) {
          console.error("Spotify state mismatch. Potential CSRF attack.");
          localStorage.removeItem('spotify_auth_state');
          window.history.replaceState({}, document.title, "/");
      } else if (params.get('error')) {
          console.error(`Spotify auth error: ${params.get('error')}`);
          window.history.replaceState({}, document.title, "/");
      }
    };

    handleSpotifyCallback();
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
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
