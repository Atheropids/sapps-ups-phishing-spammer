'use strict';

/*
 * Copyright (c) 2022, Atheropids.
 * All rights reserved.
 */

const fs = require('fs');
const https = require('https');
const tough_cookie = require('tough-cookie');
const url = require('url');

const Random = require('./random.js');

/*
 * Mutates the first payload URL to the phishing page URL.
 */
function getAdrURL(str)
{
  let idx = str.indexOf('?');
  if(idx > 0)
  {
    return `${str.substring(0, idx)}adr.php?a=1&${str.substring(idx + 1)}`;
  }
  return null;
}

/*
 * Generate fake data for 'adr.php'.
 */
function getAdrParam(rand, table)
{
  let ret = new URLSearchParams();

  if(rand.nextU8() === 0)
  {
    let name = randomIndex(rand, table.fullNames);
    ret.set('first_name', name[0]);
    ret.set('last_name', name[1]);
  }
  else
  {
    ret.set('first_name', randomIndex(rand, table.firstName));
    ret.set('last_name', randomIndex(rand, table.lastName));
  }

  ret.set('phone_number', `8${randomIndex(rand, table.tollFree).repeat(2)}${randomDecimals(rand, 7)}`);

  let birthday = new Date(rand.nextU32() * 250);
  ret.set('dob', `${padZero(birthday.getUTCMonth() + 1, 2)}/${padZero(birthday.getUTCDate(), 2)}/${birthday.getUTCFullYear()}`);

  let address = `${randomDecimals(rand, 4)} ${randomIndex(rand, table.roadName)}`;
  let roadType = randomIndex(rand, table.roadSuffix);
  if(roadType != null)
  {
    address = `${address} ${roadType}`;
  }
  ret.set('address', address);

  ret.set('countryCode', 'US');
  ret.set('state', randomIndex(rand, table.states));
  ret.set('postal_code', randomDecimals(rand, 5));

  ret.set('recoverMyID', '');

  /*
  ret.set('first_name', 'Vladolf');
  ret.set('last_name', 'Putler');
  ret.set('phone_number', '6666666');
  ret.set('dob', '06/04/1989');
  ret.set('address', '666 Satan Ave.');
  ret.set('countryCode', 'US');
  ret.set('city', 'Hell');
  ret.set('state', 'Your Mom\'s Vagina');
  ret.set('postal_code', '42069');
  ret.set('recoverMyID', '');
  */

  return ret;
}

/*
 * Generate fake data for 'mone.php'.
 */
function getMoneParam(rand, table)
{
  let ret = new URLSearchParams();

  ret.set('card_number', randomDecimals(rand, 16));

  let expire = new Date(1690000000000 + rand.nextU32() * 125);
  ret.set('exp_date', `${padZero(expire.getUTCMonth() + 1, 2)}/${expire.getUTCFullYear() % 100}`);

  ret.set('cvv', randomDecimals(rand, 3));

  ret.set('email', randomEmail(rand, table));

  ret.set('recoverMyID', '');

  /*
  ret.set('card_number', '00000000');
  ret.set('exp_date', '69/69');
  ret.set('cvv', '420');
  ret.set('email', 'bitches@sapps-ups.com');
  ret.set('recoverMyID', '');
  */

  return ret;
}

/*
 * Generate fake data for 'dtl.php'.
 */
function getDtlParam(rand, table)
{
  let ret = new URLSearchParams();

  let ssn = randomDecimals(rand, 9);
  ssn = `${ssn.substring(0, 3)} ${ssn.substring(3, 5)} ${ssn.substring(5)}`;
  ret.set('ssn', ssn);

  let i8 = rand.nextU8();
  let driverNum = '';
  if(i8 % 2 === 0)
  {
    driverNum += String.fromCharCode(table.chars[Math.floor(i8 / 10) % table.chars.length] - 0x20);
  }
  driverNum += randomDecimals(rand, i8 % 7 + 6);
  ret.set('dl', driverNum);

  ret.set('email_pass', randomIndex(rand, table.pass));

  ret.set('recoverMyID', '');
  
  /*
  ret.set('ssn', '666 66 6666');
  ret.set('dl', '666666');
  ret.set('email_pass', 'FakePass4Losers');
  ret.set('recoverMyID', '');
  */

  return ret;
}

