import { Api, Bot, Context, InlineKeyboard, NextFunction } from "grammy";
import { Message, Update, UserFromGetMe } from "@grammyjs/types";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { Deta } from "deta";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { Other as OtherApi } from "grammy/out/core/api";
import { Methods, RawApi } from "grammy/out/core/client";

import { locale } from "./locals";
import responseTime from "./utils/responseTime";
import { fromTime, toTime } from "./utils/convertTime";
import {
  CurrentWeatherAPIResponse,
  ForecastWeatherAPIResponse,
  Profile,
  User,
} from "./types";
import { weatherAPIRequest } from "./weatherAPI";
import { pad } from "./utils/pad";

// from grammy/out/context.d.ts
declare type Other<
  M extends Methods<RawApi>,
  X extends string = never
> = OtherApi<RawApi, M, X>;

class SessionContext extends Context {
  public user!: User;
  public profile!: Profile;

  constructor(update: Update, api: Api, me: UserFromGetMe) {
    super(update, api, me);
  }

  replyBack(
    text: string,
    other?: Other<"sendMessage", "text">
  ): Promise<Message.TextMessage> {
    return this.reply(text, {
      reply_to_message_id: this.msg?.message_id,
      ...other,
    });
  }
}

const deta = Deta(process.env.DETA_PROJECT_KEY as string);
const users = deta.Base("users");
const profiles = deta.Base("profiles");

const bot = new Bot<SessionContext>(process.env.TELEGRAM_BOT_TOKEN as string, {
  ContextConstructor: SessionContext,
});

const encounteredError = async (
  ctx?: SessionContext,
  err?: CurrentWeatherAPIResponse["error"] | string | Error | unknown
) => {
  try {
    console.error("Encountered error!", new Date());
    if (err) {
      console.error(err);
      if (process.env.LOG_CHAT || process.env.OWNER) {
        await bot.api.sendMessage(
          (process.env.LOG_CHAT || process.env.OWNER) as string,
          `\\<\\=\\=\\= ${new Date().toUTCString()} \nError: \n\n${err} \n\nctx: \n\`\`\` \n${JSON.stringify(
            ctx,
            null,
            "\t"
          )} \n\`\`\` \n\\=\\=\\=\\>`,
          {
            parse_mode: "MarkdownV2",
          }
        );
      }
    }
    await ctx?.replyBack(locale("encounteredError", ctx?.user.lang));
  } catch (e) {
    console.error("FATAL ERROR: ");
    console.error(e);
  }
};

const tillNext = (now?: Date) => {
  const next = new Date();
  // TODO: ensure timing is correct (no repetitions & at the beginning of the minute)
  next.setMilliseconds(100);
  next.setSeconds(0);
  next.setMinutes(next.getMinutes() + 1);
  return +next - +(now || new Date());
};

const tick = async () => {
  const now = new Date();
  setTimeout(tick, tillNext(now));

  console.time(`tick ${now.toISOString()}`);

  const receivers = await profiles.fetch({
    time: fromTime(`${now.getUTCHours()}:${now.getUTCMinutes()}`),
    state: "active",
  });
  
  receivers.items = receivers.items.filter((i) => i.location);
  receivers.count = receivers.items.length;

  if (receivers.count) {
    console.log(
      `-> User IDs (${receivers.count}): ${
        [...new Set(receivers.items.map((i) => i.userKey))].join(", ") || "-"
      }`
    );

    const locations = [...new Set(receivers.items.map((i) => i.location))];
    let weatherForecasts = await Promise.all(
      locations.map((i) => weatherAPIRequest("forecast", { q: i as string }))
    );

    receivers.items.forEach((receiver) => {
      users.get(receiver.userKey as string).then((user: any) => {
        const response = weatherForecasts.find(
          (i) => i.location.name == receiver.location
        ) as ForecastWeatherAPIResponse;
        bot.api
          .sendMessage(
            user.key,
            locale("dailyForecast", user.lang, {
              ...response.forecast.forecastday[0].day,
            })
          )
          .then(async () => {
            await profiles.update(
              { last_update: new Date().getTime() },
              receiver.key as string
            );
            console.debug("@" + user.username, "sent!");
          });
      });
    });
  }

  console.timeEnd(`tick ${now.toISOString()}`);
};

