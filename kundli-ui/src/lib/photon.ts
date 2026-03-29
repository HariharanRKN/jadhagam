/** GeoJSON feature from [Photon](https://github.com/komoot/photon) (OpenStreetMap). */

export type PhotonProperties = {
  name?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  postcode?: string;
  type?: string;
};

export type PhotonFeature = {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: PhotonProperties;
};

export function formatPhotonFeatureLabel(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    p.name,
    p.street,
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter((x): x is string => Boolean(x && String(x).trim()));
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const part of parts) {
    const t = part.trim();
    if (!seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      uniq.push(t);
    }
  }
  return uniq.join(", ") || p.name?.trim() || "Selected place";
}

export function featureToLatLng(f: PhotonFeature): { lat: number; lng: number } {
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng };
}
