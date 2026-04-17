export function ConnectSpotify() {
  return (
    <div className="p-8 text-center">
      <p className="mb-4 text-neutral-300">Connect your Spotify account to get started.</p>
      <a href="/api/auth/login" className="inline-block px-4 py-2 rounded bg-green-600 hover:bg-green-500 font-semibold">
        Connect Spotify
      </a>
    </div>
  );
}
