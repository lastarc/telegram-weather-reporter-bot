import { CurrentWeatherAPIResponse, ForecastWeatherAPIResponse } from "./types";

interface LocaleString {
  [lang: string]: string | Function;
}
interface LocaleStringList {
  [key: string]: LocaleString;
}
interface TemplateData {
  [key: string]: any;
}

const d2c = (s: number | string) => s.toString().replace(".", ",");

const windDirectionEmoji = (dir: string) => {
  dir = dir.toUpperCase();
  if (dir.length === 3) {
    dir = [...new Set(dir.split(""))].join("");
  }
  if (dir[0] === "E" || dir[0] === "W") {
    dir = dir.split("").reverse().join("");
  }
  switch (dir) {
    case "N":
      return "⬆️";
    case "E":
      return "➡️";
    case "S":
      return "⬇️";
    case "W":
      return "⬅️";
    case "NE":
      return "↗️";
    case "SE":
      return "↘️";
    case "SW":
      return "↙️";
    case "NW":
      return "↖️";
  }
};

const strings: LocaleStringList = {
  welcome: {
    en: "Hi! Thank you for using our bot 🙂 \n" + "For help: /help",
    ru:
      "Привет! Благодарим вас за использование нашего бота 🙂 \n" +
      "Для справки: /help",
  },
  accountNotFound: {
    en: "We couldn't find you in our database",
    ru: "Мы не смогли найти вас в нашей базе данных",
  },
  accountCreating: {
    en: "Creating an account...",
    ru: "Создание учетной записи...",
  },
  done: {
    en: "Done",
    ru: "Готово",
  },
  default: {
    en: "Default",
    ru: "По умолчанию",
  },
  noLocationIndicated: {
    en: "No location indicated!",
    ru: "Местоположение не указано!",
  },
  noTimeIndicated: {
    en: "No time indicated!",
    ru: "Время не указано!",
  },
  noLanguageIndicated: {
    en: "No language indicated!",
    ru: "Язык не указан!",
  },
  noLocationIndicatedAndNoDefault: {
    en: "You have neither indicated a location nor have a default location tied to your profile!",
    ru: "Вы не указали местоположение и у вас нет привязанного местоположения к своему профилю!",
  },
  languageNotRecognized: {
    en(languages: Array<string>) {
      return `Language not recognized. Possible options: ${languages.join(
        ", "
      )}.`;
    },
    ru(languages: Array<string>) {
      return `Язык не распознан. Возможные варианты: ${languages.join(", ")}.`;
    },
  },
  noLocationSet: {
    en:
      "You don't have a location set. " +
      'Use "/location CITY" to set a location.',
    ru:
      "У вас нет определенного местоположения. " +
      'Используйте "/location CITY", чтобы указать местоположение.',
  },
  currentLocation: {
    en: 'Your current location is "{location}"',
    ru: 'Ваше текущее местоположение "{location}"',
  },
  newLocation: {
    en: 'Your location has been updated to "{location}"',
    ru: 'Ваше местоположение было изменено на "{location}"',
  },
  noTimeZone: {
    en:
      "Since you don't have a time zone set, Greenwich Mean Time (GMT) will be used. \n" +
      "You can change the time zone by changing your location (/location CITY).",
    ru:
      "Поскольку у вас не установлен часовой пояс, будет использоваться среднее время по Гринвичу (GMT).\n" +
      "Вы можете изменить часовой пояс, изменив свое местоположение (/location CITY).",
  },
  noTimeSet: {
    en: "You don't have a time set. \n" + 'Use "/time hh:mm" to set a time.',
    ru:
      "У вас нет установленного времени. \n" +
      'Используйте "/time hh:mm", чтобы установить время.',
  },
  currentTime: {
    en: 'Your time is set as "{time}"',
    ru: 'Ваше время установлено как "{time}"',
  },
  newTime: {
    en: "Your time has been updated",
    ru: "Ваше время было обновлено",
  },
  languageSet: {
    en: 'Your language is set as "{lang}"',
    ru: 'Ваш язык установлен как "{lang}"',
  },
  help: {
    en:
      "This bot will send you a daily weather forecast of the location at the given time. " +
      "Both location and time must be set by you beforehand. \n\n" +
      "How to use this bot: \n" +
      "1. If you haven't already sent the command \"/start\", now it's the best time for it. \n" +
      '2. Set your location by typing "/location CITY", ' +
      'where instead of "CITY", you should put your city name. \n' +
      '3. Set your time for receiving a daily report by sending "/time TIME", ' +
      'where "TIME" must be in the format "23:59" (24-hour format). ' +
      "Time must be given in your location's timezone; " +
      "that's why setting the location before this step is important. \n" +
      "4. There are no steps left. Rest will be handled by the bot itself 😉 \n\n" +
      "Relax 🍹",
    ru:
      "Этот бот будет отправлять вам ежедневный прогноз погоды про определённое место в определённое время. " +
      "И место, и время должны быть установлены вами заранее. \n\n" +
      "Как использовать этого бота: \n" +
      '1. Если вы еще не отправили команду "/start", сейчас — это самое подходящее время. \n' +
      '2. Установите свое местоположение, отправив "/location CITY", ' +
      'где вместо "CITY" вы должны указать название своего города. \n' +
      '3. Установите время для получения ежедневного отчета, отправив "/time TIME", ' +
      'где "TIME" должно быть в формате "23:59" (24-часовой формат). ' +
      "Время должно быть указано в часовом поясе вашего местоположения; " +
      "вот почему важно установить местоположение перед этим шагом. \n" +
      "4. Шагов больше не осталось. Остальное будет обработано самим ботом 😉 \n\n" +
      "Расслабьтесь 🍹",
  },
  dailyForecast: {
    en(data: ForecastWeatherAPIResponse["forecast"]["forecastday"][0]["day"]) {
      return (
        `🌡 ${data.maxtemp_c} — ${data.mintemp_c}˚C, ` +
        `💨 ${data.maxwind_kph} km/s, ` +
        `☔️ ${data.daily_chance_of_rain}% \n` +
        `Humidity: ${data.avghumidity}% \n`
      );
    },
    ru(data: ForecastWeatherAPIResponse["forecast"]["forecastday"][0]["day"]) {
      return (
        `🌡 ${d2c(data.maxtemp_c)} — ${d2c(data.mintemp_c)}˚C, ` +
        `💨 ${d2c(data.maxwind_kph)} км/ч, ` +
        `☔️ ${d2c(data.daily_chance_of_rain)}% \n` +
        `Влажность: ${d2c(data.avghumidity)}%`
      );
    },
  },
  current: {
    en(data: CurrentWeatherAPIResponse["current"]) {
      return (
        `🌡 ${data.temp_c}˚C (🧑 ${data.feelslike_c}˚C), ` +
        `💧 ${data.precip_mm} mm \n` +
        `💨 ${data.wind_kph} km/s (🚀 ${
          data.gust_kph
        } km/s) ${windDirectionEmoji(data.wind_dir)}, ` +
        `☁️ ${data.cloud}% \n` +
        `Humidity: ${data.humidity}%`
      );
    },
    ru(data: CurrentWeatherAPIResponse["current"]) {
      return (
        `🌡 ${d2c(data.temp_c)}˚C (🧑 ${d2c(data.feelslike_c)}˚C), ` +
        `💧 ${d2c(data.precip_mm)} мм \n` +
        `💨 ${d2c(data.wind_kph)} км/ч (🚀 ${d2c(
          data.gust_kph
        )} км/ч) ${windDirectionEmoji(data.wind_dir)}, ` +
        `☁️ ${d2c(data.cloud)}% \n` +
        `Влажность: ${d2c(data.humidity)}%`
      );
    },
  },
  info: {
    en: "Location: {location} \n" + "Time: {time}",
    ru: "Местоположение: {location} \n" + "Время: {time}",
  },
  encounteredError: {
    en: "Encountered an error, please try again later.",
    ru: "Произошла ошибка, пожалуйста, повторите попытку позже.",
  },
  noProfiles: {
    en: "No profiles found",
    ru: "Профили не найдены",
  },
  profilesList: {
    en: "Your profiles:",
    ru: "Ваши профили:",
  },
  noNameIndicatedForNewProfile: {
    en:
      "Please provide a name for the new profile. \n" +
      "Ex.: /new mynewprofile",
    ru:
      "Пожалуйста, укажите имя для нового профиля. \n" +
      "Например: /new mynewprofile",
  },
  profileNameExistsChooseAnother: {
    en:
      "There is already a profile with the given name. \n" +
      "Choose another name",
    ru: "Уже есть профиль с указанным именем.\n" + "Выберите другое имя",
  },
  newProfile: {
    en: 'A new profile "{name}" has been created',
    ru: 'Создан новый профиль "{name}"',
  },
  noNameIndicatedForProfileRenaming: {
    en:
      "Please provide a new name for the default profile. \n" +
      "Ex.: /rename abettername",
    ru:
      "Пожалуйста, укажите новое имя для профиля по умолчанию. \n" +
      "Пример: /rename abettername",
  },
  renamedProfile: {
    en: 'Default profile has been renamed to "{name}"',
    ru: 'Профиль по умолчанию был переименован в "{name}"',
  },
  changedProfile: {
    en: 'Your default profile has been changed to "{name}"',
    ru: 'Ваш профиль по умолчанию был изменен на "{name}".',
  },
  noProfile: {
    en: "No profile found",
    ru: "Профиль не найден",
  },
  chooseProfileForChange: {
    en: "Choose the profile you want to change to:",
    ru: "Выберите профиль, на который вы хотите сменить:",
  },
  deletedProfile: {
    en: 'The profile "{name}" has been successfully deleted',
    ru: 'Профиль "{name}" был успешно удален',
  },
  chooseProfileForDelete: {
    en: "Choose the profile you want to delete:",
    ru: "Выберите профиль, который вы хотите удалить:",
  },
  cannotDeleteDefaultProfile: {
    en:
      "You cannot delete a default profile. \n" +
      "First switch default profile to another one.",
    ru:
      "Вы не можете удалить профиль по умолчанию. \n" +
      "Сначала переключите профиль по умолчанию на другой.",
  },
};
const fallbackLang = "en";
const deepValue = (obj: any, path: string) => {
  for (let i = 0, p = path.split("."), len = p.length; i < len; i++) {
    obj = obj[p[i]];
  }
  return obj;
};

export function locale(key: any, lang?: string, data?: TemplateData): string {
  if (Object.prototype.hasOwnProperty.call(strings, key)) {
    const item = strings[key][lang || fallbackLang];
    return typeof item === "string"
      ? item.replace(/{((\w*\.*)*)}/g, (match: string, prop: any) => {
          return deepValue(data, prop) || "";
        })
      : item(data);
  }
  return "";
}

export { deepValue, strings };
