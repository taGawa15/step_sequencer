import styles from './ShortcutHint.module.css';

interface Props {
  hint: string;
  /** Hide on mobile (≤767px). */
  mobileHidden?: boolean;
}

/**
 * Tiny `[Space]` chip rendered next to button labels. Hidden on phones via
 * CSS so it doesn't crowd a small screen.
 */
export const ShortcutHint = ({ hint, mobileHidden = true }: Props) => (
  <kbd className={`${styles.kbd} ${mobileHidden ? styles.mobileHidden : ''}`}>
    {hint}
  </kbd>
);