bot.api.config.use(apiThrottler());

bot.use(responseTime);

bot.use(async (ctx: SessionContext, next: NextFunction) => {
  try {
    await next();
  } catch (e) {
    await encounteredError(ctx, e);
  }
});

bot.use(async (ctx, next) => {
  let user, profile;
  user = await users.get(ctx.from!.id.toString());
  if (!user) {
    await ctx.reply(locale("accountNotFound"));
    const msg = await ctx.reply(locale("accountCreating"));
    user = await users.put(
      {
        id: ctx.from!.id,
        username: ctx.from!.username,
        name:
          ctx.from!.first_name || ctx.from!.last_name
            ? `${ctx.from!.first_name} ${ctx.from!.last_name}`
            : null,
        registeredAt: Date.now(),
        lang: "en",
      },
      ctx.from!.id.toString()
    );
    if (!user) {
      throw new Error("Failed to create new user account!");
    }
    profile = await profiles.put({
      userKey: user.key,
      name: "myfirstprofile",
      state: "active",
      createdAt: +new Date(),
    });
    if (!profile) {
      throw new Error("Failed to create new user profile!");
    }
    await users.update({ defaultProfile: profile.key }, user.key as string);
    await bot.api.editMessageText(
      msg.chat.id,
      msg.message_id,
      msg.text + " " + locale("done")
    );
  } else {
    profile = await profiles.get(user.defaultProfile!.toString());
  }
  ctx.user = user as unknown as User;
  if (!profile) {
    throw new Error("Failed to find user profile!");
  }
  ctx.profile = profile as unknown as Profile;
  await next();
});

bot.command("start", async (ctx) => {
  await ctx.replyBack(locale("welcome", ctx.user.lang));
});

bot.command("stop", async (ctx) => {
  await users.delete(ctx.from!.id.toString());
});

bot.command("help", async (ctx) => {
  await ctx.replyBack(locale("help", ctx.user.lang));
});

bot.command(["loc", "location"], async (ctx) => {
  if (!ctx.match) {
    if (ctx.profile.location) {
      await ctx.reply(
        locale("currentLocation", ctx.user.lang, {
          location: ctx.profile.location,
        })
      );
    } else {
      await ctx.reply(locale("noLocationSet", ctx.user.lang));
    }
  } else {
    const response = await weatherAPIRequest("current", { q: ctx.match });
    if (!response.error) {
      await profiles.update(
        {
          location: response.location.name,
          tz_id: response.location.tz_id,
        },
        ctx.profile.key
      );
      await ctx.replyBack(
        locale("newLocation", ctx.user.lang, {
          location: response.location.name,
        })
      );
    } else if (response.error.code === 1006) {
      return ctx.replyBack(response.error.message);
    } else {
      throw response.error;
    }
  }
});

bot.command("time", async (ctx) => {
  if (!ctx.match) {
    if (ctx.profile.time !== null && ctx.profile.time !== undefined) {
      if (!ctx.profile.tz_id) {
        await ctx.replyBack(locale("noTimeZone", ctx.user.lang));
      }
      const timeUTC = toTime(ctx.profile.time);
      const time = utcToZonedTime(
        `2020-02-20T${timeUTC}Z`,
        ctx.profile.tz_id || "GMT"
      );
      await ctx.replyBack(
        locale("currentTime", ctx.user.lang, {
          time: `${pad(time.getHours())}:${pad(time.getMinutes())}`,
        })
      );
    } else {
      await ctx.replyBack(locale("noTimeSet", ctx.user.lang));
    }
  } else {
    if (!ctx.profile.tz_id) {
      await ctx.replyBack(locale("noTimeZone", ctx.user.lang));
    }
    const time = zonedTimeToUtc(
      `2020-02-20T${ctx.match}`,
      ctx.profile.tz_id || "GMT"
    );
    await profiles.update(
      {
        time: fromTime(`${time.getUTCHours()}:${time.getUTCMinutes()}`),
      },
      ctx.profile.key
    );
    await ctx.replyBack(
      locale("newTime", ctx.user.lang, {
        time: `${time.getUTCHours()}:${time.getUTCMinutes()}`,
      })
    );
  }
});

