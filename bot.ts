import 'https://deno.land/x/dotenv/load.ts';
import { Database, SQLite3Connector, Model, DataTypes } from 'https://deno.land/x/denodb/mod.ts';
import { Bot, Context, NextFunction } from 'https://deno.land/x/grammy/mod.ts';
import { timezone } from 'https://denopkg.com/burhanahmeed/time.ts@v2.0.1/lib/new-api.ts';
import { locale } from './locals.ts';


const bot = new Bot(Deno.env.get('TELEGRAM_BOT_TOKEN') as string);

const connector = new SQLite3Connector({
    filepath: 'data.sqlite',
});
const db = new Database(connector);

class User extends Model {
    static table = 'Users';
    static timestamps = true;
    static fields = {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM,
            values: [
                'registered',
                'active',
                'inactive',
                'stopped',
            ]
        },
        lang: {
            type: DataTypes.STRING,
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        time: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        last_message: {
            type: DataTypes.DATETIME,
            allowNull: true,
        },
    };
    static defaults = {
        status: 'registered',
        lang: 'en',
    }

    id!: number;
    username!: string;
    status!: string;
    location!: string;
    time!: number;
    last_message!: number;
}
interface CurrentWeatherAPIResponse {
    "location": {
        "name": string,
        "region": string,
        "country": string,
        "lat": number,
        "lon": number,
        "tz_id": string,
        "localtime_epoch": number,
        "localtime": string
    },
    "current": {
        "last_updated_epoch": number,
        "last_updated": string,
        "temp_c": number,
        "temp_f": number,
        "is_day": number,
        "condition": {
            "text": string,
            "icon": string,
            "code": number
        },
        "wind_mph": number,
        "wind_kph": number,
        "wind_degree": number,
        "wind_dir": string,
        "pressure_mb": number,
        "pressure_in": number,
        "precip_mm": number,
        "precip_in": number,
        "humidity": number,
        "cloud": number,
        "feelslike_c": number,
        "feelslike_f": number,
        "vis_km": number,
        "vis_miles": number,
        "uv": number,
        "gust_mph": number,
        "gust_kph": number,
    },
    "error": {
        "code": number,
        "message": string,
    },
}
interface ForecastWeatherAPIResponse extends CurrentWeatherAPIResponse{
    "forecast": {
        "forecastday": [
            {
                "date": string,
                "date_epoch": number,
                "day": {
                    "maxtemp_c": number,
                    "maxtemp_f": number,
                    "mintemp_c": number,
                    "mintemp_f": number,
                    "avgtemp_c": number,
                    "avgtemp_f": number,
                    "maxwind_mph": number,
                    "maxwind_kph": number,
                    "totalprecip_mm": number,
                    "totalprecip_in": number,
                    "avgvis_km": number,
                    "avgvis_miles": number,
                    "avghumidity": number,
                    "daily_will_it_rain": number,
                    "daily_chance_of_rain": number | string,
                    "daily_will_it_snow": number,
                    "daily_chance_of_snow": number | string,
                    "condition": Object,
                    "uv": number
                },
                "astro": Object,
                "hour": Array<Object>,
            },
        ],
    },
}
interface TimeZone {
    id: string,
    country_code: string,
    offset: string,
    dst: string,
    text: string
}

db.link([User]);
db.sync({
    // drop: true
});

const WEATHER_API_BASE_URL = 'https://api.weatherapi.com/v1';

const weatherAPIRequest = (endpoint: string, query: object): Promise<CurrentWeatherAPIResponse> => {
    let queryString = `?key=${Deno.env.get('WEATHER_API_TOKEN')}`;
    for (const key in query) {
        if (query.hasOwnProperty(key))
            { // @ts-ignore
                queryString += `&${key}=${query[key]}`;
            }
    }
    return new Promise((resolve, reject) => {
        fetch(`${WEATHER_API_BASE_URL}/${endpoint}.json${queryString}`)
            .then(r => r.json()).then(resolve).catch(reject);
    });
};

const reply = (ctx: Context, msg: string | any) => {
    return ctx.reply(msg, { reply_to_message_id: ctx?.msg?.message_id });
};

const normalizeTime = (i: number) => (i.toString().length === 1) ? '0' + i.toString(): i.toString();

const encounteredError = (ctx: Context, err?: CurrentWeatherAPIResponse['error'] | string | Error ) => {
    console.error('Encountered error!', new Date());
    if (err) console.error(err);
    reply(ctx, 'Encountered an error, please try again later.');
};

const checkTime = async () => {
    try {
        console.time('checkTime');
        const date = new Date();
        const time = date.getUTCHours() * 60 + date.getUTCMinutes();

        const users = await User.where('time', time).where('status', 'active').get() as User[];

        for (let i = 0; i < users.length; i++) {
            console.debug(time, users[i], new Date().valueOf() - new Date(users[i].last_message).valueOf());
            if (users[i].last_message === null ||
                (new Date().valueOf() - new Date(users[i].last_message).valueOf()) >= 60 * 1000) {
                const id = users[i].id;
                const response = await weatherAPIRequest('forecast', { q: users[i].location }) as ForecastWeatherAPIResponse;
                console.dir(response.forecast.forecastday[0].day);

                bot.api.sendMessage(id, locale('dailyForecast', users[i].lang, {
                    ...response.forecast.forecastday[0].day
                })).then(async () => {
                    await User.where('id', id).update('last_message', new Date());
                    console.debug(users[i].id, 'sent!');
                }).catch(e => {
                    console.error('Error while sending message in «checkTime» function:')
                    console.error(e);
                });
            }
        }
        console.timeEnd('checkTime');
    } catch (error) {
        console.error('Error in «checkTime» function:')
        console.error(error);
    }
};

