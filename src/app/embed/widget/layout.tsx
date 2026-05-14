/**
 * Layout override for the widget iframe.
 *
 * - Transparent body so when the host iframe is collapsed to FAB-only
 *   size, no dark backdrop bleeds through around the FAB.
 * - color-scheme is intentionally NOT set: the panel uses explicit
 *   dark colors (bg-white etc) so theming doesn't depend on the
 *   browser's color-scheme heuristic, which Chrome uses to paint
 *   default backgrounds and can leak a dark rectangle around the FAB.
 */
export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
      `}</style>
      {children}
    </>
  );
}
