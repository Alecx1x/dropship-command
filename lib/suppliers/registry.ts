import type { SupplierAdapter, SupplierType } from "./adapter";
import { autodsAdapter } from "./autods";
import { manualAdapter } from "./manual";

/** Resolve the adapter for a supplier type; unimplemented types fall back to manual. */
export function getAdapter(type: SupplierType): SupplierAdapter {
  switch (type) {
    case "AUTODS":
      return autodsAdapter;
    case "SPOCKET":
    case "CJ":
    case "MANUAL":
    default:
      return manualAdapter;
  }
}
