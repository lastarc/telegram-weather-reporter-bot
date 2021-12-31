export interface Profile {
  key: string;
  userKey: string;
  state: "active" | "inactive";
  name: string;
  created_at: number;
  location?: string;
  tz_id?: string;
  time?: number;
  last_update?: number;
}

export interface User {
  key: string;
  id: number;
  username: string;
  name?: string;
  registeredAt: number;
  defaultProfile: Profile.key;
  lang: string;
}

export * from "./WeatherAPI";
