import {head,split,drop,truncate} from 'lodash'

const dotenv = require('dotenv').config()
const ytdl = require('ytdl-core')
const Discord = require('discord.js')

const client = new Discord.Client()

class Queue { 
	private q = []

	public async add(url: string, user: number) {
		try{
			let info = await ytdl.getInfo(url)
			if (info.length_seconds > 420) return 'too long'
			this.q.push({
				requester: user,
				video_id: info.video_id,
				title: info.title })
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
		return drop(this.q)
	}

	protected lengthReadable(length : number) : string {
		let date = new Date(null);
    	date.setSeconds(length);

    	return date.toISOString().substr(14,5);

	}
}

class Radio extends Queue {
	private client: any
	private connection: any

	constructor(client: any, token: string, voice: string|number, text: string|number){
		super()

		this.client = client

		this.client.login(token)

		this.joinVoice(voice)
		this.commands(text)
	}

	private joinVoice(voice: string|number): void {
		client.on('ready', () => {
			console.log(`ready`)
			let vc = client.channels.find('id', voice)
			vc.join()
				.then(conn => this.connection = conn)
				.catch(console.error)
		})
	}

	private commands(text: string|number): void{
		client.on('message', msg => {
			if(msg.channel.id != text) return
			let arg = split(msg.content, ' ')
			let args = drop(arg)

			switch(head(arg)){
				case '!play':
					if(!args.length) return
					
					let first = false
					if(!head(this.get())) first = true
					this.addMessage(args, msg, first);
					
					break;
				case '!skip':

				case '!queue':
					msg.reply(this.get(0))
					break;
			}
		})
	}

	private stream(info): void {
		let stream = ytdl(`https://www.youtube.com/watch?v=${info.video_id}`, { filter: 'audioonly'})
		let dispatcher = this.connection.playStream(stream, {seek:0, volume: 0.5})

		
	}

	private addMessage(args: string[], msg: any, first = false) : void{
		this.add(head(args), msg.author.id)
			.then(info => {
				let embed = new Discord.RichEmbed({
					author: {
						name: info.title,
						icon_url: msg.author.avatarURL
					},
					color: 0o0,
					description: truncate(info.description, { length: 80 }),
					fields: [{
						name: 'Length',
						value: this.lengthReadable(info.length_seconds)
					}],
					thumbnail: {
						url: `https://img.youtube.com/vi/${info.video_id}/maxresdefault.jpg`
					}
				});
				if(first) this.stream(info)
				console.log(this.get())
				msg.channel.send(embed);
			}).catch(console.log);
	}
}

const radio = new Radio(client, process.env.TOKEN, process.env.voiceID, process.env.textID)

