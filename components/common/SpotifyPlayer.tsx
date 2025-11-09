import React from 'react';

interface SpotifyPlayerProps {
  trackId: string;
}

const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ trackId }) => {
  if (!trackId) return null;

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;

  return (
    <iframe
      style={{ borderRadius: '12px' }}
      src={embedUrl}
      width="100%"
      height="80"
      frameBorder="0"
      allowFullScreen={false}
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
      title={`Spotify Player for track ${trackId}`}
    ></iframe>
  );
};

export default SpotifyPlayer;