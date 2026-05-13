'use client';

import Image from 'next/image';
import type { AniListMedia } from '@/types/anilist';
import { formatDate, normalizeScore, formatScore, formatDuration, formatSeason } from '@/lib/utils/formatters';

interface OverviewTabProps { media: AniListMedia; }

export default function OverviewTab({ media }: OverviewTabProps) {
  const score = normalizeScore(media.averageScore, 'anilist');
  const meanScore = media.meanScore || 0;
  const characters = media.characters?.edges?.slice(0, 8) || [];
  const staff = media.staff?.edges?.slice(0, 6) || [];
  const trailerYoutubeId = media.trailer?.site === 'youtube' ? media.trailer.id : null;

  const infoRows = [
    { label: 'Start', value: formatDate(undefined, media.startDate) },
    { label: 'End', value: formatDate(undefined, media.endDate) },
    { label: 'Season', value: formatSeason(media.season, media.seasonYear) },
    { label: 'Status', value: media.status || '?', isGreen: media.status === 'RELEASING' },
    { label: 'Mean Score', value: String(meanScore) },
    { label: 'Source', value: (media.source || '?').replace(/_/g, ' ') },
    { label: 'Country', value: media.countryOfOrigin || '?' },
    ...(media.hashtag ? [{ label: 'Hashtag', value: media.hashtag }] : []),
    ...(media.title.native ? [{ label: 'Native Title', value: media.title.native }] : []),
    ...(media.synonyms?.length ? [{ label: 'Synonyms', value: media.synonyms.join(', ') }] : []),
  ];

  return (
    <div className="space-y-8 pb-8">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Average Score', value: formatScore(score) },
          { label: 'Type', value: media.format || '?' },
          { label: 'Duration', value: formatDuration(media.duration) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-surface rounded-lg p-4 text-center border border-border">
            <p className="text-xs text-text-secondary mb-1">{label}</p>
            <p className="text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Info table */}
      <div className="rounded-lg overflow-hidden border border-border">
        {infoRows.map(({ label, value, isGreen }, i) => (
          <div key={label} className={`flex px-4 py-2.5 text-sm ${i % 2 === 0 ? 'bg-surface' : 'bg-void'}`}>
            <span className="text-text-secondary w-32 shrink-0">{label}</span>
            <span className={isGreen ? 'text-accent-green' : 'text-white'}>{value}</span>
          </div>
        ))}
      </div>

      {/* Trailer */}
      {trailerYoutubeId && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Trailer</h3>
          <div className="max-w-md aspect-video rounded-lg overflow-hidden bg-surface">
            <iframe src={`https://www.youtube.com/embed/${trailerYoutubeId}`} title="Trailer" allowFullScreen className="w-full h-full" />
          </div>
        </div>
      )}

      {/* Studios */}
      {media.studios?.nodes?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Studios</h3>
          <div className="flex flex-wrap gap-2">
            {media.studios.nodes.map((s) => (
              <span key={s.name} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Genres */}
      {media.genres?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Genres</h3>
          <div className="flex flex-wrap gap-2">
            {media.genres.map((g) => (
              <span key={g} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{g}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {media.tags?.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {media.tags.filter(t => !t.isMediaSpoiler).slice(0, 15).map((t) => (
              <span key={t.name} className="text-sm text-text-secondary bg-surface border border-border px-3 py-1 rounded-full">{t.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Characters */}
      {characters.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Characters</h3>
          <div className="space-y-2">
            {characters.map((edge) => (
              <div key={edge.node.id} className="flex items-center justify-between bg-surface rounded-lg p-3 border border-border">
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0">
                    <Image src={edge.node.image.large} alt={edge.node.name.full} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="text-sm text-white">{edge.node.name.full}</p>
                    <p className="text-xs text-text-secondary">{edge.role}</p>
                  </div>
                </div>
                {edge.voiceActors?.[0] && (
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm text-white">{edge.voiceActors[0].name.full}</p>
                      <p className="text-xs text-text-secondary">{edge.voiceActors[0].languageV2}</p>
                    </div>
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-void shrink-0">
                      <Image src={edge.voiceActors[0].image.large} alt={edge.voiceActors[0].name.full} fill className="object-cover" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff */}
      {staff.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-white mb-3">Staff</h3>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar">
            {staff.map((edge) => (
              <div key={edge.node.id} className="shrink-0 w-[100px] text-center">
                <div className="relative w-20 h-24 rounded-lg overflow-hidden bg-surface mx-auto mb-2">
                  <Image src={edge.node.image.large} alt={edge.node.name.full} fill className="object-cover" />
                </div>
                <p className="text-xs text-text-secondary line-clamp-1">{edge.role}</p>
                <p className="text-xs text-white font-medium line-clamp-1">{edge.node.name.full}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
