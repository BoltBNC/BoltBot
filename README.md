BoltBot
=======
BoltBNC's channel bot.

####Setup:
 - Dependencies: `npm`, `nodejs`, `mongodb`. Npm dependencies can be installed with `npm install`, and are listed in `package.json`
 - Clone this Git repo, or download it as a ZIP archive. Navigate to BoltBot/, and run `rm -rf node_modules && npm install`
 - Edit `config.js` with appropriate configurations, and edit `boltbot.js`'s `var admins = []` clause with your corresponding admin hostnames.
 - To run BoltBot, navigate to `boltbot.js`'s folder and execute `node boltbot.js`.

####Run as a daemon
 - Read http://blog.carbonfive.com/2014/06/02/node-js-in-production/
