'use client';

import { useState } from 'react';
import Image from 'next/image';

interface VehicleGalleryProps {
  photos: string[];
}

export function VehicleGallery({ photos }: VehicleGalleryProps) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
        <Image
          src={photos[active]}
          alt={`Vehicle photo ${active + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 672px"
          priority={active === 0}
        />
      </div>

      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Vehicle photos">
          {photos.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setActive(idx)}
              role="listitem"
              aria-label={`Photo ${idx + 1}`}
              aria-pressed={active === idx}
              className={`relative h-14 w-20 flex-none overflow-hidden rounded-md border-2 transition ${
                active === idx ? 'border-teal-500' : 'border-transparent'
              }`}
            >
              <Image src={src} alt={`Thumbnail ${idx + 1}`} fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
