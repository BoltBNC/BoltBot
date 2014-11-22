#!/usr/bin/env node

/*
	BoltBot Channel Manager
	http://boltbnc.me
	http://github.com/cydrobolt/boltbnc
	=======----------=========
	Copyright 2014 Chaoyi Zha
	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at
	    http://www.apache.org/licenses/LICENSE-2.0
	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/


var irc = require('irc');
var S = require('string');
var sync = require('synchronize');
var mongoose = require('mongoose');
var config = require('./config.json');
var admins = config.admins;
var reserved = "cydrobolt";

var sendgrid  = require('sendgrid')(config.sgAPIUser, config.sgAPIPassword);
var make_passwd;
make_passwd = function(n, a) {
  var index = (Math.random() * (a.length - 1)).toFixed(0);
  return n > 0 ? a[index] + make_passwd(n - 1, a) : '';
};

mongoose.connect(config.mongoConnect);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  console.log("Connected to MongoDB server");
});

var Request = mongoose.model('Request', {username: String, email: String, actKey: String});

var bot = new irc.Client(config.ircHost, 'BoltBNCBot', {
	port: config.ircPort,
    debug: true,
	secure: true,
    channels: ['#BoltBNC', '#BoltBNC-test'],
    password: config.ircPassword
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
			bot.notice(from, "Format: !request <username> <email>. Please wait after you request a bouncer. A staff member will approve your account, and you will receive an email with account information.");
			return;
		}

		if ( message.match(/!request ([a-zA-Z0-9_\-[\]{}^`|]*?)\s([a-zA-Z0-9-@_]*)/) ) {
			// Error: User [cydrobolt] already exists!
			var regEx = /!request ([a-zA-Z0-9_\-[\]{}^`|]*?)\s([a-zA-Z0-9-@.\-_]*)/;
			try {
				var username = message.match(regEx)[1];
				if (username == reserved) {
					bot.notice(from, "Sorry, but this username is not allowed.");
					return;
				}
				var email = message.match(regEx)[2];
				bot.notice(from, "Your account has been placed on the waiting \
				list. If it is approved, you will be PMed and emailed your credentials. \
				Username: "+username+", Email: "+email);
				var actKey = make_passwd(20, 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890');
				var newUser = new Request({ username: username, email: email, actKey: actKey});
				newUser.save(function (err) {
					if (err) {
						bot.notice(from, "An error occured. Please let Admins know in #BoltBNC.");
					}
					else {
						bot.notice(from, "Success. You will be contacted soon.");
					}
				});
				bot.say(to, "Your account is now pending. Your unique request key: "+actKey);

			}
			catch (err) {
				console.error('Regex error in kick');
			}
			return;
		}
        if ( message.match(/!reject ([a-zA-Z0-9_\-[\]{}^`|]*)/) ) {
            if (isAdmin(info.host)) {
                var regEx = /!reject ([a-zA-Z0-9_\-[\]{}^`|]*)/;
                try {
                    var desID = message.match(regEx)[1];
                    try {
                        Request.remove({ actKey: desID }, function (err) {
                            if (err) {
                                bot.notice(from, "There was an error deleting the request from database.");
                            }
                            else {
                                bot.say(to, "User account request rejected. ")
                            }

                        });
                    }
                    catch (err) {
                        bot.notice(from, "There was an error deleting the request from database.")
                    }

                }
                catch (err) {
                    console.error('Regex error in reject');
                }
                return;
            }
            else {
                bot.notice(from, "Only administrators may use this command.");
            }
        }
        if ( message.match(/!delete ([a-zA-Z0-9_\-[\]{}^`|]*)/) ) {
            if (isAdmin(info.host)) {
                var regEx = /!delete ([a-zA-Z0-9_\-[\]{}^`|]*)/;
                try {
                    var desUser = message.match(regEx)[1];
                    bot.say('*controlpanel', "DELUSER "+desUser);
                    bot.say(to, "User removed from BoltBNC");

                }
                catch (err) {
                    console.error('Regex error in delete');
                }
            }
            else {
                bot.notice(from, "Only administrators may use this command.");
            }
            return;
        }
		if ( message.match(/!approve ([a-zA-Z0-9_\-[\]{}^`|]*?)/) ) {
			if (isAdmin(info.host)) {
				var desID = message.match(/!approve ([a-zA-Z0-9]*)/)[1];
				console.log(desID);
				var targEmail, targUsername, targPassword;
				targPassword = make_passwd(20, 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890!@#$%^&*()');
				try {
		            Request.find({ actKey: desID }, function (err, dobj) {

		                var map = dobj.map(function(s){
							targEmail = s.email;
							targUsername = s.username;
						});
						if (targUsername == undefined || targUsername == "undefined") {
							bot.say(to, "Could not find user not associated with activation key.");
							return;
						}

						if (err) {
							bot.notice(from, "Error specified finding user.");
							return;
						}
						var payload   = {
							to      : targEmail,
							from    : 'no-reply@boltbnc.me',
							subject : 'BoltBNC Account Confirmation',
							text    : 'Hello.'+"\n"+' Your new password is '+targPassword+' for username '+targUsername+'.'+"\n"+'\
										Webadmin: https://amethyst.boltbnc.me:7697 '+"\n"+' Server: amethyst.boltbnc.me '+"\n"+'Port: 7697 SSL, 7667 No SSL'+"\
										\n Server Password Format: [username]/[network]:[password]",
							html    : 'Hello.'+"<br />"+' Your new password is <b>'+targPassword+'</b> for username <b>'+targUsername+'</b>.'+"<br />"+'\
											Webadmin: <a href="https://amethyst.boltbnc.me:7697">https://amethyst.boltbnc.me:7697</a> '+"<br />"+' Server: amethyst.boltbnc.me '+"<br />"+'Port: 7697 SSL, 7667 No SSL'+"\
											<br /> Server Password Format: [username]/[network]:[password]"
						}

						bot.say('*controlpanel', "ADDUSER "+targUsername+" "+targPassword);
						bot.say('*controlpanel', "SET DenySetBindHost "+targUsername+" true");
                        bot.say('*controlpanel', "SET QuitMsg BoltBNC - http://boltbnc.me");
						sendgrid.send(payload, function(err, json) {
							if (err) { console.error(err);bot.say(to, from+", an error occured while sending the email. ");return; }
							console.log(json);
						});
						try {
				            Request.remove({ actKey: desID }, function (err) {
				                if (err) {
				                    bot.notice(from, "There was an error deleting the request from database.");
				                }
				            });
				        }
				        catch (err) {
				            bot.notice(from, "There was an error deleting the request from database.")
				        }
						bot.say(to, "User successfully created. "+targUsername+", check your inbox for your credentials.");


		            });
		        }
		        catch (err) {
		            bot.notice(from, "Error finding specified user.");
					return;
		        }


			}
			else {
				bot.notice(from, "Only administrators may use this command.");
			}

		return;
		}
		if ( message.match(/!request/) ) {
			bot.notice(from, "Format: !request <username> <email>. Usernames must be alphanumeric, dashes and underscores are allowed. Please wait after you request a bouncer. A staff member will approve your account, and you will receive an email with account information.");
			return;
		}

		if ( message.match(/!kick/) ) {
			var isAllowed = isAdmin(info.host);
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
    //console.log('Got private message from %s: %s', nick, message);
    if ( message == "request" ) {
        bot.notice(from, "Format: !request <username> <email>. Please wait after you request a bouncer. A staff member will approve your account, and you will receive an email with account information.");
        return;
    }

    if ( message.match(/request ([a-zA-Z0-9_\-[\]{}^`|]*?)\s([a-zA-Z0-9-@_]*)/) ) {
        // Error: User [cydrobolt] already exists!
        var regEx = /request ([a-zA-Z0-9_\-[\]{}^`|]*?)\s([a-zA-Z0-9-@.\-_]*)/;
        try {
            var username = message.match(regEx)[1];
            if (username == reserved) {
                bot.notice(from, "Sorry, but this username is not allowed.");
                return;
            }
            var email = message.match(regEx)[2];
            bot.notice(from, "Your account has been placed on the waiting \
            list. If it is approved, you will be PMed and emailed your credentials. \
            Username: "+username+", Email: "+email);
            var actKey = make_passwd(20, 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890');
            var newUser = new Request({ username: username, email: email, actKey: actKey});
            newUser.save(function (err) {
                if (err) {
                    bot.notice(from, "An error occured. Please let Admins know in #BoltBNC.");
                }
                else {
                    bot.notice(from, "Success. You will be contacted soon.");
                }
            });
            bot.say(to, "Your account is now pending. Your unique request key: "+actKey);

        }
        catch (err) {
            console.error('Regex error in kick');
        }
        return;
    }
});
bot.addListener('join', function(channel, who) {
    //console.log('%s has joined %s', who, channel);
});
bot.addListener('part', function(channel, who, reason) {
    //console.log('%s has left %s: %s', who, channel, reason);
});
bot.addListener('kick', function(channel, who, by, reason) {
    //console.log('%s was kicked from %s by %s: %s', who, channel, by, reason);
});
