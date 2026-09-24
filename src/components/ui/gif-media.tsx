/* eslint-disable @next/next/no-img-element */

type Props = {
  url: string;
  name: string;
  mimeType?: string;
  className?: string;
};

// MP4 "GIFs" are rendered as silent looping video, the same way Telegram and Giphy do it.
export function GifMedia({ url, name, mimeType, className }: Props) {
  if (mimeType === "video/mp4") {
    return (
      <video
        src={url}
        aria-label={name}
        className={className}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return <img src={url} alt={name} className={className} loading="lazy" />;
}