bot.command(["lang", "language"], async (ctx) => {
  if (!ctx.match) {
    return ctx.replyBack(locale("noLanguageIndicated", ctx.user.lang));
  }
  const languages = ["en", "ru"];
  if (languages.filter((str) => str === ctx.match).length === 0) {
    return ctx.replyBack(
      locale("languageNotRecognized", ctx.user.lang, languages)
    );
  }
  await users.update({ lang: ctx.match }, ctx.user.key);
  return ctx.replyBack(
    locale("languageSet", ctx.user.lang, { lang: ctx.match })
  );
});

bot.command(["now", "current"], async (ctx) => {
  let location: string | null;
  const match = (ctx.match as string).trim();
  if (match) {
    location = (ctx.match as string).trim();
  } else {
    location = (ctx.profile.location as string) || null;
  }
  if (!location) {
    return ctx.replyBack(
      locale("noLocationIndicatedAndNoDefault", ctx.user.lang)
    );
  }
  const response = await weatherAPIRequest("current", { q: location });
  if (!response.error) {
    return ctx.replyBack(locale("current", ctx.user.lang, response.current));
  } else if (response.error.code === 1006) {
    return ctx.replyBack(response.error.message);
  } else {
    throw response.error;
  }
});

bot.command("info", async (ctx) => {
  if (!ctx.profile.tz_id) {
    await ctx.replyBack(locale("noTimeZone", ctx.user.lang));
  }
  let time: Date;
  if (ctx.profile.time) {
    const timeUTC = toTime(ctx.profile.time);
    time = utcToZonedTime(`2020-02-20T${timeUTC}Z`, ctx.profile.tz_id || "GMT");
  }
  return ctx.replyBack(
    locale("info", ctx.user.lang, {
      location: ctx.profile.location || "-",
      time: ctx.profile.time
        ? `${pad(time!.getHours())}:${pad(time!.getMinutes())}`
        : "-",
    })
  );
});

bot.command("list", async (ctx) => {
  const profilesList = await profiles.fetch({ userKey: ctx.user.key });
  if (profilesList.count) {
    let keyboard = new InlineKeyboard();
    for (const profile of profilesList.items) {
      keyboard
        .text(
          profile.name +
            (ctx.user.defaultProfile == profile.key ? " (default)" : "")
        )
        .row();
    }
    return ctx.replyBack(locale("profilesList", ctx.user.lang), {
      reply_markup: keyboard,
    });
  }
  return ctx.replyBack(locale("noProfiles", ctx.user.lang));
});

bot.command("new", async (ctx) => {
  if (!ctx.match) {
    return ctx.replyBack(locale("noNameIndicatedForNewProfile", ctx.user.lang));
  }
  const existingProfiles = await profiles.fetch({
    userKey: ctx.user.key,
    name: ctx.match,
  });
  if (existingProfiles.count) {
    return ctx.replyBack(
      locale("profileNameExistsChooseAnother", ctx.user.lang)
    );
  }
  const profile = await profiles.put({
    userKey: ctx.user.key,
    name: ctx.match,
    state: "active",
    createdAt: +new Date(),
  });
  if (!profile) {
    throw new Error("Failed to create new user profile!");
  }
  await users.update({ defaultProfile: profile.key }, ctx.user.key as string);
  return ctx.replyBack(
    locale("newProfile", ctx.user.lang, { name: ctx.match })
  );
});

bot.command("rename", async (ctx) => {
  if (!ctx.match) {
    return ctx.replyBack(
      locale("noNameIndicatedForProfileRenaming", ctx.user.lang)
    );
  }
  // TODO: check whether a profile with same name exists (names should be unique)
  await profiles.update(
    {
      name: ctx.match,
    },
    ctx.profile.key
  );
  return ctx.replyBack(
    locale("renamedProfile", ctx.user.lang, { name: ctx.match })
  );
});

