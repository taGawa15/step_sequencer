import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

interface Props {
  /** Top fixed-height transport bar (always visible). */
  transport: ReactNode;
  /** Left column on desktop only. Hidden on tablet/mobile. */
  leftCol?: ReactNode;
  /** Center column. Always rendered. */
  centerCol: ReactNode;
  /** Right column on desktop+tablet. Hidden on mobile (FX tab takes its place). */
  rightCol?: ReactNode;
  /** Bottom panel: edit panel on desktop/tablet, tabbed bottom sheet on mobile. */
  bottom: ReactNode;
}

export const AppShell = ({
  transport,
  leftCol,
  centerCol,
  rightCol,
  bottom,
}: Props) => (
  <div className={styles.shell}>
    <header className={styles.transport}>{transport}</header>
    {leftCol && <aside className={styles.leftCol}>{leftCol}</aside>}
    <main className={styles.center}>{centerCol}</main>
    {rightCol && <aside className={styles.rightCol}>{rightCol}</aside>}
    <section className={styles.bottom}>{bottom}</section>
  </div>
);
