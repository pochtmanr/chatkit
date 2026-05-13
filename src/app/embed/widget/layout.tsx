/**
 * Layout override for the widget iframe.
 *
 * The widget needs a transparent body so when the host iframe is
 * collapsed to FAB-only size, the empty area doesn't show a white
 * box on top of the host page. We force transparency here regardless
 * of any global stylesheet defaults.
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
