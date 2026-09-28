import type { AssetType } from "@taiwan-fin-hub/core";

/**
 * The positions page shows the latest snapshot per connector and asset type,
 * so an asset type missing from the newest IBKR statement (for example after
 * every option expired) would keep showing its last snapshot. Older rows of
 * those types are removed; types still held keep their history.
 */
export function ibkrStalePositionsStatement(
  db: D1Database,
  asOfDate: string,
  heldAssetTypes: AssetType[],
) {
  const held = [...new Set(heldAssetTypes)];
  const heldFilter =
    held.length > 0
      ? ` AND asset_type NOT IN (${held.map(() => "?").join(", ")})`
      : "";
  return db
    .prepare(
      `DELETE FROM investment_positions
       WHERE connector_id = 'ibkr' AND as_of_date < ?${heldFilter}`,
    )
    .bind(asOfDate, ...held);
}