/*
 * Generate fake data for 'in.php'.
 */
function getInParam(rand, table)
{
  let ret = new URLSearchParams();

  ret.set('pin', randomDecimals(rand, 4));

  ret.set('recoverMyID', '');

  /*
  ret.set('pin', '6666');
  ret.set('recoverMyID', '');
  */

  return ret;
}

function padZero(num, len)
{
  return `${'0'.repeat(len)}${num}`.substr(-len);
}

/*
 * Get a random item from an array.
 */
function randomIndex(rand, arr)
{
  return arr[rand.nextU8() % arr.length];
}

/*
 * Generate a decimal string of length `len`.
 */
function randomDecimals(rand, len)
{
  let arr = rand.nextBytes(Math.ceil(len / 2.40824));
  let bi = BigInt(`0x${Buffer.from(arr).toString('hex')}`);

  let ret = '';
  while(len > 0)
  {
    ret += `${bi % 10n}`;
    bi /= 10n;
    len--;
  }

  return ret;
}

/*
 * Generate random fake email.
 */
function randomEmail(rand, table)
{
  let i16 = rand.nextU16();
  let ret = `${randomIndex(rand, table.user).toLowerCase()}${i16 < 10 ? '0' : ''}${i16}@`;
  let i32 = rand.nextU32();
  let i = i32;
  while (i32 > 0)
  {
    ret = `${ret}${String.fromCharCode(table.chars[i32 % table.chars.length])}`;
    i32 = Math.floor(i32 / table.chars.length);
  }
  ret = `${ret}.${table.topLevelDomain[i % table.topLevelDomain.length]}`;
  return ret;
}

/*
 * Construct full URL from 'location' header field.
 */
function constructLocation(new_loc, curr_url_obj)
{
  if(new_loc.match(/^https?:/i) != null)
  {
    return new_loc;
  }
  else
  {
    let ret = curr_url_obj.origin;
    if(new_loc.startsWith('/'))
    {
      ret = `${ret}${new_loc}`;
    }
    else
    {
      let path = curr_url_obj.pathname;
      ret = `${ret}${path.substring(0, path.lastIndexOf('/') + 1)}${new_loc}`;
    }
    return ret;
  }
}

/*
 * Encode cookies into a string.
 */
function encodeCookies(cookies_list)
{
  let arr = [];
  for(let cookie in cookies_list)
  {
    let cache = new URLSearchParams();
    cache.set(cookie, cookies_list[cookie]);
    arr.push(cache.toString());
  }
  return arr.join('; ');
}

function log(str)
{
  fs.appendFileSync(`${process.cwd()}/out.log`, `${str}\r\n`);
  console.log(str);
}

/*
 * Main stub function for attack procedure and spam random sh!t onto the malicious server.
 */
