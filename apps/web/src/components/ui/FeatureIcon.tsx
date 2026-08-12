import {
  BookOpen,
  CalendarDays,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Hourglass,
  Inbox,
  ListChecks,
  Target,
  Timer,
  WalletCards,
} from 'lucide-react';
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
  if (name === 'target') return <Target aria-hidden="true" size={size} />;
  if (name === 'list-checks') return <ListChecks aria-hidden="true" size={size} />;
  if (name === 'calendar-days') return <CalendarDays aria-hidden="true" size={size} />;
  if (name === 'calendar-clock') return <CalendarClock aria-hidden="true" size={size} />;
  if (name === 'inbox') return <Inbox aria-hidden="true" size={size} />;
  if (name === 'credit-card') return <CreditCard aria-hidden="true" size={size} />;
  if (name === 'wallet-cards') return <WalletCards aria-hidden="true" size={size} />;
  if (name === 'hourglass') return <Hourglass aria-hidden="true" size={size} />;
  return <Timer aria-hidden="true" size={size} />;
}
