#!/usr/bin/env node
'use strict';
const path = require('path');
const ora = require('ora');
const meow = require('meow');
const fs = require('fs');
const chalk = require('chalk');
const getLink = require('./util/get-link');
const songdata = require('./util/get-songdata');
const urlParser = require('./util/url-parser');
const filter = require('./util/filters');

const download = require('./lib/downloader');
const cache = require('./lib/cache');

const cli = meow(
  `
  Usage
      $ spotifydl <link> …

  Examples
      $ spotifydl https://open.spotify.com/track/5tz69p7tJuGPeMGwNTxYuV
      $ spotifydl https://open.spotify.com/playlist/4hOKQuZbraPDIfaGbM3lKI
`,
  {
    flags: {
      help: {
        alias: 'h',
      },
      version: {
        alias: 'v',
      },
    },
  }
);

const { input } = cli;

if (!input[0]) {
  console.log('See spotifydl --help for instructions');
  process.exit(1);
}

(async () => {
  const spinner = ora(`Searching…`).start();
  try {
    var spotifye = new songdata();
    for (const link of input) {
      const urlType = await urlParser(await filter.removeQuery(link));
      var songData = {};
      const URL = link;
      switch(urlType) {
        case 'song': {
          songData = await spotifye.getTrack(URL);
          const songName = songData.name + songData.artists[0];

          spinner.succeed(`Song: ${songData.name} - ${songData.artists[0]}`);
          
          const youtubeLink = await getLink(songName);

          const output = path.resolve(process.cwd(), await filter.validateOutput(`${songData.name} - ${songData.artists[0]}.mp3`));
          spinner.start("Downloading...");
          
          await download(youtubeLink, output, spinner);
          break;
        }
        case 'playlist': {
          var cacheCounter = 0;
          songData = await spotifye.getPlaylist(URL);
          spinner.warn("Warning: Providing Playlist will download first 100 songs from the list. This is a drawback right now and will be fixed later.");
          var dir = process.cwd() + '/' + songData.name;
          
          spinner.info(chalk.underline(`Saving Playlist:`) + ` ${ process.cwd() }/${ songData.name }/`);
          
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            dir = path.resolve(dir, ".spdlcache");
          }
          else {
            dir = path.resolve(dir, ".spdlcache");
            if(fs.existsSync(`${dir}/.spdlcache`)) {
              spinner.info("Fetching cache to resume Download\n");
              cacheCounter = Number(fs.readFileSync(dir, 'utf-8'));
            }            
          }
          
          async function downloadLoop(trackIds, counter) {
            const songNam = await spotifye.extrTrack(trackIds[counter]);
            counter++;
            spinner.info(`${counter}. Song: ${songNam.name} - ${songNam.artists[0]}`);
            counter--;

            const ytLink = await getLink(songNam.name + songNam.artists[0]);

            const output = path.resolve(process.cwd(), songData.name, await filter.validateOutput(`${songNam.name} - ${songNam.artists[0]}.mp3`));
            spinner.start("Downloading...");

            download(ytLink, output, spinner, function() {
              cache.write(dir, counter);
              downloadLoop(trackIds, ++counter);
            })

          }
          downloadLoop(songData.tracks, cacheCounter);
          break;
        }
        case 'album': {
          var cacheCounter = 0;
          songData = await spotifye.getAlbum(URL);
          
          var dir = process.cwd() + '/' + songData.name;

          spinner.info(chalk.underline(`Saving Album:`) + ` ${process.cwd()}/${songData.name}/`);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
            dir = path.resolve(dir, ".spdlcache");
          }
          else {
            dir = path.resolve(dir, ".spdlcache");
            if (fs.existsSync(`${dir}/.spdlcache`)) {
              spinner.info("Fetching cache to resume Download\n");
              cacheCounter = Number(fs.readFileSync(dir, 'utf-8'));
            }
          }

          async function downloadLoop(trackIds, counter) {
            const songNam = await spotifye.extrTrack(trackIds[counter]);
            counter++;
            spinner.info(`${counter}. Song: ${songNam.name} - ${songNam.artists[0]}`);
            counter--;

            const ytLink = await getLink(songNam.name + songNam.artists[0]);

            const output = path.resolve(process.cwd(), songData.name, await filter.validateOutput(`${songNam.name} - ${songNam.artists[0]}.mp3`));
            spinner.start("Downloading...");

            download(ytLink, output, spinner, function () {
              cache.write(dir, counter);
              downloadLoop(trackIds, ++counter);
            })

          }
          downloadLoop(songData.tracks, cacheCounter);
          break;
        }
        case 'artist': {
          spinner.warn("To download artists list, add them to a separate Playlist and download.");
          break;
        }
        default: {
          throw new Error('Invalid URL type');
        }
      }
    }
  } catch (error) {
    spinner.fail(`Something went wrong!`);
    console.log(error);
    process.exit(1);
  }
})();

process.on('SIGINT', () => {
  process.exit(1);
});