function phish(list, delay, repeat, stage, metadata, debug)
{
  let data = list[stage];

  let url_str = null;
  if(data.hasOwnProperty('url'))
  {
    url_str = data.url;
  }
  else if(data.hasOwnProperty('func'))
  {
    url_str = data.func(metadata.url);
  }
  else
  {
    url_str = metadata.url;
  }
  url_str = metadata.url = url_str;

  let url_obj = new url.URL(url_str);
  let cookies_str = null;
  if(metadata.cookies.has(url_obj.host))
  {
    cookies_str = encodeCookies(metadata.cookies.get(url_obj.host));
  }

  let headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Mobile Safari/537.36'
  };
  if(cookies_str)
  {
    headers['cookie'] = cookies_str;
  }

  let req_body = null;
  if(data.flag === 2 && data.hasOwnProperty('param_gen'))
  {
    let req_str = data.param_gen(metadata.rand, metadata.table).toString();
    if(debug)
    {
      log(`[${metadata.id}][${stage}] Form: ${req_str}`);
    }
    req_body = Buffer.from(req_str, 'utf8');

    headers['content-type'] = 'application/x-www-form-urlencoded';
    headers['content-length'] = `${req_body.length}`;
  }

  let req = https.request(url_str, {
    method: data.flag === 2 ? 'POST' : 'GET',
    headers: headers
  });

  req.on('error', function(err) {
    console.error(err);
  });

  req.on('response', function(resp) {
    let headers = resp.headers;
    let location = headers['location'];

    let erro = false;

    log(`[${metadata.id}][${stage}][${resp.statusCode}] ${url_str}`);

    if(data.hasOwnProperty('expect'))
    {
      let expect = data.expect;

      if(expect.hasOwnProperty('code') && expect.code !== resp.statusCode)
      {
        console.error(`[${metadata.id}][${stage}] Received statusCode ${resp.statusCode} while ${expect.code} was expected. Abort!`);
        erro = true;
      }

      if(location)
      {
        if(expect.hasOwnProperty('domain'))
        {
          if(location.match(/^https?:/i) != null)
          {
            let loc_obj = new url.URL(location);
            if(expect.domain == null)
            {
              console.error(`[${metadata.id}][${stage}] Received redirection to \'${loc_obj.host}\' while \'${url_obj.host}\' was expected. Abort!`);
              erro = true;
            }
            else if(!loc_obj.host.endsWith(expect.domain))
            {
              console.error(`[${metadata.id}][${stage}] Received redirection to \'${loc_obj.host}\' while \'${expect.domain}\' was expected. Abort!`);
              erro = true;
            }
          }
        }
      }
    }

    if(location)
    {
      metadata.url = constructLocation(location, url_obj);
    }

    if(headers['set-cookie'])
    {
      let new_cookies;
      if(typeof(headers['set-cookie']) === 'object')
      {
        new_cookies = headers['set-cookie'];
      }
      else
      {
        new_cookies = [headers['set-cookie']];
      }

      if(!metadata.cookies.has(url_obj.host))
      {
        metadata.cookies.set(url_obj.host, {});
      }
      let export_cookies = metadata.cookies.get(url_obj.host);

      for(let i = 0 ; i < new_cookies.length ; i++)
      {
        let cookie = tough_cookie.Cookie.parse(new_cookies[i]);
        export_cookies[cookie.key] = cookie.value;

        if(debug)
        {
          log(`[${metadata.id}][${stage}] Set-Cookie: ${cookie.key} => ${cookie.value}`);
        }
      }
    }

    let cache = [];
    resp.on('data', function(chunk) {
      cache.push(chunk);
    });
    resp.on('end', function() {
      if(cache.length)
      {
        let buf = Buffer.concat(cache);
        
        if(erro && debug)
        {
          fs.writeFileSync(`${process.cwd()}/${Date.now()}.txt`, buf);
        }
      }

      if(!erro)
      {
        stage = (stage + 1) % list.length;
        if(stage === 0)
        {
          if(repeat)
          {
            setTimeout(phish, delay, list, delay, repeat, stage, {
              id: metadata.id + 1,
              rand: metadata.rand,
              table: metadata.table,
              cookies: new Map()
            }, debug);
          }
        }
        else
        {
          setTimeout(phish, delay, list, delay, repeat, stage, metadata, debug);
        }
      }
    });
  });

  if(req_body)
  {
    req.write(req_body);
  }
  req.end();
}

/*
 * Create static data pool for the fake inputs.
 */
