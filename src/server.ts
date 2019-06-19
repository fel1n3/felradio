require('dotenv').config()

import {head,split,drop,truncate,clamp,round,random} from 'lodash'
import {get as cget} from 'colornames'
import { Client, Message, Role, GuildMember, VoiceChannel, RichEmbed} from 'discord.js'

import Vibrant = require('node-vibrant')
import * as ytdl from 'ytdl-core'
import * as ytSearch from 'youtube-search'

import './starboard'

const client = new Client()

const opts: ytSearch.YouTubeSearchOptions = {
	maxResults: 1,
	key: process.env.ytKey
}

declare global {
	interface String{
		isURL(): Boolean;
	}
	interface Array<T>{
		formatQueue(): any;
	}
}

Array.prototype.formatQueue = function(){
    let que = this;
    if(!que.length) return 'Nothing in queue';

    let res = []
    que.forEach((ele,index) => {
        res.push(`**${index+1}.** ${ele.title}`);
    })
    return res.join('\n');
}

String.prototype.isURL = function(){
    let regex = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
    return regex.test(this);
}

function giveColor(msg: Message, role: Role, guser: GuildMember){
	guser.addRole(role)
        .catch(console.error)
    return msg.channel.send(`Color \`\`${role.name}\`\` given to ${msg.author}`);
}

function pruneEmpty(msg: Message){
	let i =  0
	msg.guild.roles.array().forEach((role,index) => {
		if(role.members.array().length === 0) {
			i = i + 1
			role.delete()
				.catch(err => console.error)
		}
	})
	return i
}

abstract class Queue { 
	private q = []

	public async add(url: string, user: string) {
		try{
			let info = await ytdl.getInfo(url)
			let c = await Vibrant.from(`https://i.ytimg.com/vi/${info.video_id}/mqdefault.jpg`).getSwatches()
			let color = !c['Vibrant'] ? 'RANDOM' : c['Vibrant'].getHex()
			info.c = color
			let sdur = Number(info.length_seconds)
			let sprint = this.lengthReadable(sdur)
			//if (sdur > 420) return 'too long'
			this.q.push({
				requester: user,
				video_id: info.video_id,
				title: info.title,
				length: sprint })
			return info
		}catch(err){
			return err
		}
	}

	public get(id ?: number): any[]{
		if(id) return this.q[id]
		return this.q
	}

	protected getNext(): ArrayLike<any> {
		this.q = drop(this.q)
		return this.q
	}

	protected lengthReadable(length : number) : string {
		let date = new Date(null);
    	date.setSeconds(length);

    	return date.toISOString().substr(14,5);

	}
}

abstract class Command {
	public command: string

	constructor(command: string){
		this.command = command
	}

	public on(func: ((arg?:string[]) => void)): void{
		func()
	}
	
}

class Radio extends Queue {
	private client: any
	private connection: any
	private dispatcher: any
	public volume: number
	public voice: string|number;
	private loop: boolean;

	constructor(client: any, token: string, voice: string|number, text: string|number){
		super()

		this.client = client

		this.volume = 1

		this.client.login(token)
		this.voice = voice
		this.joinVoice(voice)
		this.commands(text)
	}

	private joinVoice(voice: string|number): void {
		client.on('ready', () => {
			console.log(`ready d`)
			let vc = client.channels.find('id', voice)
			if(!(vc instanceof VoiceChannel)) return console.error('ID provided for voice channel is not a voice channel')

			client.voiceConnections.array().forEach(c => {
				c.disconnect()
			}); 
			vc.join()
				.then(conn => this.connection = conn)
				.catch(console.error)
		})
	}

