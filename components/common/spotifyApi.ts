
export interface SpotifyTrack {
    id: string;
    name: string;
    artists: { name: string }[];
    preview_url: string | null;
    album: {
        images: { url: string }[];
    };
    duration_ms: number;
    uri: string;
}

const clientId = 'ca3aed6612574a49b0516e7e5ecce076';
// Use a dynamic redirect URI to work across different environments (local, prod)
const redirectUri = "https://mp-social-1-15-m77a9daj8-matheuslp2755-labs-projects.vercel.app/";

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
    params.append("scope", "user-read-private user-read-email user-top-read user-read-playback-state user-modify-playback-state");
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
        console.error("Error exchanging code for token:", error);
    }
}

/**
 * Step 3: Refresh the access token using the refresh token.
 */
async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem("spotify_refresh_token");
    if (!refreshToken) {
        console.log("No refresh token available.");
        return null;
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", refreshToken);

    try {
        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });

        if (!result.ok) {
            // If refresh fails, clear tokens to force re-authentication
            localStorage.removeItem("spotify_access_token");
            localStorage.removeItem("spotify_refresh_token");
            localStorage.removeItem("spotify_token_expires_at");
            throw new Error("Failed to refresh access token");
        }

        const { access_token, expires_in, refresh_token } = await result.json();
        localStorage.setItem("spotify_access_token", access_token);
        localStorage.setItem("spotify_token_expires_at", (Date.now() + expires_in * 1000).toString());
        // Spotify might issue a new refresh token
        if (refresh_token) {
            localStorage.setItem("spotify_refresh_token", refresh_token);
        }
        return access_token;

    } catch (error) {
        console.error("Error refreshing access token:", error);
        return null;
    }
}

/**
 * Gets a valid access token, refreshing it if necessary.
 */
export async function getAccessToken(): Promise<string | null> {
    const expiresAt = localStorage.getItem("spotify_token_expires_at");
    const accessToken = localStorage.getItem("spotify_access_token");

    if (!accessToken || !expiresAt) {
        return null; // No token available
    }

    // Check if token is expired or will expire in the next minute
    if (Date.now() > parseInt(expiresAt) - 60000) {
        return await refreshAccessToken();
    }
    
    return accessToken;
}

/**
 * Searches for tracks on Spotify.
 */
export async function searchSpotifyTracks(query: string): Promise<SpotifyTrack[]> {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        // This custom error message can be caught to trigger the auth flow
        throw new Error('SPOTIFY_AUTH_REQUIRED');
    }

    const params = new URLSearchParams();
    params.append("q", query);
    params.append("type", "track");
    params.append("limit", "10");

    const response = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 401) { // Unauthorized
            localStorage.removeItem("spotify_access_token"); // Token might be invalid
            throw new Error('SPOTIFY_AUTH_REQUIRED');
        }
        throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tracks.items;
}
