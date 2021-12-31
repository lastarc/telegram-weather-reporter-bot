import { CurrentWeatherAPIResponse } from "./types";
import fetch from "node-fetch";

const WEATHER_API_BASE_URL = "https://api.weatherapi.com/v1";

export const weatherAPIRequest = (
  endpoint: string,
  query: Record<string, string>
): Promise<CurrentWeatherAPIResponse> => {
  let queryString = `?key=${process.env.WEATHER_API_TOKEN as string}`;
  for (const key in query) {
    if (query.hasOwnProperty(key)) {
      queryString += `&${key}=${query[key]}`;
    }
  }
  return new Promise((resolve: any, reject) => {
    fetch(`${WEATHER_API_BASE_URL}/${endpoint}.json${queryString}`)
      .then((r) => r.json())
      .then(resolve)
      .catch(reject);
  });
};
