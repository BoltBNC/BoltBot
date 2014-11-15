#!/usr/bin/env node

var irc = require('irc');
var S = require('string');
var sync = require('synchronize');

var admins = ["fedora/cydrobolt"];

var bot = new irc.Client('amethyst.boltbnc.me', 'BoltBNCBot', {
	port: 7697,
    debug: true,
	secure: true,
    channels: ['#BoltBNC', '#BoltBNC-test'],
    password: ''
});

bot.addListener('error', function(message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

bot.addListener('message#blah', function (from, message) {
    console.log('<%s> %s', from, message);
});

function isAdmin(hostname) {
	try {
		var adminStatus = admins.indexOf(hostname) > -1;
		console.log(adminStatus+hostname);
		return adminStatus;
	}
	catch (err) {
		return false;
	}
}

bot.addListener('message', function (from, to, message, info) {
    console.log('%s => %s: %s', from, to, message);

    if ( to.match(/^[#&]/) ) {
        // channel message
		if ( message == "!request" ) {
			bot.say(to, "So you want a Bouncer, eh?");
		}

		if ( message.match(/!kick/) ) {
			var isAllowed = isAdmin(info.host);
			console.log("ISALLOWED?"+isAllowed);
			if ( isAllowed == true ) {
				var regEx = /!kick ([a-zA-Z0-9_\-[\]{}^`|]*)/;
				try {
					var toKick = message.match(regEx)[1];
					bot.send("KICK", to, toKick);
				}
				catch (err) {
					console.error('Regex error in kick');
				}
			}
			else {
				bot.notice(from, "Only admins may perform this action.");
			}

		}
		if ( message.match(/!kban/) ) {
			var isAllowed = isAdmin(info.host);

			console.log("ISALLOWED?"+isAllowed);

			if ( isAllowed == true ) {
				try {
					var regEx = /!kban ([a-zA-Z0-9_\-[\]{}^`|]*)/;
					var toKickBan = message.match(regEx)[1];
					console.log(toKickBan);
					bot.whois(toKickBan, function (toKickBanHost) {
						bot.send("MODE", to, "+b", "*!*@*"+toKickBanHost.host);
						console.log(toKickBanHost);
						console.log(toKickBanHost.host);

						bot.send("KICK", to, toKickBan);
					});
				}
				catch (err) {
					console.error('Regex error in kickban');
				}
			}
			else {
				bot.notice(from, "Only admins may perform this action.");
			}
		}

	}

    else {
        // private message
    }
});
bot.addListener('pm', function(nick, message) {
    console.log('Got private message from %s: %s', nick, message);
});
bot.addListener('join', function(channel, who) {
    console.log('%s has joined %s', who, channel);
});
bot.addListener('part', function(channel, who, reason) {
    console.log('%s has left %s: %s', who, channel, reason);
});
bot.addListener('kick', function(channel, who, by, reason) {
    console.log('%s was kicked from %s by %s: %s', who, channel, by, reason);
});
