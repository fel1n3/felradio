"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const dotenv = require('dotenv').config();
const { getInfo } = require('ytdl-core');
const Discord = require('discord.js');
const client = new Discord.Client();
class Queue {
    constructor() {
        this.q = [];
    }
    add(url, user) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let info = yield getInfo(url);
                if (info.length_seconds > 420)
                    return 'too long';
                this.q.push([user, info.video_id, info.title]);
                return info;
            }
            catch (err) {
                return err;
            }
        });
    }
    get(id) {
        if (id)
            return this.q[id];
        return this.q;
    }
    lengthReadable(length) {
        let date = new Date(null);
        date.setSeconds(length);
        return date.toISOString().substr(14, 5);
    }
}
class Radio extends Queue {
    constructor(client, token, voice, text) {
        super();
        this.client = client;
        this.client.login(token);
        this.joinVoice(voice);
        this.commands(text);
    }
    joinVoice(voice) {
        client.on('ready', () => {
            console.log(`ready`);
            let vc = client.channels.find('id', voice);
            vc.join()
                .then(conn => this.connection = conn)
                .catch(console.error);
        });
    }
    commands(text) {
        client.on('message', msg => {
            if (msg.channel.id != text)
                return;
            let arg = lodash_1.split(msg.content, ' ');
            let args = lodash_1.drop(arg);
            switch (lodash_1.head(arg)) {
                case '!play':
                    if (!args.length)
                        return;
                    this.add(lodash_1.head(args), msg.author.id)
                        .then(info => {
                        let embed = new Discord.RichEmbed({
                            author: {
                                name: info.title,
                                icon_url: msg.author.avatarURL
                            },
                            color: 0o0,
                            description: lodash_1.truncate(info.description, { length: 80 }),
                            fields: [{
                                    name: 'Length',
                                    value: this.lengthReadable(info.length_seconds)
                                }],
                            thumbnail: {
                                url: `https://img.youtube.com/vi/${info.video_id}/maxresdefault.jpg`
                            }
                        });
                        msg.channel.send(embed);
                    }).catch(console.log);
                    break;
                case '!queue':
                    msg.reply(this.get(0));
                    break;
            }
        });
    }
}
const radio = new Radio(client, process.env.TOKEN, process.env.voiceID, process.env.textID);
//# sourceMappingURL=server.js.map