bot.command("change", async (ctx) => {
  if (ctx.match) {
    const profile = await profiles.fetch({
      userKey: ctx.user.key,
      name: ctx.match,
    });
    if (profile.items && profile.items[0]) {
      await users.update(
        { defaultProfile: profile.items[0].key },
        ctx.user.key
      );
      return ctx.replyBack(
        locale("changedProfile", ctx.user.lang, { name: profile.items[0].name })
      );
    }
    return ctx.replyBack(locale("noProfile", ctx.user.lang));
  }
  const profilesList = await profiles.fetch({ userKey: ctx.user.key });
  if (profilesList.count) {
    let keyboard = new InlineKeyboard();
    for (const profile of profilesList.items) {
      keyboard
        .text(
          profile.name +
            (ctx.user.defaultProfile == profile.key
              ? ` (${locale("default", ctx.user.lang)})`
              : ""),
          `changeProfile->${profile.name}`
        )
        .row();
    }
    return ctx.replyBack(locale("chooseProfileForChange", ctx.user.lang), {
      reply_markup: keyboard,
    });
  }
  return ctx.replyBack(locale("noProfiles", ctx.user.lang));
});

bot.callbackQuery(new RegExp(/changeProfile->/), async (ctx) => {
  const name = (ctx.match as RegExpMatchArray).input!.replace(
    "changeProfile->",
    ""
  );
  const profile = await profiles.fetch({ userKey: ctx.user.key, name });
  if (profile.items && profile.items[0]) {
    await users.update({ defaultProfile: profile.items[0].key }, ctx.user.key);
    await ctx.answerCallbackQuery(locale("done", ctx.user.lang));
    return ctx.replyBack(
      locale("changedProfile", ctx.user.lang, { name: profile.items[0].name })
    );
  }
  return ctx.answerCallbackQuery(locale("noProfile", ctx.user.lang));
});

bot.command("delete", async (ctx) => {
  if (ctx.match) {
    if (ctx.match == ctx.profile.name) {
      return ctx.answerCallbackQuery(
        "You cannot delete a default profile. \nFirst switch default profile to another one."
      );
    }
    const profile = await profiles.fetch({
      userKey: ctx.user.key,
      name: ctx.match,
    });
    if (profile.items && profile.items[0]) {
      await profiles.delete(profile.items[0].key as string);
      return ctx.replyBack(
        locale("deletedProfile", ctx.user.lang, { name: profile.items[0].name })
      );
    }
    return ctx.replyBack(locale("noProfile", ctx.user.lang));
  }
  const profilesList = await profiles.fetch({ userKey: ctx.user.key });
  if (profilesList.count) {
    let keyboard = new InlineKeyboard();
    for (const profile of profilesList.items) {
      keyboard
        .text(
          profile.name +
            (ctx.user.defaultProfile == profile.key
              ? ` (${locale("default", ctx.user.lang)})`
              : ""),
          `deleteProfile->${profile.name}`
        )
        .row();
    }
    return ctx.replyBack(locale("chooseProfileForDelete", ctx.user.lang), {
      reply_markup: keyboard,
    });
  }
  return ctx.replyBack(locale("noProfiles", ctx.user.lang));
});

bot.callbackQuery(new RegExp(/deleteProfile->/), async (ctx) => {
  const name = (ctx.match as RegExpMatchArray).input!.replace(
    "deleteProfile->",
    ""
  );
  if (name == ctx.profile.name) {
    return ctx.answerCallbackQuery(
      locale("cannotDeleteDefaultProfile", ctx.user.lang)
    );
  }
  const profile = await profiles.fetch({ userKey: ctx.user.key, name });
  if (profile.items && profile.items[0]) {
    await profiles.delete(profile.items[0].key as string);
    await ctx.answerCallbackQuery(locale("done", ctx.user.lang));
    return ctx.replyBack(
      locale("deletedProfile", ctx.user.lang, { name: profile.items[0].name })
    );
  }
  return ctx.answerCallbackQuery(locale("noProfile", ctx.user.lang));
});

bot.api.setMyCommands([
  { command: "start", description: "Register and show the welcome message" },
  { command: "help", description: "Show the instructions for usage" },
  { command: "location", description: "Show or set the location" },
  { command: "time", description: "Show or set the time" },
  { command: "current", description: "Show current weather" },
  { command: "info", description: "Show current location and time" },
  { command: "list", description: "Show all profiles" },
  { command: "new", description: "Create new profile" },
  { command: "rename", description: "Rename default profile" },
  { command: "change", description: "Change default profile" },
  { command: "delete", description: "Delete default profile" },
]);

bot.catch((err) => encounteredError(undefined, err));

bot.start().then(() => console.log("Bot has been launched"));
tick().catch((err) => encounteredError(undefined, err));
