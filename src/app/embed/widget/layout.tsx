/**
 * Layout override for the widget iframe.
 *
 * - Transparent body so when the host iframe is collapsed to FAB-only
 *   size, no white box bleeds through.
 * - Forces dark mode (Tailwind dark: variants always apply) so the
 *   widget matches a typical admin dashboard look regardless of the
 *   user's OS preference.
 */
export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark">
      <style>{`
        html, body {
          background: transparent !important;
          margin: 0;
          padding: 0;
          color-scheme: dark;
        }
      `}</style>
      {children}
    </div>
  );
}
