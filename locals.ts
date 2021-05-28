import { CurrentWeatherAPIResponse, ForecastWeatherAPIResponse } from './bot.ts';

interface LocaleString {
    [lang: string]: string | Function;
}
interface LocaleStringList {
    [key: string]: LocaleString;
}
interface TemplateData {
    [key: string]: any;
}

const d2c = (s: number | string) => s.toString().replace('.', ',');

const windDirectionEmoji = (dir: string) => {
    dir = dir.toUpperCase();
    if (dir.length === 3) {
        dir = [...new Set(dir.split(''))].join('');
    }
    if (dir[0] === 'E' || dir[0] === 'W') {
        dir = dir.split('').reverse().join('');
    }
    switch (dir) {
        case 'N':
            return '⬆️'
        case 'E':
            return '➡️'
        case 'S':
            return '⬇️'
        case 'W':
            return '⬅️'
        case 'NE':
            return '↗️'
        case 'SE':
            return '↘️'
        case 'SW':
            return '↙️'
        case 'NW':
            return '↖️'
    }
};

const strings: LocaleStringList = {
    welcome: {
        en: 'Hi! Thank you for using our bot 🙂 \n' +
            'For help: /help',
        ru: 'Привет! Благодарим вас за использование нашего бота 🙂 \n' +
            'Для справки: /help',
    },
    welcomeBack: {
        en: 'Welcome back! \n' +
            'For help: /help',
        ru: 'С возвращением!\n' +
            'Для справки: /help',
    },
    alreadyUser: {
        en: 'You are already a user! \n' +
            'For help: /help',
        ru: 'Вы уже являетесь пользователем!\n' +
            'Для справки: /help',
    },
    notFoundInDatabase: {
        en: 'We couldn\'t find you in our database! Try "/start"ing over.',
        ru: 'Мы не смогли найти вас в нашей базе данных! Попробуйте начать сначала: "/start"',
    },
    noLocationIndicated: {
        en: 'No location indicated!',
        ru: 'Местоположение не указано!',
    },
    noTimeIndicated: {
        en: 'No time indicated!',
        ru: 'Время не указано!',
    },
    noLanguageIndicated: {
        en: 'No language indicated!',
        ru: 'Язык не указан!',
    },
    noLocationSetByUser: {
        en: 'You haven\'t set your location yet. \n' +
            'For help: /help',
        ru: 'Вы еще не определили свое местоположение.\n' +
            'Для справки: /help',
    },
    noLocationIndicatedAndNoDefault: {
        en: 'You have neither indicated a location nor have a default location tied to your profile!',
        ru: 'Вы не указали местоположение и у вас нет привязанного местоположения к своему профилю!',
    },
    unidentifiedOffset: {
        en: 'Unidentified offset',
        ru: 'Неопознанное смещение',
    },
    languageNotRecognized: {
        en (languages: Array<string>) {
            return `Language not recognized. Possible options: ${languages.join(', ')}.`
        },
        ru (languages: Array<string>) {
            return `Язык не распознан. Возможные варианты: ${languages.join(', ')}.`
        },
    },
    locationSet: {
        en: 'Your location is set as "{user.location}", ' +
            'which is recognized as "{response.location.name}, ' +
            '{response.location.region}, {response.location.country}".',
        ru: 'Ваше местоположение установлено как "{user.location}", ' +
            'которое распознается как "{response.location.name}, ' +
            '{response.location.region}, {response.location.country}".',
    },
    timeSet: {
        en: 'Your time is set as "{time} GMT{offset}", ' +
            'which is also "{hours}:{minutes} GMT".',
        ru: 'Ваше время установлено как "{time} GMT{offset}", ' +
            'что также обозначается как "{hours}:{minutes} GMT".',
    },
    languageSet: {
        en: 'Your language is set as "{lang}"',
        ru: 'Ваш язык установлен как "{lang}"',
    },
    help: {
        en: 'This bot will send you a daily weather forecast of the location at the given time. ' +
            'Both location and time must be set by you beforehand. \n\n' +
            'How to use this bot: \n' +
            '1. If you haven\'t already sent the command "/start", now it\'s the best time for it. \n' +
            '2. Set your location by typing "/location CITY", ' +
            'where instead of "CITY", you should put your city name. \n' +
            '3. Set your time for receiving a daily report by sending "/time TIME", ' +
            'where "TIME" must be in the format "23:59" (24-hour format). ' +
            'Time must be given in your location\'s timezone; ' +
            'that\'s why setting the location before this step is important. \n' +
            '4. There are no steps left. Rest will be handled by the bot itself 😉 \n\n' +
            'Relax 🍹',
        ru: 'Этот бот будет отправлять вам ежедневный прогноз погоды про определённое место в определённое время. ' +
            'И место, и время должны быть установлены вами заранее. \n\n' +
            'Как использовать этого бота: \n' +
            '1. Если вы еще не отправили команду "/start", сейчас — это самое подходящее время. \n' +
            '2. Установите свое местоположение, отправив "/location CITY", ' +
            'где вместо "CITY" вы должны указать название своего города. \n' +
            '3. Установите время для получения ежедневного отчета, отправив "/time TIME", ' +
            'где "TIME" должно быть в формате "23:59" (24-часовой формат). ' +
            'Время должно быть указано в часовом поясе вашего местоположения; ' +
            'вот почему важно установить местоположение перед этим шагом. \n' +
            '4. Шагов больше не осталось. Остальное будет обработано самим ботом 😉 \n\n' +
            'Расслабьтесь 🍹',
    },
    dailyForecast: {
        en (data: ForecastWeatherAPIResponse['forecast']['forecastday'][0]['day']) {
            return `🌡 ${data.maxtemp_c}-${data.mintemp_c}˚C, ` +
                `💨 ${data.maxwind_kph} km/s, ` +
                `☔️ ${data.daily_chance_of_rain}% \n` +
                `Humidity: ${data.avghumidity}% \n`;
        },
        ru (data: ForecastWeatherAPIResponse['forecast']['forecastday'][0]['day']) {
            return `🌡 ${d2c(data.maxtemp_c)}-${d2c(data.mintemp_c)}˚C, ` +
                `💨 ${d2c(data.maxwind_kph)} км/ч, ` +
                `☔️ ${d2c(data.daily_chance_of_rain)}% \n` +
                `Влажность: ${d2c(data.avghumidity)}%`;
        },
    },
    current: {
        en (data: CurrentWeatherAPIResponse['current']) {
            return `🌡 ${data.temp_c}˚C (🧑 ${data.feelslike_c}˚C), ` +
                `💧 ${data.precip_mm} mm \n` +
                `💨 ${data.wind_kph} km/s (🚀 ${data.gust_kph} km/s) ${windDirectionEmoji(data.wind_dir)}, ` +
                `☁️ ${data.cloud}% \n` +
                `Humidity: ${data.humidity}%`;
        },
        ru (data: CurrentWeatherAPIResponse['current']) {
            return `🌡 ${d2c(data.temp_c)}˚C (🧑 ${d2c(data.feelslike_c)}˚C), ` +
                `💧 ${d2c(data.precip_mm)} мм \n` +
                `💨 ${d2c(data.wind_kph)} км/ч (🚀 ${d2c(data.gust_kph)} км/ч) ${windDirectionEmoji(data.wind_dir)}, ` +
                `☁️ ${d2c(data.cloud)}% \n` +
                `Влажность: ${d2c(data.humidity)}%`;
        },
    },
    info: {
        en: 'Location: {location} \n' +
            'Time: {time}',
        ru: 'Местоположение: {location} \n' +
            'Время: {time}',
    },
}
const fallbackLang = 'en';
const deepValue = (obj: any, path: string) => {
    for (let i = 0, p = path.split('.'), len = p.length; i <  len; i++){
        obj = obj[p[i]];
    }
    return obj;
};

export function locale (key: any, lang: string | null | any, data?: TemplateData): string {
    if (strings.hasOwnProperty(key)) {
        const item = strings[key][lang || fallbackLang];
        return (typeof item === "string") ? item.replace(
            /{((\w*\.*)*)}/g,
            ( match: string, prop: any ) => {
                return deepValue(data, prop) || '';
            }
        ) : item(data);
    }
    return '';
}

export {deepValue, strings}