function setupRudeTable(cringe)
{
  let ret = {};

  let insult_words = [
    'Fuck',
    'Shit',
    'Garbage',
    'Pussy',
    'MotherFucker',
    'LMFAO',
    'SuckMyCock',
    'TasteMyCum',
    'Stupid',
    'Dumbass',
    'Demon',
    'Hahahaha',
    'Noob',
    'L33T',
    'Penis',
    'Semen',
    'BigDick',
    'Poopoo',
    'Fool',
    'Idiot',
    'Shithead',
    'Dickhead',
    'Butthole',
    'Asshole',
    'Degenerate',
    'Scumbag',
    'Scum',
    'Turd',
    'Crap',
    'Bullcrap',
    'Bullshit',
    'DumbFuck',
    'Jizz',
    'Cumshot',
    'Creampie',
    'Cum',
    'Devil',
    'SickFuck',
    'Douchebag',
    'Cock',
    'BigBlackCock',
    'Anal',
    'AssFucked',
    'AIDS',
    'Cancer',
    'DogShit',
    'Satan',
    'Sucker',
    'Bukkake',
    'Cunt',
    'Bitch',
    'Hell'
  ];

  ret.firstName = insult_words;
  ret.lastName = insult_words;

  ret.fullNames = [
    ['Vladolf', 'Putler'],
    ['Donald', 'Trump']
  ];

  ret.tollFree = [
    '0',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8'
  ]

  ret.states = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming'
  ];

  ret.roadName = insult_words;

  ret.roadSuffix = [
    'Lane',
    'Road',
    'Street',
    'Avenue',
    'Drive',
    null
  ];

  ret.user = insult_words;

  ret.chars = Buffer.from('abcdefghijklmnopqrstuvwxyz');

  ret.topLevelDomain = [
    'com',
    'net',
    'org',
    'edu',
    'us',
    'cn',
    'jp',
    'kr',
    'ca',
    'ru',
    'uk',
    'fr',
    'br',
    'in'
  ];

  ret.pass = [
    `Fucking Scammers`,
    `Stupid Motherfucker`,
    `Go Kill Yourself`,
    `Go Kill Yourself to Save Oxygen on Earth`,
    `Hang Yourself You Idiot`,
    `Hang Yourself and Save Oxygen on Earth`,
    `Your Existence is a Waste of Resources`,
    `You Deserve Getting Hanged and Tossed into Landfill`,
    `Die in Pain You Fool`,
    `You Poor Braindead`,
    `Go Jump Off a Bridge`,
    `You Deserve Getting Murdered`,
    `Imma Rape Your Daughter`,
    `Hot Cum in Your Ass`,
    `I Cummed Inside Your Daughter and it was Great`,
    `Cum With HIV in Your Ass`,
    `${cringe} Owns You`,
    `Get Fucked by My Big Dick`,
    `Big Dick in Your Ass`,
    `Suck My Cock`,
    `Taste My Jizz`,
    `I Cummed Inside Your Ass`,
    `Bow Down to ${cringe} Pwnage`,
    `${cringe} Owns You and All`,
    `${cringe} on Top`,
    `${cringe} Owns Your Daughter`,
    `Your Girlfriend Cheated on You with ${cringe}`,
    `${cringe} Cummed Inside Your Babe`,
    `${cringe} Will Never Stop Pwning Scammers`,
    `${cringe} Big Dick Penetrated Your Girl`,
    `Taste the Hot Jizz From ${cringe}`,
    `${cringe} Fucked Your Girl`,
    `${cringe} Fucked Your Mom`,
    `${cringe} Fucked Your Sister`,
    `${cringe} Fucked You in the Ass`,
    `${cringe} Just Gave You AIDS`,
    `${cringe} Just Gave You Cancer`,
    `${cringe} Anti-Scam Owns You`,
    `${cringe} Anti-Scam Owns You and All`,
    `Bow Down to Me and My Endless Power`,
    `Bow Down to the Mighty ${cringe}`,
    `You Can Only Obey ${cringe}`,
    `${cringe} Never Forgive Scammers`,
    `${cringe} Just Stabbed Your Mom`,
    `Praise ${cringe}`,
    `I Have the Power of ${cringe} But Not You`,
    `I Pity You For Being on the Wrong Side of ${cringe}`,
    `You Can Only Obey ${cringe}`,
    `${cringe} Has the Power`,
    `${cringe} Cannot Handle Your Stench`,
    `Eww You Ugly as Fuck`,
    `Go Fuck Yourself`,
    `Stop Wasting Resources on Earth and Go Hang Yourself`,
    `${cringe} Recommend You to Commit Suicide`,
    `Help Relieving Global Warming by Hanging Yourself`,
    `Your Worthless Life Deserves a Painful Death`,
    `Unlike ${cringe} Your Life is Worthless`,
    `${cringe} Just Fed You My Shit`,
    `Hang Yourself to End Your Miserable Worthless Life`,
    `Hang Yourself to End Your Miserable Life`,
    `Hang Yourself to End Your Worthless Life`,
    `${cringe} Recommend You to Hang Yourself`,
    `${cringe} Can Help You Hang Yourself`,
    `EZ Pwned by ${cringe}`,
    `${cringe} Will Keep You MAD`,
    `You Got EZed by ${cringe}`,
    `${cringe} was in Your House`,
    `${cringe} Beated You`,
    `${cringe} is Your Boss`,
    `You Must Obey ${cringe}`,
    `You Got Ass Fucked by ${cringe}`,
    `${cringe} Fucked Your Whole Family`,
    `You Poor Degenerate`,
    `EZ Raped`,
    `You got EZed by ${cringe} in Node.js`,
    `Have Fun Filtering ${cringe} Sticky Cum`,
    `EZ Raped by ${cringe}`,
    `${cringe} Raped You and Your Whole Family`,
    `Error Logs Goes Brrrrrr on Your Poor Raped Server LMFAO`,
    `Enjoy Your Logs Filled With Sticky White Cum of ${cringe}`,
    `Heil ${cringe}`,

    `Putler is a Pig`,
    `Fuck Vladolf Putler!`,
    `Vladolf Putler`,
    `Putler Loves My Dick`,
    `Putler Drinks My Cum Everyday`,
    `Murderer Putler`,
    `Genocidal Putler`
  ];

  return ret;
}

