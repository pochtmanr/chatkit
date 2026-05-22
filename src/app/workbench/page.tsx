import { ClaimNextLink } from "./_components/ClaimNextLink";

export const dynamic = "force-dynamic";

/** Empty state for /workbench (no conversation selected). The rail on
 *  the left is rendered by the layout. */
export default function WorkbenchHome() {
  return (
    <div className="flex-1 grid place-items-center px-8">
      <div className="max-w-sm text-center space-y-3">
        <p className="text-[15px] text-ink">
          Pick a conversation from the left.
        </p>
        <p className="text-[14px] text-deep/70">
          Or <ClaimNextLink />.
        </p>
      </div>
    </div>
  );
}