const responseTime = async (ctx: Context, next: NextFunction): Promise<void> => {
    const before = Date.now();
    await next();
    const after = Date.now();
    console.log(`Response time: ${after - before} ms`);
}

bot.use(responseTime);

bot.use(async (ctx: Context, next: NextFunction) => {
    try {
        await next();
    } catch (e) {
        encounteredError(ctx, e);
    }
});

bot.command('start', async ctx => {
    const id = ctx.message?.from?.id as number;
    const user = await User.find(id);
    if (!user) {
        const user = new User();
        user.id = id;
        user.status = 'registered';
        if (ctx.message?.from?.username)
            user.username = ctx.message?.from?.username;
        await user.save();
        return reply(ctx, locale('welcome', user.lang));
    } else if (user.status !== 'active' && user.status !== 'registered') {
        user.status = 'active';
        await user.update();
        return reply(ctx, locale('welcomeBack', user.lang));
    } else {
        return reply(ctx, locale('alreadyUser', user.lang));
    }
});

bot.command('stop', async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    if (user) {
        user.status = 'stopped';
        await user.update();
    }
});

bot.command(['help'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    reply(ctx, locale('help', user?.lang));
});

bot.command(['loc', 'location'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    if (!user) {
        return reply(ctx, locale('notFoundInDatabase', null));
    }
    const match = (ctx.match as string).trim();
    if (!match) {
        return reply(ctx, locale('noLocationIndicated', user.lang));
    }
    const response = await weatherAPIRequest('current', { q: match });
    if (!response.error) {
        user.location = response.location.name;
        await user.update();
        return reply(ctx, locale('locationSet', user.lang, { user, response }));
    } else if (response.error.code === 1006) {
        return reply(ctx, response.error.message);
    } else {
        return encounteredError(ctx, response.error);
    }
});

bot.command(['time'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    if (!user) {
        return reply(ctx, locale('notFoundInDatabase', null));
    }
    const match: string = (ctx.match as string).trim();
    if (!match) {
        return reply(ctx, locale('noTimeIndicated', user?.lang));
    }
    if (!user.location) {
        return reply(ctx, locale('noLocationSetByUser', user?.lang));
    }
    const response = await weatherAPIRequest('current', { q: user.location });
    if (!response.error) {
        const tz_id = response.location.tz_id;
        const offset: string | undefined = timezone.find((i: TimeZone) => i.id.toLowerCase() === tz_id.toLowerCase())?.offset;
        if (!offset) {
            return encounteredError(ctx, locale('unidentifiedOffset', user?.lang));
        }
        const time: Date = (match === 'now') ? new Date() : new Date(`2020-02-20 ${match}Z${offset}`);
        const minutes = time.getUTCHours() * 60 + time.getUTCMinutes();
        console.log({match, offset, minutes});
        user.time = minutes;
        user.status = 'active';
        user.last_message = null;
        await user.update();
        return reply(ctx, locale('timeSet', user?.lang, {
            time: match,
            offset,
            hours: normalizeTime(time.getUTCHours()),
            minutes: normalizeTime(time.getUTCMinutes()),
        }));
    } else {
        return encounteredError(ctx, response.error);
    }
});

bot.command(['lang', 'language'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    if (!user) {
        return reply(ctx, locale('notFoundInDatabase', null));
    }
    const match: string = (ctx.match as string).trim();
    if (!match) {
        return reply(ctx, locale('noLanguageIndicated', user?.lang));
    }
    const languages = ['en', 'ru'];
    if (languages.filter(str => str === match).length === 0) {
        return reply(ctx, locale('languageNotRecognized', user?.lang, languages));
    }
    user.lang = match;
    await user.update();
    return reply(ctx, locale('languageSet', user?.lang, { lang: match }));
});

bot.command(['now', 'current'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    let location!: string | null;
    const match = (ctx.match as string).trim();
    if (match) {
        location = (ctx.match as string).trim();
    } else {
        location = user?.location as string || null;
    }
    console.log(location);
    if (!location) {
        return reply(ctx, locale('noLocationIndicatedAndNoDefault', user?.lang));
    }
    const response = await weatherAPIRequest('current', { q: location });
    if (!response.error) {
        return reply(ctx, locale('current', user?.lang, response.current));
    } else if (response.error.code === 1006) {
        return reply(ctx, response.error.message);
    } else {
        return encounteredError(ctx, response.error);
    }
});

bot.command(['info'], async ctx => {
    const user = await User.find(ctx.message?.from?.id as number);
    if (!user) {
        return reply(ctx, locale('notFoundInDatabase', null));
    }
    let hours = 0, minutes = 0;
    if (user.time) {
        hours = Math.floor(user.time as number / 60);
        minutes = user.time as number - hours * 60;
    }
    return reply(ctx, locale('info', user?.lang, {
        location: user.location || '-',
        time: (user.time) ? `${normalizeTime(hours)}:${normalizeTime(minutes)}` : '-',
    }));
});

bot.start().then(checkTime);
setInterval(checkTime, 15000);

export type {CurrentWeatherAPIResponse, ForecastWeatherAPIResponse};
