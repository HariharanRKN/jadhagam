export type KundaliBirth = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type KundaliPlace = {
  name: string;
  lat: number;
  lng: number;
  tz: number;
};

/** Birth inputs stored in SQLite (Turso in production, local file in development). The computed chart is not saved; it is rebuilt on load. */
export type SavedKundali = {
  id: string;
  family: boolean;
  name: string | null;
  gender: string | null;
  birth: KundaliBirth;
  place: KundaliPlace;
  createdAt: string;
  updatedAt: string;
};

export type SavedKundaliInput = {
  id?: string;
  family?: boolean;
  name?: string | null;
  gender?: string | null;
  birth: KundaliBirth;
  place: KundaliPlace;
};