	//private autoAssign(): void{
//		client.on('guildMemberAdd', mem => {

//		})
//	}
//
	private commands(text: string|number): void{
		client.on('message', msg => {
			//if(msg.channel.id != text) return
			let arg = split(msg.content, ' ')
			let args = drop(arg)

			switch(head(arg)){
				case '!play':
					let first = false
					if(!head(this.get())) first = true

					if(!head(args).isURL()) {
						return ytSearch(args.join(' '), opts, (err, res) => {
							if(err) return console.error

							this.addMessage([res[0].link], msg, first)
						})
					}
									
					this.addMessage(args, msg, first);
					
					break;
				case '!delete':
				client.voiceConnections.array().forEach(c => {
					c.disconnect()
				}); 
				break;
				case '!skip':
					if(Object.keys(this.get()).length == 0) { return msg.channel.send('There is nothing to skip!')}
					msg.channel.send(`${head(this.get()).title} has been skipped!`)
					//this.skip();
					this.dispatcher.end()
					break;
				case '!queue':
					let q = Array.from(this.get())
					let cur = q.shift()

					if(!cur) return msg.reply('The queue is empty, use ``!play <name/url>`` to add a song to the queue!')

					let thumb =`https://i.ytimg.com/vi/${cur.video_id}/mqdefault.jpg`;

					Vibrant.from(thumb).getSwatches((err,res) => {
						let embed = new RichEmbed()
						.setAuthor('Currently Playing:')
						.setDescription(`[${cur.title}](https://www.youtube.com/watch?v=${cur.video_id})\n*Length: ${cur.length} // Requested By: ${cur.requester}*`)
						.setThumbnail(thumb)
						.setColor(res['Vibrant'].getHex())
						.addField(`Queued [${q.length}]:`, q.formatQueue(), true);
	
						msg.channel.send({embed});
					})
					
			
		
					break;

				case '!volume':
					if(!args.length) return msg.reply(`The volume is ${this.volume*100}%`)

					if(!msg.member.roles.find(r => r.id == "562033778030280706")) return msg.reply('You do not have permission to use this command.')

					let vol = /*clamp(*/Number(head(args))/*,0,100)*/
					if(!this.dispatcher) return msg.reply('Play something first to set the volume!')
					this.volume = vol/100
					this.dispatcher.setVolume(vol/100)

					msg.reply(`Volume set to ${vol}%`)

					break
				case '!loop':
					if(!msg.member.roles.find(r => r.id == "562033778030280706")) return msg.reply('You do not have permission to use this command.')

					this.loop = !this.loop

					msg.channel.send(`Looping toggled to ${this.loop}`)
					break;

				// ------------------------ NON MUSIC STUFF ---------------------------
				case '!lovet':
					let r = round(random(100,true), 2)

					let rec = head(Array.from(msg.mentions.members.values()))
					
					if(!rec){
						if(args.length > 0) return msg.channel.send(`${msg.author} is ${r}% compatible with ${args.join(' ')}`)
						return msg.channel.send(`${msg.author} is ${r}% compatible with ${client.user}`)
					} 
					return msg.channel.send(`${msg.author} is ${r}% compatible with ${rec}`)
					break;
				case '!h':
					let target = head(Array.from(msg.mentions.members.values()));

					const hugs = ["peepokiss", "pepohug"]
					let a = random(1)
					const hug = client.emojis.find(emoji => emoji.name === hugs[a]);

					if(!target) return msg.channel.send(`${msg.author} ${hug}`)
					return msg.channel.send(`${target} ${hug}`)
					break;
				case '!color':
				case '!colour':
					let guild = msg.member.guild

					if(!head(args)) return
					if(head(args).substr(0,1) == '#'){
						msg.member.roles.array().forEach((val,i) => {
							if(val.name.substr(0,1) != '#' && !cget(val.name)) return
							//has a color
							msg.member.removeRole(val)
								.then(() => {
									console.log(val.members.array(), val.members.array().length)
									if(val.members.array().length == 0){
										val.delete('color empty')
											.catch(console.error)
									}
								}).catch(err=>console.log(err))
						})
					
						if(!guild.roles.find('name', head(args))){
							guild.createRole({
								name: head(args),
								color: head(args),
								position: 4
							})
							.then(role => {
								return giveColor(msg, role, msg.member)
							})
						}else{
							return giveColor(msg,guild.roles.find('name', head(args)),msg.member)
						}
						break;
					}

					const colorn = args.join(' ')
					let color = cget(colorn)
					
					if( !color ) return msg.reply(`\`\`${colorn}\`\` is not a valid CSS3 color.`)

					msg.member.roles.array().forEach((val,i) => {
						if(val.name.substr(0,1) != '#' && !cget(val.name)) return
						//has a color
						msg.member.removeRole(val)
							.then(() => {
								if(val.members.array().length == 0){
									val.delete('color empty')
										.catch(console.error)
								}
							}).catch(err=>console.log(err))
					})
					
					if(!guild.roles.find('name', color.name)){
						guild.createRole({
							name: color.name,
							color: color.value,
							position: 4
						})
						.then(role => {
							return giveColor(msg, role, msg.member)
						})
					}else{
						return giveColor(msg, guild.roles.find('name', color.name), msg.member)
					}

					break;
				case '!cremove':
				msg.member.roles.array().forEach((val,i) => {
					if(!cget(val.name)) return
					//has a color
					msg.member.removeRole(val)
						.then(() => {
							if(val.members.array().length > 0) return
							val.delete('color empty')
								.catch(console.error)
						})
					})
					msg.channel.send(`All colors removed from ${msg.author}!`)
					break;
				case '!prole':
					msg.channel.send(`Removed \`\`${pruneEmpty(msg)}\`\` roles.`)
					break;
				case '!github':
					msg.reply(`my author fel is bad coder man don't bully me. https://github.com/fel1n3/felradio`)
					break;
			}
		})
	}

	private stream(info) {
		let stream = ytdl(`https://www.youtube.com/watch?v=${info.video_id}`, { filter: 'audioonly'})
		this.dispatcher = this.connection.playStream(stream, {seek:0, volume: this.volume})
		console.log(`playing ${info.title}`)
		this.dispatcher.on('end', y => {
			if (y === 'Stream is not generating quickly enough.') console.log('Song ended.');
			if(this.loop) {
				if(this.connection.channel.members.array().length > 0) {
					return this.stream(head(this.get()))
				}
				this.loop = false
			}
			let nq = this.getNext()
			console.log(nq.length, nq)
			if (nq.length > 0) {
				setTimeout(() => {this.stream(head(nq))},250)
			}
		})
	}

	private addMessage(args: string[], msg: any, first = false) : void{
		this.add(head(args), msg.author.username)
			.then(info => {
				let embed = new RichEmbed({
					author: {
						name: info.title,
						icon_url: msg.author.avatarURL
					},
					color: parseInt(info.c.replace('#',''), 16),
					description: `[*link*](https://www.youtube.com/watch?v=${info.video_id})\n${truncate(info.description, { length: 80 })}`,
					fields: [{
						name: 'Length',
						value: this.lengthReadable(info.length_seconds)
					}],
					thumbnail: {
						url: `https://i.ytimg.com/vi/${info.video_id}/mqdefault.jpg`
					}
				});
				if(first) this.stream(info)
				msg.channel.send(embed);
			}).catch(console.log);
	}
}

new Radio(client, process.env.TOKEN, process.env.voiceID, process.env.textID)