import { BookOpen, GraduationCap, Timer } from 'lucide-react';
import type { IconName } from '../../app/feature-catalog.js';

export function FeatureIcon({
  name,
  size = 22,
}: {
  name: IconName;
  size?: number;
}): React.JSX.Element {
  if (name === 'timer') return <Timer aria-hidden="true" size={size} />;
  if (name === 'book-open') return <BookOpen aria-hidden="true" size={size} />;
  if (name === 'graduation-cap') return <GraduationCap aria-hidden="true" size={size} />;
  return <Timer aria-hidden="true" size={size} />;
}
