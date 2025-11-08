export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    preview_url: string | null;
}

const clientId = 'ca3aed6612574a49b0516e7e5ecce076';
const redirectUri = "https://voluble-twilight-eeef69.netlify.app/";

// --- PKCE Helper Functions ---
function generateCodeVerifier(length: number): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- Authorization Flow ---

/**
 * Step 1: Redirects the user to Spotify's authorization page.
 */
export async function redirectToAuth() {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("spotify_code_verifier", verifier);
    localStorage.setItem("spotify_auth_redirect_path", window.location.pathname);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectUri);
    params.append("scope", "user-read-private user-read-email");
    params.append("code_challenge_method", "S256");
    params.append("code_challenge", challenge);

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Step 2: Exchanges the authorization code for an access token.
 */
export async function exchangeCodeForToken(code: string) {
    const verifier = localStorage.getItem("spotify_code_verifier");

    if (!verifier) {
        console.error("Code verifier not found!");
        return;
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectUri);
    params.append("code_verifier", verifier);

    try {
        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        if (!result.ok) throw new Error("Failed to exchange code for token");

        const { access_token, refresh_token, expires_in } = await result.json();
        
        localStorage.setItem("spotify_access_token", access_token);
        if (refresh_token) {
             localStorage.setItem("spotify_refresh_token", refresh_token);
        }
        localStorage.setItem("spotify_token_expires_at", (Date.now() + expires_in * 1000).toString());
        localStorage.removeItem("spotify_code_verifier");

    } catch (error) {
        console.error("Error getting Spotify token:", error);
    }
}

// --- Token Management ---
async function refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) {
        return null;
    }

    const params = new URLSearchParams();
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);
    params.append("client_id", clientId);
    
    try {
        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        if (!result.ok) throw new Error("Failed to refresh token");

        const { access_token, expires_in, refresh_token: new_refresh_token } = await result.json();
        localStorage.setItem("spotify_access_token", access_token);
        localStorage.setItem("spotify_token_expires_at", (Date.now() + expires_in * 1000).toString());
        if (new_refresh_token) {
            localStorage.setItem("spotify_refresh_token", new_refresh_token);
        }
        return access_token;
    } catch (error) {
        console.error("Error refreshing token:", error);
        localStorage.removeItem("spotify_access_token");
        localStorage.removeItem("spotify_refresh_token");
        localStorage.removeItem("spotify_token_expires_at");
        return null;
    }
}

async function getValidAccessToken(): Promise<string | null> {
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    const accessToken = localStorage.getItem('spotify_access_token');
    
    if (accessToken && expiresAt && Date.now() < parseInt(expiresAt)) {
        return accessToken;
    }

    return await refreshToken();
}

// --- API Call ---
export const searchSpotifyTracks = async (query: string): Promise<SpotifyTrack[]> => {
    if (!query.trim()) return [];

    let token = await getValidAccessToken();
    if (!token) {
        throw new Error("SPOTIFY_AUTH_REQUIRED");
    }
    
    try {
        const response = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
    
        if (!response.ok) {
            if (response.status === 401) {
                token = await refreshToken();
                if (!token) throw new Error("SPOTIFY_AUTH_REQUIRED");
                
                const retryResponse = await fetch(
                    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                if (!retryResponse.ok) throw new Error(`Spotify search failed on retry: ${await retryResponse.text()}`);
                const retryData = await retryResponse.json();
                return (retryData.tracks?.items || []).filter((track: SpotifyTrack) => track.preview_url);
            }
            throw new Error(`Spotify search failed: ${await response.text()}`);
        }
    
        const data = await response.json();
        const items = data.tracks?.items || [];
        return items.filter((track: SpotifyTrack) => track.preview_url);

    } catch (error) {
        console.error("Error searching Spotify:", error);
        if ((error as Error).message === "SPOTIFY_AUTH_REQUIRED") {
            throw error;
        }
        throw new Error("Failed to search Spotify.");
    }
};