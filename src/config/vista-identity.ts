export interface VistaProductIdentity {
  readonly name: string;
  readonly shortName: string;
  readonly vendor: string;
  readonly vendorShort: string;
}

const env = import.meta.env as Record<string, string | undefined>;
const configured = (name: string, fallback: string): string => {
  const value = env[name]?.trim();
  return value || fallback;
};

export const VISTA_PRODUCT_IDENTITY: VistaProductIdentity = Object.freeze({
  name: configured('VITE_PRODUCT_NAME', 'VISTA'),
  shortName: configured('VITE_PRODUCT_SHORT_NAME', 'VISTA'),
  vendor: configured('VITE_PRODUCT_VENDOR', 'MercuryLink Concepts'),
  vendorShort: configured('VITE_PRODUCT_VENDOR_SHORT', 'MercuryLink'),
});