/*
 * Main function.
 */
function __main__(args)
{
  /* 
   * Flags:
   *  0 -> Specified,
   *  1 -> Follow previous redirection,
   *  2 -> Post to previous requested URL.
   *  3 -> Call functions mutating current URL and perform GET.
   */
  let target_urls = [
    {flag: 0, url: 'https://u8jos-upsc.us/dc8dk', expect: {code: 302, domain: 'sapps-ups.com'}},
    {flag: 1, expect: {code: 302, domain: null}}, // First redirect, something pointing to 'https://sapps-ups.com/.../?ptr=...'.
    {flag: 1, expect: {code: 200}}, // Payload, something pointing to 'https://sapps-ups.com/.../?ptr=...' but slightly different.
    {flag: 3, func: getAdrURL, expect: {code: 200}}, // Simulate click that leads to 'https://sapps-ups.com/.../adr.php?a=1&ptr=...'.
    {flag: 2, param_gen: getAdrParam, expect: {code: 302, domain: null}}, // POST to './adr.php'.
    {flag: 1, expect: {code: 200}}, // Redirect to './mone.php'.
    {flag: 2, param_gen: getMoneParam, expect: {code: 302, domain: null}}, // POST to './mone.php'.
    {flag: 1, expect: {code: 200}}, // Redirect to './dtl.php'.
    {flag: 2, param_gen: getDtlParam, expect: {code: 302, domain: null}}, // POST to './dtl.php'.
    {flag: 1, expect: {code: 200}}, // Redirect to './in.php'.
    {flag: 2, param_gen: getInParam, expect: {code: 302, domain: null}}, // POST to './in.php'.
    {flag: 1, expect: {code: 200}}, // Redirect to './firm.php'.
  ];

  // Delay in milliseconds between requests.
  let req_delay = 1000;

  // Repeat spary spam cycles.
  let repeat = true;

  // Debug flag
  let debug = true;

  // Start spraying.
  setTimeout(phish, 0, target_urls, req_delay, repeat, 0, {
    id: 0,
    rand: new Random(),
    table: setupRudeTable('YoMama-Hacks'),
    cookies: new Map()
  }, debug);
}

__main__(process.argv.slice(2));
