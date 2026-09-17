export type CustomerAddress = {
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  cityMunicipality: string;
  provinceRegion: string;
  postalCode: string;
  country: "Philippines";
};

export const EMPTY_CUSTOMER_ADDRESS: CustomerAddress = {
  addressLine1: "",
  addressLine2: "",
  barangay: "",
  cityMunicipality: "",
  provinceRegion: "",
  postalCode: "",
  country: "Philippines"
};
